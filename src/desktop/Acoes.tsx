import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import type { Pessoa } from '../data/types';
import { DConfirmar } from './Formulario';
import { useAbrir } from './Shell';

/**
 * "Editar" (abre o diálogo `?abrir=<editar>`) e "Apagar" (pede confirmação; depois o aviso tem "Desfazer").
 * Sem `podeEditar`, não mostra nada.
 */
export function AcoesRegistro({ editar, apagar, podeEditar = true, tamanho = 'btn--h38' }: {
  editar?: string;
  apagar?: { titulo: string; texto: string; onConfirm: () => void };
  podeEditar?: boolean;
  tamanho?: string;
}) {
  const abrir = useAbrir();
  const [confirmar, setConfirmar] = useState(false);
  if (!podeEditar) return null;
  return (
    <>
      {editar && <button type="button" className={`btn btn--outline ${tamanho}`} onClick={() => abrir(editar)}>Editar</button>}
      {apagar && <button type="button" className={`btn btn--outline ${tamanho}`} style={{ color: 'var(--danger)' }} onClick={() => setConfirmar(true)}>Apagar</button>}
      {confirmar && apagar && (
        <DConfirmar
          titulo={apagar.titulo}
          texto={apagar.texto}
          confirmar="Apagar"
          perigo
          onConfirm={() => { setConfirmar(false); apagar.onConfirm(); }}
          onClose={() => setConfirmar(false)}
        />
      )}
    </>
  );
}

/** Remover pessoa ou pet: apaga tudo que é dela; confirma digitando o primeiro nome. */
export function RemoverPessoaDesktop({ p }: { p: Pessoa }) {
  const { api } = useStore();
  const nav = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  if (p.souEu) return null;
  const ok = texto.trim().toLowerCase() === p.curto.toLowerCase();
  return (
    <>
      <button type="button" className="btn btn--outline btn--h40d" style={{ color: 'var(--danger)' }} onClick={() => setAberto(true)}>Remover</button>
      {aberto && (
        <DConfirmar
          titulo={`Remover ${p.curto} do arquivo?`}
          texto={
            <span className="stack" style={{ gap: 12 }}>
              <span>Some {p.tipo === 'pet' ? 'o pet' : 'a pessoa'} e tudo que é dela: remédios, doses, consultas, exames, arquivos, medições e plano. Isso não dá para desfazer (a não ser restaurando um backup). Para confirmar, digite <b>{p.curto}</b>.</span>
              <input className="input input--desk" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label={`Digite ${p.curto} para confirmar`} autoFocus />
            </span>
          }
          confirmar="Remover"
          perigo
          desativado={!ok}
          onConfirm={() => { if (!ok) return; api.removerPessoa(p.id); api.toast({ texto: `${p.curto} removido do arquivo` }); nav('/'); }}
          onClose={() => { setAberto(false); setTexto(''); }}
        />
      )}
    </>
  );
}
