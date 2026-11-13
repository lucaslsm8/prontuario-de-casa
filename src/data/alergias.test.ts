import { describe, expect, it } from 'vitest';
import { alergiasDoRemedio, textoAvisoAlergia } from './alergias';

const al = (substancia: string, reacao?: string) => ({ substancia, reacao });

describe('alergia × remédio', () => {
  it('bate pelo nome, sem acento e sem caixa', () => {
    expect(alergiasDoRemedio('Dipirona 500 mg', [al('dipirona')])).toHaveLength(1);
    expect(alergiasDoRemedio('Ácido acetilsalicílico', [al('acido acetilsalicilico')])).toHaveLength(1);
    expect(alergiasDoRemedio('Losartana 50 mg', [al('Dipirona')])).toHaveLength(0);
  });
  it('bate pela família do remédio', () => {
    const [av] = alergiasDoRemedio('Amoxicilina 500 mg', [al('Penicilina', 'urticária')]);
    expect(av.porFamilia).toBe('penicilinas');
    expect(textoAvisoAlergia(av, 'Amoxicilina 500 mg')).toBe('Alergia a Penicilina (urticária) · Amoxicilina é da família das penicilinas.');
    expect(alergiasDoRemedio('Ibuprofeno 600 mg', [al('anti-inflamatórios')])[0].porFamilia).toBe('anti-inflamatórios');
    expect(alergiasDoRemedio('Bactrim F', [al('sulfa')])).toHaveLength(1);
  });
  it('não avisa com textos curtos ou sem relação', () => {
    expect(alergiasDoRemedio('Am', [al('Amoxicilina')])).toHaveLength(0);
    expect(alergiasDoRemedio('Vitamina D', [al('camarão'), al('pó')])).toHaveLength(0);
  });
});
