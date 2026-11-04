import { useEffect, useRef, useState, type PointerEvent as PE } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../data/store';
import { carregarImagem, fotoDoRecorte, recorteDaVista, type ImagemCarregada } from '../data/perfil';
import type { Pessoa } from '../data/types';
import { Avatar, cx } from './index';

export type Seletor = ReturnType<typeof useEscolherFoto>;

/** Seletor de imagem escondido: `abrir()` abre a escolha, a pessoa ajusta o recorte e o data URL reduzido chega em `onFoto`. */
export function useEscolherFoto(onFoto: (dataUrl: string) => void) {
  const { api } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [imagem, setImagem] = useState<ImagemCarregada | null>(null);

  async function escolher(file: File | undefined) {
    if (!file) return;
    try {
      setImagem(await carregarImagem(file));
    } catch {
      api.toast({ texto: 'Não foi possível usar essa imagem.' });
    }
  }

  const elemento = (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void escolher(f); }}
      />
      {imagem && (
        <RecortarFoto
          imagem={imagem}
          onCancelar={() => setImagem(null)}
          onUsar={(r) => {
            try { onFoto(fotoDoRecorte(imagem, r)); } catch { api.toast({ texto: 'Não foi possível usar essa imagem.' }); }
            setImagem(null);
          }}
        />
      )}
    </>
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

const ZOOM_MAX = 4;
const preso = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/**
 * Ajuste da foto antes de salvar: arrastar move, pinça / roda do mouse / botões / barra dão zoom.
 * O círculo mostra como fica o avatar; o que sai é o quadrado em volta dele.
 */
export function RecortarFoto({ imagem, onUsar, onCancelar }: {
  imagem: ImagemCarregada; onUsar: (r: { sx: number; sy: number; lado: number }) => void; onCancelar: () => void;
}) {
  const { w, h } = imagem;
  const [zoom, setZoom] = useState(1);
  const [centro, setCentro] = useState({ x: w / 2, y: h / 2 });
  const [url, setUrl] = useState('');
  const area = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState(280);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const pinca = useRef<number | null>(null);

  useEffect(() => { setUrl(imagem.canvas.toDataURL('image/jpeg', 0.9)); }, [imagem]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const medir = () => setLado(el.clientWidth || 280);
    medir();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  // Esc fecha só o ajuste (o diálogo de baixo fica aberto).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancelar(); } };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [onCancelar]);

  const r = recorteDaVista(w, h, zoom, centro.x, centro.y);
  const escala = lado / r.lado;
  // O centro guardado é sempre o do recorte válido (não "gruda" além da borda).
  // Vários eventos de ponteiro podem chegar antes de um render: a vista atual fica também numa ref.
  const vista = useRef({ zoom, centro });
  const fixar = (z: number, c: { x: number; y: number }) => {
    const nz = preso(z, 1, ZOOM_MAX);
    const nr = recorteDaVista(w, h, nz, c.x, c.y);
    const nc = { x: nr.sx + nr.lado / 2, y: nr.sy + nr.lado / 2 };
    vista.current = { zoom: nz, centro: nc };
    setZoom(nz);
    setCentro(nc);
  };

  const baixo = (e: PE<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinca.current = null;
  };
  const mover = (e: PE<HTMLDivElement>) => {
    const antes = toques.current.get(e.pointerId);
    if (!antes) return;
    const agora = { x: e.clientX, y: e.clientY };
    toques.current.set(e.pointerId, agora);
    const pts = [...toques.current.values()];
    const v = vista.current;
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinca.current) fixar(v.zoom * (d / pinca.current), v.centro);
      pinca.current = d;
      return;
    }
    const k = lado / (Math.min(w, h) / v.zoom);
    fixar(v.zoom, { x: v.centro.x - (agora.x - antes.x) / k, y: v.centro.y - (agora.y - antes.y) / k });
  };
  const soltar = (e: PE<HTMLDivElement>) => { toques.current.delete(e.pointerId); pinca.current = null; };

  // Portal no body: dentro de um diálogo com animação (transform), o position: fixed ficaria preso a ele.
  return createPortal(
    <div className="recorte" role="dialog" aria-label="Ajustar foto" onClick={(e) => e.stopPropagation()}>
      <div className="recorte__painel">
        <span style={{ fontSize: 18, fontWeight: 600 }}>Ajustar foto</span>
        <div
          ref={area}
          className="recorte__area"
          onPointerDown={baixo}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onWheel={(e) => fixar(vista.current.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), vista.current.centro)}
        >
          {url && (
            <img
              src={url}
              alt=""
              draggable={false}
              style={{ width: w * escala, height: h * escala, transform: `translate(${-r.sx * escala}px, ${-r.sy * escala}px)` }}
            />
          )}
          <span className="recorte__circulo" aria-hidden />
        </div>
        <div className="hstack" style={{ gap: 10 }}>
          <button type="button" className="btn btn--outline recorte__zoom" onClick={() => fixar(zoom / 1.25, centro)} aria-label="Diminuir zoom" disabled={zoom <= 1}>−</button>
          <input
            type="range"
            min={1}
            max={ZOOM_MAX}
            step={0.01}
            value={zoom}
            onChange={(e) => fixar(Number(e.target.value), centro)}
            aria-label="Zoom"
            style={{ flex: 1, accentColor: 'var(--teal)' }}
          />
          <button type="button" className="btn btn--outline recorte__zoom" onClick={() => fixar(zoom * 1.25, centro)} aria-label="Aumentar zoom" disabled={zoom >= ZOOM_MAX}>+</button>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'center' }}>Arraste para mover. Use a pinça, a roda do mouse ou a barra para o zoom.</span>
        <div className="hstack" style={{ gap: 8 }}>
          <button type="button" className="btn btn--outline btn--h50 btn--grow" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="btn btn--teal btn--h50 btn--grow" onClick={() => onUsar(r)}>Usar foto</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
