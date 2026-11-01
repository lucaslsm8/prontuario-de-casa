import { useRef } from 'react';
import { useStore } from '../data/store';
import { reduzirFoto } from '../data/perfil';
import type { Pessoa } from '../data/types';
import { Avatar, cx } from './index';

export type Seletor = ReturnType<typeof useEscolherFoto>;

/** Seletor de imagem escondido: `abrir()` abre a escolha; o data URL reduzido chega em `onFoto`. */
export function useEscolherFoto(onFoto: (dataUrl: string) => void) {
  const { api } = useStore();
  const input = useRef<HTMLInputElement>(null);

  async function escolher(file: File | undefined) {
    if (!file) return;
    try {
      onFoto(await reduzirFoto(file));
    } catch {
      api.toast({ texto: 'Não foi possível usar essa imagem.' });
    }
  }

  const elemento = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void escolher(f); }}
    />
  );
  return { abrir: () => input.current?.click(), elemento };
}

/** Avatar com faixa "Adicionar foto"/"Trocar foto" (abaixo de 80 px, só "Foto"). Entrega o data URL reduzido em `onFoto`. */
export function TrocarFoto({ pessoa, tamanho, onFoto, seletor }: { pessoa: Pessoa; tamanho: number; onFoto: (dataUrl: string) => void; seletor?: Seletor }) {
  const proprio = useEscolherFoto(onFoto);
  // Com `seletor` externo, o input de arquivo é o dele (um só por diálogo) e este não renderiza outro.
  const { abrir, elemento } = seletor ?? proprio;
  const verbo = pessoa.foto ? 'Trocar foto' : 'Adicionar foto';
  const faixa = tamanho < 80 ? 'Foto' : verbo;

  return (
    <>
      <button type="button" className={cx('foto-troca', tamanho < 80 && 'foto-troca--curta')} style={{ width: tamanho, height: tamanho }} aria-label={`${verbo} de ${pessoa.curto}`} onClick={abrir}>
        <Avatar pessoa={pessoa} size={tamanho} />
        <span className="foto-troca__faixa" aria-hidden>{faixa}</span>
      </button>
      {!seletor && elemento}
    </>
  );
}

/** Troca a foto e salva na hora. Sem permissão, mostra só o avatar. */
export function FotoDoPerfil({ pessoa, tamanho, podeEditar }: { pessoa: Pessoa; tamanho: number; podeEditar: boolean }) {
  const { api } = useStore();
  if (!podeEditar) return <Avatar pessoa={pessoa} size={tamanho} />;
  return (
    <TrocarFoto
      pessoa={pessoa}
      tamanho={tamanho}
      onFoto={(foto) => { api.editarPessoa(pessoa.id, { foto }); api.toast({ texto: 'Foto atualizada' }); }}
    />
  );
}
