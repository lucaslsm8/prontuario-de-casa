//! Lembretes: o front manda a lista das próximas horas (src/data/lembretes.ts) e
//! aqui uma thread espera cada horário e chama a notificação (notificacao.rs).
//! A lista fica só em memória; nada disso vai para o disco.

use chrono::{Duration, Local, NaiveDateTime};
use serde::Deserialize;
use std::collections::HashSet;
use std::sync::{Arc, Condvar, Mutex};

const ADIADO: &str = "|adiado";
const ADIAR_MIN: i64 = 15;
/// Quem abre o app logo depois do horário ainda recebe o aviso; mais atrasado que isso
/// não aparece (a dose segue pendente no Início).
const ATRASO_MAX_MIN: i64 = 30;
/// Acorda pelo menos a cada minuto (suspensão do PC, troca de relógio).
const ESPERA_MAX: std::time::Duration = std::time::Duration::from_secs(60);

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Lembrete {
    pub id: String,
    pub quando: String,
    pub titulo: String,
    pub corpo: String,
    pub acoes: bool,
}

#[derive(Default)]
pub struct Fila {
    itens: Vec<Lembrete>,
    mostrados: HashSet<String>,
}

fn hora(l: &Lembrete) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(&l.quando, "%Y-%m-%dT%H:%M").ok()
}

fn base(id: &str) -> &str {
    id.strip_suffix(ADIADO).unwrap_or(id)
}

impl Fila {
    /// Troca a lista inteira. Um adiamento continua enquanto o lembrete original
    /// estiver na lista; se a dose foi marcada no app, os dois saem juntos.
    pub fn substituir(&mut self, lista: Vec<Lembrete>) {
        let ids: HashSet<String> = lista.iter().map(|l| l.id.clone()).collect();
        let adiados: Vec<Lembrete> = self.itens.drain(..).filter(|l| l.id.ends_with(ADIADO) && ids.contains(base(&l.id))).collect();
        self.itens = lista.into_iter().filter(|l| hora(l).is_some()).chain(adiados).collect();
        let vivos: HashSet<&str> = self.itens.iter().map(|l| l.id.as_str()).collect();
        self.mostrados.retain(|id| vivos.contains(id.as_str()));
    }

    /// Lembretes cuja hora chegou e que ainda não apareceram. Já saem marcados como mostrados.
    /// Os atrasados demais (`ATRASO_MAX_MIN`) são marcados sem aparecer, para não haver
    /// rajada ao abrir o app; eles continuam na lista e ainda podem ser adiados.
    /// Um adiamento aparece mesmo atrasado (PC suspenso): a pessoa pediu esse aviso.
    pub fn vencidos(&mut self, agora: NaiveDateTime) -> Vec<Lembrete> {
        let limite = agora - Duration::minutes(ATRASO_MAX_MIN);
        let pendentes: Vec<(Lembrete, NaiveDateTime)> = self
            .itens
            .iter()
            .filter(|l| !self.mostrados.contains(&l.id))
            .filter_map(|l| hora(l).filter(|t| *t <= agora).map(|t| (l.clone(), t)))
            .collect();
        let mut out = Vec::new();
        for (l, t) in pendentes {
            self.mostrados.insert(l.id.clone());
            if t >= limite || l.id.ends_with(ADIADO) {
                out.push(l);
            }
        }
        out
    }

    /// Hora do próximo lembrete que ainda não apareceu.
    pub fn proximo(&self) -> Option<NaiveDateTime> {
        self.itens.iter().filter(|l| !self.mostrados.contains(&l.id)).filter_map(hora).min()
    }

    /// "Lembrar em 15 min": uma cópia do lembrete volta daqui a 15 minutos.
    pub fn adiar(&mut self, id: &str, agora: NaiveDateTime) -> bool {
        let b = base(id).to_string();
        let Some(orig) = self.itens.iter().find(|l| l.id == id || l.id == b).cloned() else {
            return false;
        };
        let novo = format!("{b}{ADIADO}");
        self.itens.retain(|l| l.id != novo);
        self.mostrados.remove(&novo);
        let quando = (agora + Duration::minutes(ADIAR_MIN)).format("%Y-%m-%dT%H:%M").to_string();
        self.itens.push(Lembrete { id: novo, quando, ..orig });
        true
    }
}

fn agora() -> NaiveDateTime {
    Local::now().naive_local()
}

/// A fila com o relógio de verdade, compartilhada entre o comando e a thread.
pub struct Agendador {
    fila: Mutex<Fila>,
    sinal: Condvar,
}

impl Agendador {
    pub fn novo() -> Arc<Self> {
        Arc::new(Self { fila: Mutex::new(Fila::default()), sinal: Condvar::new() })
    }

    pub fn substituir(&self, lista: Vec<Lembrete>) {
        if let Ok(mut f) = self.fila.lock() {
            f.substituir(lista);
        }
        self.sinal.notify_one();
    }

    pub fn adiar(&self, id: &str) {
        if let Ok(mut f) = self.fila.lock() {
            f.adiar(id, agora());
        }
        self.sinal.notify_one();
    }

