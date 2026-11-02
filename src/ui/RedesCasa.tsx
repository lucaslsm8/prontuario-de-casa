// Privacidade › Bloqueio › Redes de casa: na rede cadastrada o app abre sem senha nem biometria.
// Por aparelho (kv cifrado), não sincroniza. Lista vazia = desligado.
import { useEffect, useState, type ComponentType } from 'react';
import { useStore } from '../data/store';
import { persistencia, type RedeCasa } from '../data/persistencia';
import { estaEmCasa } from '../data/redeCasa';
import { ConfirmarSheet } from './Confirmar';

type PropsConfirmar = { titulo: string; texto: string; confirmar: string; onConfirm: () => void; onClose: () => void };

export const AVISO_REDE_CASA = 'Quem pegar o aparelho dentro de casa abre o app sem senha. Os dados continuam cifrados. Quem estiver perto de casa consegue imitar a rede; use só se aceitar esse risco.';

/** Linhas para o cartão "Bloqueio". `Confirmar`: diálogo de confirmação (folha no celular, padrão). */
export function RedesCasa({ desktop, Confirmar = ConfirmarSheet }: { desktop?: boolean; Confirmar?: ComponentType<PropsConfirmar> }) {
  const { api } = useStore();
  const pad = desktop ? '14px 20px' : '12px 16px';
  const alvo = desktop ? undefined : 44;
  const [redes, setRedes] = useState<RedeCasa[]>([]);
  const [atual, setAtual] = useState<RedeCasa | null>(null);
  const [remover, setRemover] = useState<RedeCasa | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    persistencia.redesCasa().then((l) => { if (vivo) setRedes(l); }).catch(() => {});
    // Sem pedir permissão: só marca qual é a rede atual, se já der para saber.
    persistencia.redeAtual().then((r) => { if (vivo) setAtual(r); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const cadastrar = async () => {
    setOcupado(true);
    try {
      const r = await persistencia.redeAtual(true);
      if (!r) {
        api.toast({ texto: desktop ? 'Não deu para identificar a rede deste computador' : 'Não deu para identificar a rede. Conecte ao Wi-Fi e permita a localização.' });
        return;
      }
      setAtual(r);
      if (estaEmCasa(r, redes)) {
        api.toast({ texto: 'Esta rede já é de casa' });
        return;
      }
      setRedes(await persistencia.redeCasaAdicionar(r));
      api.toast({ texto: 'Rede de casa cadastrada' });
    } catch (e) {
      api.toast({ texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  };

  const confirmarRemocao = async () => {
    const r = remover;
    setRemover(null);
    if (!r) return;
    try {
      setRedes(await persistencia.redeCasaRemover(r.id));
      api.toast({ texto: 'Rede removida' });
    } catch (e) {
      api.toast({ texto: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <>
      <div className="row" style={{ padding: pad }}>
        <span className="stack" style={{ gap: 2 }}>
          <span>Redes de casa</span>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-3)' }}>{AVISO_REDE_CASA}</span>
        </span>
      </div>
      {redes.map((r) => (
        <div key={r.id} className="row" style={{ padding: pad, gap: 12 }}>
          <span className="stack" style={{ gap: 2, minWidth: 0, overflowWrap: 'anywhere' }}>
            <span>{r.nome}</span>
            {atual?.id === r.id && <span style={{ fontSize: 12, color: 'var(--teal)' }}>Você está nesta rede</span>}
          </span>
          <button type="button" className="btn btn--danger-link" style={{ minHeight: alvo, padding: '0 4px' }} onClick={() => setRemover(r)}>Remover</button>
        </div>
      ))}
      <div className="row" style={{ padding: pad }}>
        <button type="button" className="btn btn--link" style={{ minHeight: alvo, padding: 0 }} disabled={ocupado} onClick={() => void cadastrar()}>
          {ocupado ? 'Identificando a rede…' : 'Esta é a rede de casa'}
        </button>
      </div>
      {remover && (
        <Confirmar
          titulo={`Remover ${remover.nome}?`}
          texto="Nesta rede, o app volta a pedir senha ou biometria ao abrir."
          confirmar="Remover"
          onConfirm={() => void confirmarRemocao()}
          onClose={() => setRemover(null)}
        />
      )}
    </>
  );
}
