// Início: qual dose vai no cartão escuro, o rótulo dele e a linha do dia.
// Funções puras (sem React), testadas em inicio.test.ts.

import type { DoseHoje } from './store';
import type { Exame, Remedio } from './types';

/** "06:30" → 390 */
export const minutos = (h: string) => {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
};
export const hhmm = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const chaveDose = (d: Pick<DoseHoje, 'horario'> & { remedio: { id: string } }) => `${d.remedio.id}|${d.horario}`;

/** Doses adiadas na tela ("Lembrar em 15 min"): chave → minuto do dia em que voltam. */
export type Adiadas = Record<string, number>;

/** Tolerância do "AGORA", em minutos, antes e depois do horário. */
const JANELA = 15;

export type Tom = 'atrasada' | 'agora' | 'proxima' | 'adiada';
export interface Foco { dose: DoseHoje; tom: Tom; rotulo: string }

const duracao = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} H` : '', m || !h ? `${m} MIN` : ''].filter(Boolean).join(' ');
};

/** A dose da vez: a primeira sem registro, pulando as adiadas até a hora em que voltam. */
export function doseEmFoco(doses: DoseHoje[], agora: number, adiadas: Adiadas = {}): Foco | undefined {
  const pendentes = doses.filter((d) => !d.dose).sort((a, b) => a.horario.localeCompare(b.horario));
  const daVez = pendentes.find((d) => (adiadas[chaveDose(d)] ?? 0) <= agora);
  if (daVez) {
    const dif = agora - minutos(daVez.horario);
    if (dif > JANELA) return { dose: daVez, tom: 'atrasada', rotulo: `ATRASADA HÁ ${duracao(dif)}` };
    if (dif >= -JANELA) return { dose: daVez, tom: 'agora', rotulo: 'AGORA' };
    return { dose: daVez, tom: 'proxima', rotulo: `PRÓXIMA · EM ${duracao(-dif)}` };
  }
  // Só sobraram adiadas: mostra a que volta primeiro.
  const adiada = [...pendentes].sort((a, b) => adiadas[chaveDose(a)] - adiadas[chaveDose(b)])[0];
  return adiada && { dose: adiada, tom: 'adiada', rotulo: `LEMBRAR ÀS ${hhmm(adiadas[chaveDose(adiada)])}` };
}

export type EstadoDose = 'tomada' | 'pulada' | 'atrasada' | 'futura';
export function estadoDose(d: DoseHoje, agora: number): EstadoDose {
  if (d.dose?.status === 'tomada') return 'tomada';
  if (d.dose) return 'pulada';
  return agora - minutos(d.horario) > JANELA ? 'atrasada' : 'futura';
}

/** Linha do dia: 06:00 → 0 %, 22:00 → 100 %; fora da faixa fica na ponta. */
export const INICIO_DIA = 6 * 60;
export const FIM_DIA = 22 * 60;
export const posDia = (min: number) => Math.max(0, Math.min(100, ((min - INICIO_DIA) / (FIM_DIA - INICIO_DIA)) * 100));

/** "Apoquel 16 mg" → ["Apoquel", "16 mg"]; sem concentração no fim, fica tudo no nome. */
export function separarConcentracao(nome: string): [string, string] {
  const m = nome.match(/^(.*\S)\s+(\d[\d.,]*\s*(?:mcg|mg|g|ml|mL|UI|%)(?:\/\S+)?)$/);
  return m ? [m[1], m[2]] : [nome, ''];
}

export const saudacao = (agora: number) => (agora < 12 * 60 ? 'Bom dia' : agora < 18 * 60 ? 'Boa tarde' : 'Boa noite');

// ---- Modo só de informações (Configurações): o Início mostra o que cada um toma, sem acompanhar doses. ----

/** Remédios em uso, na ordem do dia: primeiro horário; "se necessário" e sem horário no fim. */
export function remediosEmUso(remedios: Remedio[], hoje: string): Remedio[] {
  const primeiro = (r: Remedio) => (r.seNecessario || !r.horarios.length ? '99:99' : [...r.horarios].sort()[0]);
  return remedios
    .filter((r) => r.ativo && !(r.fim && r.fim < hoje))
    .sort((a, b) => primeiro(a).localeCompare(primeiro(b)) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** "08:00 e 20:00", "08:00, 14:00 e 20:00", "Se necessário", "Sem horário". */
export function textoHorarios(r: Pick<Remedio, 'horarios' | 'seNecessario'>): string {
  if (r.seNecessario) return 'Se necessário';
  const h = [...r.horarios].sort();
  if (!h.length) return 'Sem horário';
  return h.length === 1 ? h[0] : `${h.slice(0, -1).join(', ')} e ${h[h.length - 1]}`;
}

/** Exames mais recentes (até `n`), do mais novo para o mais antigo. */
export const examesRecentes = (exames: Exame[], n = 3) =>
  [...exames].sort((a, b) => b.dataColeta.localeCompare(a.dataColeta)).slice(0, n);

/** O próximo horário de remédio a partir de agora (minuto do dia); depois do último do dia, o primeiro de amanhã. */
export function proximoHorario(remedios: Pick<Remedio, 'horarios' | 'seNecessario'>[], agora: number): string | undefined {
  const todos = [...new Set(remedios.filter((r) => !r.seNecessario).flatMap((r) => r.horarios))].sort();
  return todos.find((h) => minutos(h) >= agora) ?? todos[0];
}
