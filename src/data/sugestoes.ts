// Sugestões para os campos de texto livre (o usuário pode escrever qualquer outra coisa).
import type { TipoCondicao } from './perfil';

export const SUGESTOES_CONDICAO = [
  'Hipertensão arterial', 'Diabetes tipo 1', 'Diabetes tipo 2', 'Pré-diabetes', 'Colesterol alto', 'Triglicerídeos altos',
  'Hipotireoidismo', 'Hipertireoidismo', 'Obesidade', 'Asma', 'Bronquite crônica', 'DPOC', 'Rinite alérgica', 'Sinusite crônica',
  'Enxaqueca', 'Epilepsia', 'Ansiedade', 'Depressão', 'Transtorno bipolar', 'TDAH', 'Insônia', 'Apneia do sono',
  'Gastrite', 'Refluxo (DRGE)', 'Síndrome do intestino irritável', 'Doença celíaca', 'Intolerância à lactose', 'Doença de Crohn',
  'Arritmia', 'Insuficiência cardíaca', 'Doença arterial coronariana', 'Varizes', 'Trombose',
  'Artrose', 'Artrite reumatoide', 'Osteoporose', 'Fibromialgia', 'Hérnia de disco', 'Gota',
  'Doença renal crônica', 'Cálculo renal', 'Hiperplasia de próstata', 'Endometriose', 'Ovário policístico (SOP)', 'Menopausa',
  'Anemia', 'Psoríase', 'Dermatite atópica', 'Glaucoma', 'Catarata', 'Hepatite', 'HIV', 'Câncer (em tratamento)', 'Câncer (em remissão)',
];

export const SUGESTOES_CIRURGIA = [
  'Apendicectomia', 'Cirurgia de vesícula (colecistectomia)', 'Cesárea', 'Hérnia inguinal', 'Hérnia umbilical', 'Amigdalectomia',
  'Adenoidectomia', 'Catarata', 'Cirurgia refrativa (miopia)', 'Histerectomia', 'Laqueadura', 'Vasectomia', 'Bariátrica',
  'Angioplastia / stent', 'Ponte de safena', 'Marca-passo', 'Prótese de joelho', 'Prótese de quadril', 'Artroscopia de joelho',
  'Cirurgia de coluna', 'Tireoidectomia', 'Mastectomia', 'Retirada de pedra nos rins', 'Septoplastia', 'Varizes',
];

export const SUGESTOES_VACINA = [
  'Gripe (influenza)', 'Covid-19', 'Hepatite B', 'Hepatite A', 'Tétano / difteria (dT)', 'dTpa', 'Febre amarela', 'Tríplice viral',
  'HPV', 'Pneumocócica', 'Meningocócica', 'Herpes-zóster', 'Dengue', 'Varicela', 'BCG',
];

export const SUGESTOES_ALERGIA = [
  'Dipirona', 'Penicilina', 'Amoxicilina', 'Cefalosporinas', 'Sulfa', 'AAS (aspirina)', 'Ibuprofeno', 'Anti-inflamatórios (AINEs)',
  'Codeína', 'Morfina', 'Contraste iodado', 'Iodo', 'Látex', 'Esparadrapo', 'Níquel',
  'Amendoim', 'Castanhas', 'Leite', 'Ovo', 'Trigo', 'Soja', 'Peixe', 'Frutos do mar', 'Camarão',
  'Picada de abelha', 'Picada de formiga', 'Ácaros', 'Pólen', 'Pelo de gato', 'Pelo de cachorro', 'Mofo',
];

export const SUGESTOES_REACAO = ['Urticária', 'Coceira', 'Inchaço', 'Falta de ar', 'Anafilaxia', 'Vermelhidão', 'Vômito', 'Diarreia', 'Espirros', 'Febre'];

export const LISTA_POR_TIPO: Record<TipoCondicao, string> = { condicao: 'sug-condicao', cirurgia: 'sug-cirurgia', vacina: 'sug-vacina' };
