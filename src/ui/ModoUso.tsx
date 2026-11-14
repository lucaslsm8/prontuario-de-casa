// Configurações › Modo de uso: acompanhar as doses do dia ou só guardar as informações. Vale para este aparelho.
import { useStore } from '../data/store';
import { Segmented } from '.';

export function ModoUso() {
  const { state, api } = useStore();
  const info = !!state.config.modoInfo;
  const trocar = (v: string) => {
    const modoInfo = v === 'info';
    if (modoInfo === info) return;
    api.setConfig({ modoInfo });
    api.toast({ texto: modoInfo ? 'Modo só de informações neste aparelho' : 'Acompanhamento das doses ligado' });
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Segmented opcoes={[{ id: 'doses', nome: 'Acompanhar doses' }, { id: 'info', nome: 'Só informações' }]} valor={info ? 'info' : 'doses'} onChange={trocar} />
      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)' }}>
        {info
          ? 'O app mostra o que cada um toma, como é o remédio e a que horas, sem marcar doses, controlar estoque nem lembrar das doses. Lembretes de consultas e vacinas continuam. Vale só para este aparelho.'
          : 'O Início mostra a dose da vez com Tomei, 15 min e Pular, as doses do dia e o remédio acabando. Os lembretes avisam no horário de cada dose.'}
      </span>
    </div>
  );
}