    /// Roda para sempre, numa thread própria. `mostrar` é chamado sem a fila travada.
    pub fn rodar(self: Arc<Self>, mostrar: impl Fn(Lembrete) + Send + 'static) {
        let Ok(mut f) = self.fila.lock() else { return };
        loop {
            let vencidos = f.vencidos(agora());
            if !vencidos.is_empty() {
                drop(f);
                for l in vencidos {
                    mostrar(l);
                }
                let Ok(g) = self.fila.lock() else { return };
                f = g;
                continue;
            }
            let espera = f
                .proximo()
                .map(|t| (t - agora()).to_std().unwrap_or_default())
                .unwrap_or(ESPERA_MAX)
                .min(ESPERA_MAX);
            let Ok((g, _)) = self.sinal.wait_timeout(f, espera) else { return };
            f = g;
        }
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    fn l(id: &str, quando: &str) -> Lembrete {
        Lembrete { id: id.into(), quando: quando.into(), titulo: "t".into(), corpo: "c".into(), acoes: true }
    }
    fn t(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M").unwrap()
    }
    fn ids(v: &[Lembrete]) -> Vec<&str> {
        v.iter().map(|x| x.id.as_str()).collect()
    }

    #[test]
    fn mostra_na_hora_e_uma_vez_so() {
        let mut f = Fila::default();
        f.substituir(vec![l("a", "2026-10-29T21:00"), l("b", "2026-10-29T22:00")]);
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:00")));
        assert!(f.vencidos(t("2026-10-29T20:59")).is_empty());
        assert_eq!(ids(&f.vencidos(t("2026-10-29T21:00"))), ["a"]);
        assert!(f.vencidos(t("2026-10-29T21:05")).is_empty());
        assert_eq!(f.proximo(), Some(t("2026-10-29T22:00")));
    }

    #[test]
    fn lista_nova_nao_repete_o_que_ja_apareceu() {
        let mut f = Fila::default();
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        f.vencidos(t("2026-10-29T21:00"));
        f.substituir(vec![l("a", "2026-10-29T21:00"), l("b", "2026-10-29T21:30")]);
        assert!(f.vencidos(t("2026-10-29T21:10")).is_empty());
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:30")));
    }

    #[test]
    fn adiar_volta_em_15_min_e_cai_quando_a_dose_e_marcada() {
        let mut f = Fila::default();
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        f.vencidos(t("2026-10-29T21:00"));
        assert!(f.adiar("a", t("2026-10-29T21:02")));
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:17")));
        // A lista nova (a dose ainda não foi marcada) não derruba o adiamento.
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:17")));
        assert_eq!(ids(&f.vencidos(t("2026-10-29T21:17"))), ["a|adiado"]);
        // Adiar de novo, a partir da notificação adiada.
        assert!(f.adiar("a|adiado", t("2026-10-29T21:18")));
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:33")));
        // Dose marcada no app: o lembrete sai da lista e o adiamento vai junto.
        f.substituir(vec![]);
        assert_eq!(f.proximo(), None);
    }

    #[test]
    fn atrasado_demais_nao_aparece_mas_ainda_pode_ser_adiado() {
        let mut f = Fila::default();
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        assert!(f.vencidos(t("2026-10-29T21:40")).is_empty());
        assert_eq!(f.proximo(), None);
        assert!(f.adiar("a", t("2026-10-29T21:41")));
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:56")));
        // A lista nova ainda traz a dose (24 h para trás no front): o adiamento fica.
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        assert_eq!(f.proximo(), Some(t("2026-10-29T21:56")));
        assert_eq!(ids(&f.vencidos(t("2026-10-29T21:56"))), ["a|adiado"]);
    }

    #[test]
    fn adiamento_aparece_mesmo_depois_do_pc_suspenso() {
        let mut f = Fila::default();
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        f.vencidos(t("2026-10-29T21:00"));
        assert!(f.adiar("a", t("2026-10-29T21:01")));
        // O PC dormiu das 21:05 às 22:30: o adiamento das 21:16 ainda aparece.
        assert_eq!(ids(&f.vencidos(t("2026-10-29T22:30"))), ["a|adiado"]);
    }

    #[test]
    fn atraso_de_20_min_ainda_aparece() {
        let mut f = Fila::default();
        f.substituir(vec![l("a", "2026-10-29T21:00")]);
        assert_eq!(ids(&f.vencidos(t("2026-10-29T21:20"))), ["a"]);
    }

    #[test]
    fn adiar_lembrete_desconhecido_nao_faz_nada() {
        let mut f = Fila::default();
        assert!(!f.adiar("x", t("2026-10-29T21:00")));
        assert_eq!(f.proximo(), None);
    }

    #[test]
    fn ignora_hora_invalida() {
        let mut f = Fila::default();
        f.substituir(vec![l("x", "amanhã")]);
        assert_eq!(f.proximo(), None);
        assert!(f.vencidos(t("2030-01-01T00:00")).is_empty());
    }
}
