import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import type { Pessoa } from '../data/types';

/** Folha de confirmação do celular para ações destrutivas (apagar, encerrar…). */
export function ConfirmarSheet({ titulo, texto, confirmar, onConfirm, onClose }: { titulo: string; texto: string; confirmar: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="alertdialog" aria-modal="true" aria-label={titulo}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>{titulo}</span>
        <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>{texto}</span>
        <button type="button" className="btn btn--h50" style={{ background: 'var(--danger)', color: '#fff' }} onClick={onConfirm}>{confirmar}</button>
        <button type="button" className="btn btn--outline btn--h50" onClick={onClose}>Cancelar</button>
      </div>
    </>
  );
}

/** "Remover do arquivo" (celular): some a pessoa ou o pet e tudo que é dela; confirma digitando o nome. */
export function RemoverPessoaMobile({ p }: { p: Pessoa }) {
  const { api } = useStore();
  const nav = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  if (p.souEu) return null;
  const ok = texto.trim().toLowerCase() === p.curto.toLowerCase();
  return (
    <>
      <button type="button" className="btn btn--danger-link" style={{ minHeight: 44, fontSize: 15 }} onClick={() => setAberto(true)}>Remover {p.curto} do arquivo</button>
      {aberto && (
        <>
          <div className="overlay" onClick={() => setAberto(false)} />
          <div className="sheet" role="alertdialog" aria-modal="true" aria-label={`Remover ${p.curto}`}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>Remover {p.curto}?</span>
            <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.45 }}>
              Some tudo que é {p.tipo === 'pet' ? 'do pet' : 'dela'}: remédios, consultas, exames, arquivos, medições e plano. Não dá para desfazer. Digite <b>{p.curto}</b> para confirmar.
            </span>
            <input className="input input--50" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label={`Digite ${p.curto} para confirmar`} />
            <button type="button" className="btn btn--h50" disabled={!ok} style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => { api.removerPessoa(p.id); api.toast({ texto: `${p.curto} removido do arquivo` }); nav('/familia'); }}>
              Remover
            </button>
            <button type="button" className="btn btn--outline btn--h50" onClick={() => setAberto(false)}>Cancelar</button>
          </div>
        </>
      )}
    </>
  );
}
