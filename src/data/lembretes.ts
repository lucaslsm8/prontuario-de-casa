// Lembretes: transforma o estado nos avisos das próximas horas.
// Função pura (sem React nem Tauri), testada em lembretes.test.ts.
// O Rust recebe a lista e mostra cada aviso na hora (src-tauri/src/lembretes.rs).

import type { State } from './store';
import type { Pessoa } from './types';
import { NOMES_PREVENCAO, proximaPrevencao, ultimasPrevencoes, ultimasVacinas } from './pets';

export interface Lembrete {
  id: string;      // "dose|<remedioId>|<previstoPara>", "consulta|<id>|<antecedência>", "vacina|<id>" ou "prevencao|<id>"
  quando: string;  // hora local "2026-10-29T21:00"
  titulo: string;
  corpo: string;
  acoes: boolean;  // Tomei / Lembrar em 15 min / Pular esta dose
}

/** Rótulos do campo "Lembrar" da consulta (M18) → minutos antes. */
const ANTECEDENCIA_MIN: Record<string, number> = { '2 h antes': 120, '1 dia antes': 1440, '1 semana': 10080 };

/** Dose não registrada continua na lista por 24 h (para o "Lembrar em 15 min" valer); o Rust decide se ainda avisa. */
const PENDENTE_MAX_MIN = 24 * 60;
/** Consulta: quem abre o app logo depois do horário do lembrete ainda recebe o aviso. */
const CONSULTA_ATRASO_MAX_MIN = 30;

const dois = (n: number) => String(n).padStart(2, '0');
const texto = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
const data = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const [hh, mm] = s.length > 10 ? s.slice(11, 16).split(':').map(Number) : [0, 0];
  return new Date(y, m - 1, d, hh, mm);
};
const somarMin = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);
const diasEntre = (a: string, b: string) => Math.round((data(b.slice(0, 10)).getTime() - data(a.slice(0, 10)).getTime()) / 86_400_000);
const doDa = (p?: Pessoa) => (p?.sexo === 'Feminino' ? 'da' : 'do');

export function proximosLembretes(s: State, agora: Date, horas = 24): Lembrete[] {
  const iniDose = texto(somarMin(agora, -PENDENTE_MAX_MIN));
  const iniConsulta = texto(somarMin(agora, -CONSULTA_ATRASO_MAX_MIN));
  const fim = texto(somarMin(agora, horas * 60));
  const esconder = s.config.esconderNomeNotif;
  const out: Lembrete[] = [];

  const dias: string[] = [];
  for (let d = data(iniDose.slice(0, 10)); texto(d).slice(0, 10) <= fim.slice(0, 10); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    dias.push(texto(d).slice(0, 10));
  }

  for (const r of s.remedios) {
    if (!r.ativo || !r.lembrete || r.seNecessario) continue;
    const p = s.pessoas.find((x) => x.id === r.pessoaId);
    const nome = p?.curto ?? '';
    for (const dia of dias) {
      if ((r.inicio && dia < r.inicio) || (r.fim && dia > r.fim)) continue;
      for (const h of r.horarios) {
        const quando = `${dia}T${h}`;
        if (quando < iniDose || quando > fim) continue;
        if (s.doses.some((x) => x.remedioId === r.id && x.previstoPara === quando)) continue;
        out.push({
          id: `dose|${r.id}|${quando}`,
          quando,
          titulo: esconder ? `Hora do remédio ${doDa(p)} ${nome}` : `${r.nome} · ${nome}`,
          corpo: esconder ? `Abra para ver qual. 1 dose às ${h}.` : `${r.doseLonga ?? r.dose} às ${h}.`,
          acoes: true,
        });
      }
    }
  }

  const agoraTxt = texto(agora);
  for (const c of s.consultas) {
    const hora = `${c.data}T${c.hora}`;
    if (hora <= agoraTxt) continue;
    for (const rotulo of c.lembretes) {
      const min = ANTECEDENCIA_MIN[rotulo];
      if (min === undefined) continue;
      const quando = texto(somarMin(data(hora), -min));
      if (quando < iniConsulta || quando > fim) continue;
      const n = diasEntre(quando, c.data);
      const dia = n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`;
      out.push({
        id: `consulta|${c.id}|${rotulo}`,
        quando,
        titulo: `${c.titulo} ${dia} às ${c.hora}`,
        corpo: [c.profissional, c.local].filter(Boolean).join(' · '),
        acoes: false,
      });
    }
  }

  // Pets: reforço de vacina e próxima prevenção, às 09:00 do dia (mesma janela das consultas, sem ações).
  const HORA_PET = '09:00';
  const quandoDia = (iso: string) => `${iso}T${HORA_PET}`;
  const dentro = (q: string) => q >= iniConsulta && q <= fim;
  // Só a dose mais recente de cada vacina: um reforço já tomado não avisa de novo.
  for (const p of s.pessoas) {
    for (const v of ultimasVacinas(s, p.id)) {
      if (!v.proxima) continue;
      const quando = quandoDia(v.proxima);
      if (!dentro(quando)) continue;
      out.push({
        id: `vacina|${v.id}`,
        quando,
        titulo: `Vacina ${doDa(p)} ${p.curto}: ${v.nome} hoje`,
        corpo: ['Reforço', v.veterinario].filter(Boolean).join(' · '),
        acoes: false,
      });
    }
  }
  // Só a aplicação mais recente de cada tipo: trocar de produto substitui o lembrete do anterior.
  for (const p of s.pessoas) {
    for (const pr of ultimasPrevencoes(s, p.id)) {
      const quando = quandoDia(proximaPrevencao(pr));
      if (!dentro(quando)) continue;
      const que = pr.tipo === 'outro' ? pr.produto.trim() || 'Prevenção' : NOMES_PREVENCAO[pr.tipo];
      out.push({
        id: `prevencao|${pr.id}`,
        quando,
        titulo: `${que} ${doDa(p)} ${p.curto} hoje`,
        corpo: [pr.produto.trim(), `a cada ${pr.intervaloDias} dias`].filter(Boolean).join(' · '),
        acoes: false,
      });
    }
  }

  return out.sort((a, b) => a.quando.localeCompare(b.quando));
}
