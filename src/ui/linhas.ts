import type { KeyboardEvent } from 'react';

/**
 * Enter num item de lista editável (contrato: o item tem `data-item`, os campos `data-campo`).
 * Vai para o próximo campo do item; no último, chama `adicionar` (não envia o formulário).
 */
export function enterNaLinha(e: KeyboardEvent<HTMLElement>, adicionar: () => void) {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
  e.preventDefault();
  const campos = Array.from(e.currentTarget.closest('[data-item]')?.querySelectorAll<HTMLElement>('[data-campo]') ?? []);
  const i = campos.indexOf(e.currentTarget);
  if (i >= 0 && i < campos.length - 1) campos[i + 1].focus();
  else adicionar();
}
