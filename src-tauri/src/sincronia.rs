//! Envio e recebimento de pacotes. Sem banco nem rede aqui dentro além do `Remoto`:
//! quem chama (lib.rs) lê e grava o kv e os eventos, e faz a rede fora do lock do banco.

use crate::familia::Familia;
use crate::pacote;
use crate::remoto::Remoto;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

type R<T> = Result<T, String>;

/// Kv "sync_envio": quantos eventos deste aparelho já subiram e o próximo número de pacote.
#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Pendencia {
    pub n: u32,
    pub enviados: usize,
}

/// Pacotes a enviar: os eventos próprios depois dos `ja` enviados, numerados a partir de `prox_n`.
pub fn preparar_envio(proprios: &[Value], ja: usize, prox_n: u32) -> Vec<(u32, Vec<Value>)> {
    let resto = proprios.get(ja..).unwrap_or(&[]);
    pacote::fatiar(resto).into_iter().enumerate().map(|(i, p)| (prox_n + i as u32, p)).collect()
}

/// Grava os pacotes em ordem; para no primeiro erro. Devolve (último n gravado, eventos enviados).
/// Se o primeiro já falhar, devolve o erro.
pub fn enviar(remoto: &dyn Remoto, f: &Familia, aparelho: &str, pacotes: &[(u32, Vec<Value>)]) -> R<(u32, usize)> {
    let chave = f.chave_bytes()?;
    let mut ultimo = 0;
    let mut enviados = 0;
    for (n, evs) in pacotes {
        let bytes = pacote::empacotar(&chave, &f.familia_id, aparelho, *n, evs)?;
        if let Err(e) = remoto.gravar(&pacote::nome(aparelho, *n), &bytes) {
            if enviados == 0 {
                return Err(e);
            }
            break;
        }
        ultimo = *n;
        enviados += evs.len();
    }
    Ok((ultimo, enviados))
}

/// Pacotes dos outros aparelhos que ainda não foram lidos, em ordem.
pub fn novos_pacotes(remoto: &dyn Remoto, aparelho: &str, lidos: &BTreeMap<String, u32>) -> R<Vec<(String, u32)>> {
    let mut out = Vec::new();
    for dono in remoto.listar("eventos")? {
        if dono == aparelho {
            continue;
        }
        let ja = lidos.get(&dono).copied().unwrap_or(0);
        let mut ns: Vec<u32> = remoto.listar(&format!("eventos/{dono}"))?.iter().filter_map(|a| a.strip_suffix(".bin")?.parse().ok()).filter(|n| *n > ja).collect();
        ns.sort_unstable();
        out.extend(ns.into_iter().map(|n| (dono.clone(), n)));
    }
    Ok(out)
}

pub fn baixar_pacote(remoto: &dyn Remoto, f: &Familia, dono: &str, n: u32) -> R<Vec<Value>> {
    let bytes = remoto.baixar(&pacote::nome(dono, n))?.ok_or_else(|| format!("{} sumiu do repositório", pacote::nome(dono, n)))?;
    pacote::desempacotar(&f.chave_bytes()?, &f.familia_id, dono, n, &bytes)
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::remoto::Memoria;
    use serde_json::json;

    fn evs(ids: &[&str]) -> Vec<Value> {
        ids.iter().map(|i| json!({"id": i, "aparelho": "pc-a"})).collect()
    }

    #[test]
    fn envia_so_o_que_falta_e_o_outro_aparelho_recebe() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        let p1 = preparar_envio(&evs(&["1", "2"]), 0, 1);
        assert_eq!(enviar(&m, &f, "pc-a", &p1).unwrap(), (1, 2));
        let p2 = preparar_envio(&evs(&["1", "2", "3"]), 2, 2);
        assert_eq!(p2.len(), 1);
        assert_eq!(enviar(&m, &f, "pc-a", &p2).unwrap(), (2, 1));
        assert!(preparar_envio(&evs(&["1", "2", "3"]), 3, 3).is_empty());

        let mut lidos = BTreeMap::new();
        let novos = novos_pacotes(&m, "cel-b", &lidos).unwrap();
        assert_eq!(novos, [("pc-a".to_string(), 1), ("pc-a".to_string(), 2)]);
        let recebidos: Vec<Value> = novos.iter().flat_map(|(d, n)| baixar_pacote(&m, &f, d, *n).unwrap()).collect();
        assert_eq!(recebidos, evs(&["1", "2", "3"]));
        lidos.insert("pc-a".to_string(), 2);
        assert!(novos_pacotes(&m, "cel-b", &lidos).unwrap().is_empty());
        assert!(novos_pacotes(&m, "pc-a", &BTreeMap::new()).unwrap().is_empty(), "não lê a própria pasta");
    }

    #[test]
    fn pacote_de_outra_familia_nao_abre() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &preparar_envio(&evs(&["1"]), 0, 1)).unwrap();
        assert!(baixar_pacote(&m, &Familia::nova("a/b", "t"), "pc-a", 1).is_err());
    }

    #[test]
    fn envio_repetido_do_mesmo_numero_falha_sem_perder_contagem() {
        let m = Memoria::default();
        let f = Familia::nova("a/b", "t");
        enviar(&m, &f, "pc-a", &preparar_envio(&evs(&["1"]), 0, 1)).unwrap();
        assert!(enviar(&m, &f, "pc-a", &preparar_envio(&evs(&["9"]), 0, 1)).is_err());
    }
}
