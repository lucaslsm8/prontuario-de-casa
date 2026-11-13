// "Como ele é": a seção do formulário de remédio com o desenho do comprimido, a cartela e as fotos.
import { useId, type ReactNode } from 'react';
import { CORES_PILULA, FORMAS_PILULA, descricaoAparencia } from '../data/cartela';
import type { FormRemedio } from '../data/formularios';
import type { Aparencia, CorPilula } from '../data/types';
import { AnexosPendentes, GaleriaAnexos } from './Anexos';
import { useEscolherFoto } from './Foto';
import { Pilula } from './Pilula';
import { Toggle, cx } from '.';

function Grupo({ rotulo, desktop, children }: { rotulo: string; desktop?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <div className={desktop ? 'dfield dfield--span2' : 'field'} style={{ gap: 8 }} role="group" aria-labelledby={id}>
      <span id={id} className={desktop ? 'dfield__label' : 'field__label'}>{rotulo}</span>
      {children}
    </div>
  );
}

function Cores({ valor, onChange, rotulo }: { valor?: CorPilula; onChange: (c: CorPilula) => void; rotulo: string }) {
  return (
    <div className="aparencia__cores" role="radiogroup" aria-label={rotulo}>
      {CORES_PILULA.map((c) => (
        <button key={c.id} type="button" role="radio" className="aparencia__cor" style={{ background: c.hex }} aria-checked={valor === c.id} aria-pressed={valor === c.id} aria-label={c.nome} title={c.nome} onClick={() => onChange(c.id)} />
      ))}
    </div>
  );
}

/** `desktop`: rótulos e inputs do diálogo do desktop (dentro de DGrade). */
export function CamposAparencia({ f, desktop }: { f: FormRemedio; desktop?: boolean }) {
  const a = f.aparencia;
  const mudar = (p: Partial<Aparencia>) => f.setAparencia({ forma: 'redondo', cor: 'branco', ...a, ...p });
  const foto = useEscolherFoto((url) => f.setFotoComprimido(url));
  const input = cx('input input--mono', desktop && 'input--desk');
  const nome = [f.nome.trim(), f.dosagem.trim()].filter(Boolean).join(' ') || 'Remédio';

  return (
    <>
      {(a || f.fotoComprimido) && (
        <div className={cx('aparencia__previa', desktop && 'dfield--span2')}>
          <Pilula aparencia={a} foto={f.fotoComprimido} />
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <b>{nome}</b>
            <span className="muted" style={{ fontSize: 13 }}>{a ? descricaoAparencia(a) : 'Foto do comprimido'}</span>
          </span>
          {a && <button type="button" className="btn btn--h36" style={{ marginLeft: 'auto', color: 'var(--text-2)' }} onClick={() => f.setAparencia(undefined)}>Tirar desenho</button>}
        </div>
      )}
      <Grupo rotulo="Forma" desktop={desktop}>
        <div className="chips chips--6">
          {FORMAS_PILULA.map((x) => (
            <button key={x.id} type="button" className={cx('chip chip--sm aparencia__chip', a?.forma === x.id && 'is-teal')} aria-pressed={a?.forma === x.id} onClick={() => mudar({ forma: x.id })}>
              <Pilula aparencia={{ forma: x.id, cor: 'branco' }} />{x.nome}
            </button>
          ))}
        </div>
      </Grupo>
      {a && (
        <>
          <Grupo rotulo={a.forma === 'capsula' ? 'Cor de uma metade' : 'Cor'} desktop={desktop}>
            <Cores valor={a.cor} onChange={(cor) => mudar({ cor })} rotulo="Cor" />
          </Grupo>
          {a.forma === 'capsula' ? (
            <Grupo rotulo="Cor da outra metade" desktop={desktop}>
              <Cores valor={a.cor2 ?? a.cor} onChange={(cor2) => mudar({ cor2 })} rotulo="Cor da outra metade" />
            </Grupo>
          ) : (
            <div className={desktop ? 'dfield dfield--span2' : 'card'} style={desktop ? undefined : { padding: '4px 16px' }}>
              <div className="row row--tight" style={{ padding: desktop ? 0 : undefined }}>
                <span>Tem sulco no meio</span>
                <Toggle on={!!a.sulco} onChange={(v) => mudar({ sulco: v })} label="Tem sulco no meio" />
              </div>
            </div>
          )}
        </>
      )}
      <Grupo rotulo="Cartela (opcional)" desktop={desktop}>
        <span className="hstack" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 15 }}>
          <input className={input} style={{ width: 72 }} inputMode="numeric" value={f.porCartela} onChange={(e) => f.setPorCartela(e.target.value.replace(/\D/g, ''))} placeholder="14" aria-label="Comprimidos por cartela" />
          <span>por cartela, em</span>
          <input className={input} style={{ width: 56 }} inputMode="numeric" value={f.fileiras} onChange={(e) => f.setFileiras(e.target.value.replace(/\D/g, ''))} placeholder="2" aria-label="Fileiras" />
          <span>fileiras</span>
        </span>
        {!f.cartelaValida && <span style={{ fontSize: 13, color: 'var(--danger)' }}>Use de 1 a 200 por cartela, e no máximo uma fileira por comprimido.</span>}
      </Grupo>
      <Grupo rotulo="Foto do comprimido (opcional)" desktop={desktop}>
        <span className="hstack" style={{ gap: 10, alignItems: 'center' }}>
          {f.fotoComprimido && <span className="aparencia__foto"><img src={f.fotoComprimido} alt="Foto do comprimido" /></span>}
          <button type="button" className={cx('btn btn--soft', desktop ? 'btn--h40d' : 'btn--h40')} onClick={foto.abrir}>{f.fotoComprimido ? 'Trocar foto' : 'Fotografar comprimido'}</button>
          {f.fotoComprimido && <button type="button" className="btn btn--h40" style={{ color: 'var(--text-2)' }} onClick={() => f.setFotoComprimido(null)}>Tirar</button>}
        </span>
        {foto.elemento}
      </Grupo>
      <Grupo rotulo="Foto da cartela (opcional)" desktop={desktop}>
        {f.editando ? (
          <GaleriaAnexos donoId={f.id} tipo="cartela" />
        ) : (
          <AnexosPendentes donoId={f.id} tipo="cartela" lista={f.fotosCartela} onChange={f.setFotosCartela} />
        )}
      </Grupo>
    </>
  );
}
