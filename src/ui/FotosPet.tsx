// Álbum de fotos do pet: grade quadrada, "Adicionar fotos", tela cheia e remover com desfazer.
// Cada foto é um anexo `tipo: 'foto'` com donoId = id do pet (cifrado no banco, vai no backup).
import { useState } from 'react';
import { useStore } from '../data/store';
import { fotosDoPet } from '../data/anexos';
import type { Pessoa } from '../data/types';
import { Miniatura, Visualizador, useEscolherArquivos } from './Anexos';

/** Seletor de fotos do pet (várias de uma vez); `abrir()` mostra a escolha. */
export function useAdicionarFotos(pet: Pessoa) {
  const { api } = useStore();
  return useEscolherArquivos(pet.id, 'foto', (lista) => {
    api.addAnexos(lista);
    api.toast({ texto: lista.length === 1 ? `Foto de ${pet.curto} guardada` : `${lista.length} fotos de ${pet.curto} guardadas` });
  }, { soFotos: true });
}

/** Grade de fotos; o quadrado tracejado no fim adiciona mais. */
export function FotosDoPet({ pet, seletor }: { pet: Pessoa; seletor: ReturnType<typeof useAdicionarFotos> }) {
  const { state, api } = useStore();
  const fotos = fotosDoPet(state.anexos, pet.id);
  const [aberta, setAberta] = useState<number | null>(null);
  return (
    <div className="fotos-pet">
      {fotos.map((f, n) => (
        <Miniatura key={f.id} anexo={f} onClick={() => setAberta(n)} onRemover={() => api.removerAnexo(f)} />
      ))}
      <button type="button" className="anexo anexo--add" onClick={seletor.abrir} disabled={seletor.lendo} aria-label={`Adicionar fotos de ${pet.curto}`}>
        {seletor.lendo ? '…' : '+'}
        <span>{fotos.length ? 'Mais fotos' : 'Adicionar fotos'}</span>
      </button>
      {seletor.elemento}
      {aberta != null && <Visualizador anexos={fotos} inicio={aberta} onClose={() => setAberta(null)} />}
    </div>
  );
}
