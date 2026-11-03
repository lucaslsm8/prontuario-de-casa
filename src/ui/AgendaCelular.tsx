// Configurações (celular): pôr as minhas consultas na agenda do celular.
import { useEffect, useState } from 'react';
import { eu, useStore } from '../data/store';
import { HOJE } from '../data/tempo';
import { agendaCelularDisponivel, agendaEscolhida, escolherAgenda, eventosDaAgenda, listarCalendarios, type Calendario } from '../data/agendaCelular';
import { Chip, Row, Toggle } from './index';

export function AgendaCelular() {
  const { state, api } = useStore();
  const [escolhida, setEscolhida] = useState(agendaEscolhida);
  const [opcoes, setOpcoes] = useState<Calendario[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    const at = () => setEscolhida(agendaEscolhida());
    window.addEventListener('agenda-celular', at);
    return () => window.removeEventListener('agenda-celular', at);
  }, []);
  if (!agendaCelularDisponivel()) return null;

  const me = eu(state);
  const eventos = () => eventosDaAgenda(state.consultas, me.id, HOJE, me.curto);
  const usar = async (c: Calendario) => {
    setOcupado(true);
    try {
      await escolherAgenda({ id: c.id, nome: c.nome }, eventos());
      setOpcoes(null);
      api.toast({ texto: `Consultas na agenda “${c.nome}”` });
    } catch {
      api.toast({ texto: 'Não foi possível escrever na agenda do celular.' });
    } finally {
      setOcupado(false);
    }
  };
  const ligar = async (on: boolean) => {
    setOcupado(true);
    try {
      if (!on) {
        await escolherAgenda(null, []);
        setOpcoes(null);
        api.toast({ texto: 'Consultas tiradas da agenda do celular' });
        return;
      }
      const lista = await listarCalendarios();
      if (!lista.length) { api.toast({ texto: 'Nenhuma agenda do celular aceita eventos. Entre numa conta Google no celular.' }); return; }
      if (lista.length === 1) { await usar(lista[0]); return; }
      setOpcoes([...lista].sort((a, b) => Number(b.principal) - Number(a.principal)));
    } catch {
      api.toast({ texto: 'Sem permissão de agenda. Libere em Configurações do Android › Apps › Prontuário de Casa.' });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <Row
        mutedLabel={false}
        label={
          <span className="stack" style={{ gap: 2 }}>
            <span>Minhas consultas na agenda do celular</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{escolhida ? `Na agenda “${escolhida.nome}”. Quem marcar uma consulta para você, aparece lá.` : 'As consultas marcadas para você entram na agenda (Google Agenda) sozinhas.'}</span>
          </span>
        }
        valor={<Toggle on={!!escolhida || !!opcoes} onChange={(v) => { if (!ocupado) void ligar(v); }} label="Minhas consultas na agenda do celular" />}
      />
      {opcoes && (
        <div className="stack" style={{ gap: 8, padding: '4px 16px 14px' }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Em qual agenda?</span>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {opcoes.map((c) => (
              <Chip key={c.id} ativo={false} onClick={() => { if (!ocupado) void usar(c); }}>{c.conta && c.conta !== c.nome ? `${c.nome} · ${c.conta}` : c.nome}</Chip>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
