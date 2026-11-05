// Celular: a linha de cada pessoa no seletor de perfil diz o que está pendente com ela agora.
import type { DoseHoje } from './store';
import type { Consulta, Remedio } from './types';
import { diaMes, estoqueBaixo } from './format';
import { estadoDose, minutos, separarConcentracao } from './inicio';

export interface Pendencia { texto: string; alerta: boolean }

/** Janela de "Dose agora" (minutos antes do horário). */
const AGORA = 15;

/**
 * Por ordem: doses atrasadas, dose agora, remédio acabando, próxima consulta, "Tudo em dia".
 * `doses`, `remedios` e `consultas` já são só da pessoa.
 */
export function pendenciaDoPerfil(doses: DoseHoje[], remedios: Remedio[], consultas: Consulta[], agora: number, hoje: string): Pendencia {
  const atrasadas = doses.filter((d) => estadoDose(d, agora) === 'atrasada').length;
  if (atrasadas) return { texto: atrasadas === 1 ? '1 dose atrasada' : `${atrasadas} doses atrasadas`, alerta: true };
  if (doses.some((d) => !d.dose && Math.abs(minutos(d.horario) - agora) <= AGORA)) return { texto: 'Dose agora', alerta: true };
  const acabando = remedios.find((r) => r.ativo && estoqueBaixo(r));
  if (acabando) return { texto: `${separarConcentracao(acabando.nome)[0]} acabando`, alerta: true };
  const prox = consultas.filter((c) => c.data >= hoje).sort((a, b) => `${a.data}${a.hora ?? ''}`.localeCompare(`${b.data}${b.hora ?? ''}`))[0];
  if (prox) return { texto: `${prox.titulo} · ${diaMes(prox.data)}`, alerta: false };
  return { texto: 'Tudo em dia', alerta: false };
}
