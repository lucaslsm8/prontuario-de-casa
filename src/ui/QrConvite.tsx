// QR do convite, gerado aqui mesmo (nada de rede). Fundo branco fixo: leitores de QR precisam de contraste claro.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrConvite({ texto, tamanho = 208 }: { texto: string; tamanho?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    setUrl(null); setFalhou(false);
    QRCode.toDataURL(texto, { errorCorrectionLevel: 'L', margin: 2, width: tamanho * 2 })
      .then((u) => { if (vivo) setUrl(u); })
      .catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [texto, tamanho]);
  if (falhou) return <span style={{ fontSize: 13, color: 'var(--text-2)' }}>O convite é grande demais para um QR; copie o texto.</span>;
  if (!url) return null;
  return <img src={url} width={tamanho} height={tamanho} alt="QR do convite" style={{ alignSelf: 'center', background: '#fff', borderRadius: 'var(--r-sm, 8px)' }} />;
}
