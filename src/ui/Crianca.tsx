// Crianças: curva de altura (com a mediana da OMS) e o calendário de vacinas do SUS.
// Na página da pessoa com menos de 18 anos (celular: aba Saúde; desktop: abas Medições e Vacinas).
import { useState } from 'react';
import { HOJE } from '../data/tempo';
import { useStore } from '../data/store';
import { calendarioSUS, curvaAltura, ehCrianca, idadeMeses, pendenciasSUS, type ItemCalendario } from '../data/criancas';
import { dataBR } from '../data/format';
import type { Pessoa } from '../data/types';
import { Grafico } from './Grafico';
import { cx } from '.';

/** Curva de altura × mediana da OMS. Sem medida de altura, explica como começar. */
export function CurvaCrescimento({ p, desktop }: { p: Pessoa; desktop?: boolean }) {
  const { state } = useStore();
  if (!ehCrianca(p, HOJE)) return null;
  const c = curvaAltura(p, state.medicoes);
  return (
    <div className="card" style={{ padding: desktop ? '16px 20px' : 14, gap: 8, fontSize: 14 }}>
      <span className="label">Crescimento</span>
      <Grafico
        rotulo="Altura e mediana da OMS"
        altura={desktop ? 200 : 160}
        casas={0}
        vazio={p.sexo ? 'Registre a altura (Medições) para ver a curva.' : 'Informe o sexo no perfil e registre a altura para ver a curva.'}
        series={[
          { nome: p.curto, cor: 'var(--teal)', pontos: c.crianca },
          ...(c.mediana.length ? [{ nome: 'Mediana da OMS', cor: 'var(--text-3)', pontos: c.mediana }] : []),
        ]}
      />
      {c.crianca.length > 0 && c.mediana.length > 0 && (
        <span className="muted" style={{ fontSize: 12 }}>
          Linha cinza: a altura do meio (mediana) para a idade e o sexo, pelos padrões da OMS. Estar acima ou abaixo é normal; o pediatra avalia a curva inteira.
        </span>
      )}
    </div>
  );
}

const COR: Record<ItemCalendario['estado'], string> = { feita: 'var(--teal)', atrasada: 'var(--danger)', agora: 'var(--warn-text)', depois: 'var(--text-3)' };
const TEXTO: Record<ItemCalendario['estado'], string> = { feita: 'feita', atrasada: 'atrasada', agora: 'nesta idade', depois: 'depois' };

/** Calendário do SUS: as doses até a idade de agora (mais as do próximo ano) e o que falta. */
export function CalendarioVacinas({ p, desktop }: { p: Pessoa; desktop?: boolean }) {
  const { state } = useStore();
  const [tudo, setTudo] = useState(false);
  if (!ehCrianca(p, HOJE) || !p.nascimento) return null;
  const registradas = state.vacinas.filter((v) => v.pessoaId === p.id);
  const itens = calendarioSUS(p.nascimento, registradas, HOJE);
  // Nenhuma vacina registrada ainda: não é atraso, é falta de registro.
  const semRegistro = registradas.length === 0;
  const idade = idadeMeses(p.nascimento, HOJE);
  const visiveis = tudo ? itens : itens.filter((i) => i.estado !== 'depois' || i.meses <= idade + 12);
  const { atrasadas, agora } = pendenciasSUS(itens);
  return (
    <div className="card" style={{ fontSize: 14 }}>
      <div className={cx('card-head', desktop && 'card-head--20')} style={desktop ? undefined : { padding: '12px 16px' }}>
        <span className="label">Calendário do SUS</span>
        <span style={{ fontSize: 13, color: atrasadas && !semRegistro ? 'var(--danger)' : 'var(--text-2)' }}>
          {semRegistro ? 'nenhuma registrada' : atrasadas ? `${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : agora ? `${agora} nesta idade` : 'em dia'}
        </span>
      </div>
      {visiveis.map((i) => (
        <div key={i.chave} className="row" style={{ padding: desktop ? '10px 20px' : '10px 16px', gap: 12 }}>
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <span style={{ fontWeight: 600 }}>{i.nome}</span>
            <span className="muted" style={{ fontSize: 12 }}>{i.quando} · {i.rotulo}</span>
          </span>
          <span style={{ fontSize: 12, color: semRegistro && i.estado === 'atrasada' ? 'var(--text-2)' : COR[i.estado], fontWeight: i.estado === 'atrasada' && !semRegistro ? 600 : 500, whiteSpace: 'nowrap' }}>
            {i.data ? <span className="mono">{dataBR(i.data)}</span> : semRegistro && i.estado === 'atrasada' ? 'sem registro' : TEXTO[i.estado]}
          </span>
        </div>
      ))}
      <div className="stack" style={{ padding: desktop ? '10px 20px 14px' : '10px 16px 14px', gap: 6 }}>
        {visiveis.length < itens.length && <button type="button" className="btn--link" style={{ alignSelf: 'flex-start', fontSize: 13, minHeight: 36 }} onClick={() => setTudo(true)}>Ver o calendário inteiro</button>}
        <span className="faint" style={{ fontSize: 12, lineHeight: 1.45 }}>
          Calendário Nacional de Vacinação (PNI), sem gripe e covid, que mudam a cada campanha. Registre as vacinas com o nome da carteirinha (Penta, VIP, Tetra viral…) e confirme no posto de saúde.
        </span>
      </div>
    </div>
  );
}
