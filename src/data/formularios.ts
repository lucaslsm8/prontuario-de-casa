import { useEffect, useRef, useState } from 'react';
import { HOJE, ex } from './tempo';
import { eu, useStore } from './store';
import { addDias, dataBR, diasEntre } from './format';
import { novoId } from './persistencia';
import { anexosDe, ehPdf, tamanhoDataUrl } from './anexos';
import { GOTAS_POR_ML, lerCartela } from './cartela';
import { lerTrajeto } from './consultas';
import { lerDosPdfs } from './pdf';
import type { Anexo, Aparencia, CategoriaExame, Resultado, Consulta, Exame, Medicao, Pesagem, Pessoa, Plano, Prevencao, Procedimento, Remedio, Sintoma, TipoMedicao, TipoProcedimento, Vacina } from './types';
import { SINAIS, ehPet, familia, pets } from './pets';
import { diffPessoa, formDePessoa, lerNumeroBR, normalizarTexto, novaChave, pessoaDoForm, type ErrosPerfil, type FormPerfil, type FormPet, type LinhaAlergia, type LinhaCondicao } from './perfil';
import {
  CORES, FORMAS_REMEDIO, FREQUENCIAS, brParaISO, lerDose, lerQuantidade, montarDose, textoQuantidade, diffRegistro, freqDoRemedio, lerHorarios, nomeComDosagem, partesDoRemedio, dataDoReforco, isoParaBR, juntarDataHora, lerDataHora, lerDataRegistro, lerIntervaloDias, lerNascimento,
  lerReforco, mascaraData, mascaraValidade, montarPlano, normalizarHora, somarDias, type AtalhoReforco, type ErrosPlano, type FormPlano, type Frequencia,
} from './formularios-puro';
import { mascararTelefone } from './format';
import { infoMedicao, montarMedicao, type ErrosMedicao, type FormMedicao } from './medicoes';

// Listas e funções puras ficam em formularios-puro.ts (sem depender do store); reexportadas aqui.
export * from './formularios-puro';

// ── Remédio ─────────────────────────────────────────────────────────────────

/** Novo remédio, ou edição de `inicial` (salva só o que mudou). */
export function useFormRemedio(onSalvo: () => void, inicial?: Remedio) {
  const { state, api, perfil } = useStore();
  const [partes] = useState(() => (inicial ? partesDoRemedio(inicial) : ex<[string, string]>(['Amoxicilina', '500 mg'], ['', ''])));
  const [nome, setNome] = useState(partes[0]);
  const [dosagem, setDosagem] = useState(partes[1]);
  const [indicacao, setIndicacao] = useState(inicial?.indicacao ?? ex('Infecção de garganta', ''));
  const [para, setPara] = useState(inicial?.pessoaId ?? perfil ?? eu(state).id);
  // Dose = quantidade + forma ("2" + comprimido, "20" + gota). A forma define a unidade do estoque.
  const [doseIni] = useState(() => lerDose(inicial ? inicial.doseLonga ?? inicial.dose : ex('1 cápsula', '1 comprimido')));
  const [qtdDose, setQtdDose] = useState(doseIni.qtd);
  const [forma, setForma] = useState(doseIni.forma);
  const qtdNum = lerQuantidade(qtdDose);
  const montada = montarDose(qtdNum ?? 1, forma);
  const dose = montada.doseLonga;
  /** Compatível com a lista antiga de doses ("2 comprimidos"). */
  const setDose = (v: string) => { const d = lerDose(v); setQtdDose(d.qtd); setForma(d.forma); };
  const [freq, setFreqBruta] = useState<Frequencia>(inicial ? freqDoRemedio(inicial) : ex(FREQUENCIAS[2], FREQUENCIAS[0]));
  const [horariosTexto, setHorariosTexto] = useState((inicial?.horarios ?? freq.horarios).join(', '));
  const inicio = inicial?.inicio ?? HOJE;
  const [duracao, setDuracao] = useState(inicial ? (inicial.fim ? Math.max(1, diasEntre(inicio, inicial.fim)) : 0) : ex(7, 0));
  const [lembrete, setLembrete] = useState(inicial?.lembrete ?? true);
  const [estoque, setEstoque] = useState(inicial ? inicial.estoque ?? 0 : ex(21, 30));
  const [avisar, setAvisar] = useState(inicial?.avisarDias ?? 3);
  const [observacao, setObservacao] = useState(inicial?.observacao ?? '');
  const [receitadoPor, setReceitadoPor] = useState(inicial?.receitadoPor ?? '');
  const fim = addDias(inicio, duracao);
  const unidade = montada.unidade;
  const comCartela = !!FORMAS_REMEDIO.find((x) => x.id === forma)?.cartela;
  // Gotas e mL: tamanho do frasco em mL (guardado na unidade do estoque: gotas = mL × 20).
  const liquido = unidade === 'gotas' || unidade === 'mL';
  const [frascoMl, setFrascoMl] = useState(inicial?.frasco ? textoQuantidade(inicial.unidade === 'gotas' ? inicial.frasco / GOTAS_POR_ML : inicial.frasco) : '');
  const frascoNum = lerQuantidade(frascoMl);
  const frascoValido = !liquido || !frascoMl.trim() || frascoNum != null;
  const [id] = useState(() => inicial?.id ?? `rem-${novoId()}`);
  const [receita, setReceita] = useState<Anexo[]>([]);
  // "Como ele é": desenho do comprimido, tamanho da cartela e fotos.
  const [aparencia, setAparencia] = useState<Aparencia | undefined>(inicial?.aparencia);
  const [porCartela, setPorCartela] = useState(inicial?.cartela ? String(inicial.cartela.porCartela) : '');
  const [fileiras, setFileiras] = useState(inicial?.cartela ? String(inicial.cartela.fileiras) : '');
  const cartela = lerCartela(porCartela, fileiras);
  const cartelaValida = !porCartela.trim() || !!cartela;
  const fotoSalva = anexosDe(state.anexos, id, 'comprimido').sort((a, b) => b.em.localeCompare(a.em))[0]?.dados;
  /** Foto nova do comprimido (data URL recortado), `null` = tirar a que está salva. */
  const [fotoNova, setFotoComprimido] = useState<string | null | undefined>();
  const fotoComprimido = fotoNova === null ? undefined : fotoNova ?? fotoSalva;
  const [fotosCartela, setFotosCartela] = useState<Anexo[]>([]);
  /** Trocar a frequência repõe os horários padrão dela. */
  const setFreq = (f: Frequencia) => { setFreqBruta(f); setHorariosTexto(f.horarios.join(', ')); };
  const lidos = lerHorarios(horariosTexto);
  const horarios = freq.id === 'sn' ? [] : lidos?.length ? lidos : undefined;

  const salvar = () => {
    if (!horarios) { api.toast({ texto: 'Horários assim: 08:00, 20:00' }); return; }
    if (!cartelaValida) { api.toast({ texto: 'Cartela: quantos comprimidos (1 a 200) e fileiras' }); return; }
    const remedio: Remedio = {
      ...(inicial ?? { ativo: true }),
      id,
      pessoaId: para,
      nome: nomeComDosagem(nome, dosagem),
      dosagem: nomeComDosagem('', dosagem) || undefined,
      indicacao: indicacao.trim() || undefined,
      dose: montada.dose,
      doseLonga: montada.doseLonga,
      unidade,
      frequencia: freq.nome,
      horarios,
      continuo: duracao === 0,
      seNecessario: freq.id === 'sn' || undefined,
      inicio,
      fim: duracao ? fim : undefined,
      estoque,
      avisarDias: avisar,
      lembrete,
      observacao: observacao.trim() || undefined,
      receitadoPor: receitadoPor.trim() || undefined,
      // Gotas, mL etc. não têm cartela nem desenho de comprimido.
      aparencia: comCartela && aparencia ? (aparencia.forma === 'capsula' ? { ...aparencia, sulco: undefined } : { ...aparencia, cor2: undefined }) : undefined,
      cartela: comCartela ? cartela : undefined,
      frasco: liquido && frascoNum ? Math.round(frascoNum * (unidade === 'gotas' ? GOTAS_POR_ML : 1)) : undefined,
    } as Remedio;
    if (inicial) {
      api.editar('remedios', id, diffRegistro(inicial, remedio), `${remedio.nome} atualizado`);
    } else {
      api.addRemedio(remedio);
      api.addAnexos([...receita, ...fotosCartela]);
      api.toast({ texto: `${remedio.nome} salvo` });
    }
    // Foto do comprimido: uma só; a nova substitui a anterior.
    if (fotoNova !== undefined) {
      anexosDe(state.anexos, id, 'comprimido').forEach((a) => api.removerAnexo(a));
      if (fotoNova) api.addAnexos([{ id: `anx-${novoId()}`, donoId: id, tipo: 'comprimido', nome: 'Comprimido.jpg', mime: 'image/jpeg', dados: fotoNova, tamanho: tamanhoDataUrl(fotoNova), em: new Date().toISOString() }]);
    }
    onSalvo();
  };

  return {
    nome, setNome, dosagem, setDosagem, indicacao, setIndicacao, para, setPara, dose, setDose, freq, setFreq, duracao, setDuracao, horariosTexto, setHorariosTexto, horariosValidos: !!horarios,
    /** Ao sair do campo: "22" → "22:00", "8h30, 21" → "08:30, 21:00". */
    completarHorarios: () => { if (lidos?.length) setHorariosTexto(lidos.join(', ')); },
    lembrete, setLembrete, estoque, setEstoque, avisar, setAvisar, observacao, setObservacao, receitadoPor, setReceitadoPor, fim, unidade, editando: !!inicial,
    id, receita, setReceita, valido: !!nome.trim() && !!horarios && cartelaValida && qtdNum != null && frascoValido, salvar,
    liquido, frascoMl, setFrascoMl, frascoValido,
    qtdDose, setQtdDose, forma, setForma, qtdValida: qtdNum != null, comCartela,
    aparencia, setAparencia, porCartela, setPorCartela, fileiras, setFileiras, cartelaValida,
    fotoComprimido, setFotoComprimido, fotosCartela, setFotosCartela,
  };
}
export type FormRemedio = ReturnType<typeof useFormRemedio>;

// ── Consulta ────────────────────────────────────────────────────────────────

/** `desktop`: data/hora com máscara, salvar só com data e hora lidas, e erro com o formato dos campos separados. */
export function useFormConsulta(onSalvo: () => void, { desktop = false, inicial }: { desktop?: boolean; inicial?: Consulta } = {}) {
  const { state, api, perfil } = useStore();
  const i = inicial;
  const [titulo, setTitulo] = useState(i?.titulo ?? ex('Dentista', ''));
  /** Consulta com um profissional ou exame agendado (coleta, imagem…). */
  const [tipo, setTipo] = useState<Consulta['tipo']>(i?.tipo ?? 'consulta');
  const [para, setPara] = useState(i?.pessoaId ?? perfil ?? eu(state).id);
  const [quando, setQuando] = useState(i ? `${dataBR(i.data).slice(0, 5)} · ${i.hora}` : ex('18/11 · 14:00', ''));
  const [prof, setProf] = useState(i?.profissional ?? ex('Dr. Renato Souza', ''));
  const [local, setLocal] = useState(i?.local ?? ex('Odonto Vila Mariana', ''));
  const [plano, setPlano] = useState(i ? !!i.peloPlano : true);
  const [levar, setLevar] = useState(i?.levar ?? ex([{ item: 'Carteirinha do plano', ok: true }, { item: 'Raio-X panorâmico (fev)', ok: true }], [{ item: 'Carteirinha do plano', ok: true }]));
  const [novoItem, setNovoItem] = useState<string | null>(null);
  const [lembrar, setLembrar] = useState(i?.lembretes?.[0] ?? '1 dia antes');
  // Ficha da consulta: endereço (para "Como chegar"), telefone, preparo e tempo de trajeto.
  const [endereco, setEndereco] = useState(i?.endereco ?? '');
  const [telefone, setTelefoneBruto] = useState(i?.telefone ?? '');
  const setTelefone = (v: string) => setTelefoneBruto(mascararTelefone(v));
  const [preparo, setPreparo] = useState(i?.preparo ?? '');
  const [trajeto, setTrajeto] = useState(i?.trajetoMin ? String(i.trajetoMin) : '');
  const trajetoMin = lerTrajeto(trajeto);
  const trajetoValido = !trajeto.trim() || trajetoMin != null;

  // Data e hora do desktop: texto bruto próprio (não derivado de `quando`, senão o campo "pula" ao digitar).
  // O desktop usa setData/setHora; setQuando (mobile) não os atualiza.
  const [data, setDataBruto] = useState(() => { const dh = i ? { data: i.data } : lerDataHora(quando, HOJE); return dh ? dataBR(dh.data) : ''; });
  const [hora, setHoraBruto] = useState(() => lerDataHora(quando, HOJE)?.hora ?? '');
  const setData = (v: string) => { const d = mascaraData(v); setDataBruto(d); setQuando(juntarDataHora(d, normalizarHora(hora))); };
  const setHora = (v: string) => { setHoraBruto(v); setQuando(juntarDataHora(data, normalizarHora(v))); };

  // Consulta de pet: sem título, vira "Veterinário".
  const paraPet = !!state.pessoas.find((p) => p.id === para && ehPet(p));
  const tituloFinal = titulo.trim() || (paraPet ? 'Veterinário' : '');

  const salvar = () => {
    const dh = lerDataHora(quando, HOJE);
    if (!trajetoValido) { api.toast({ texto: 'Trajeto em minutos, como 30 ou 1h15' }); return; }
    if (!dh) {
      api.toast({ texto: desktop ? 'Informe a data (DD/MM/AAAA) e a hora (HH:MM)' : 'Informe data e hora assim: 18/11 · 14:00' });
      return;
    }
    // "Pelo plano": a operadora do plano da pessoa, quando houver.
    const op = state.planos.find((x) => x.pessoaId === para)?.operadora.split(' ')[0];
    const consulta: Consulta = {
      ...(i ?? { duracaoMin: 30 }),
      id: i?.id ?? `c-${novoId()}`,
      tipo,
      pessoaId: para,
      titulo: tituloFinal,
      profissional: prof.trim() || undefined,
      local: local.trim() || undefined,
      endereco: endereco.trim() || undefined,
      telefone: telefone.trim() || undefined,
      preparo: preparo.trim() || undefined,
      trajetoMin,
      data: dh.data,
      hora: dh.hora,
      peloPlano: plano ? (i?.peloPlano ?? `${op ?? 'Plano'} · sim`) : undefined,
      levar,
      lembretes: [lembrar],
    } as Consulta;
    if (i) api.editar('consultas', i.id, diffRegistro(i, consulta), `${tituloFinal} atualizado`);
    else {
      api.addConsulta(consulta);
      api.toast({ texto: `${tituloFinal} marcado para ${quando}` });
    }
    onSalvo();
  };

  return {
    titulo, setTitulo, para, setPara, quando, setQuando, data, setData, hora, setHora,
    prof, setProf, local, setLocal, plano, setPlano, levar, setLevar, novoItem, setNovoItem,
    lembrar, setLembrar, editando: !!i, paraPet, valido: !!tituloFinal && trajetoValido && (!desktop || !!lerDataHora(quando, HOJE)), salvar,
    tipo, setTipo, endereco, setEndereco, telefone, setTelefone, preparo, setPreparo, trajeto, setTrajeto, trajetoValido,
  };
}

// ── Exame ───────────────────────────────────────────────────────────────────

export function useFormExame(onSalvo: () => void, inicial?: Exame) {
  const { state, api, perfil } = useStore();
  const i = inicial;
  const [id] = useState(() => i?.id ?? `ex-${novoId()}`);
  const [arquivos, setArquivos] = useState<Anexo[]>([]);
  const [nome, setNome] = useState(i?.nome ?? ex('Hemograma completo', ''));
  const [de, setDeBruto] = useState(i?.pessoaId ?? perfil ?? eu(state).id);
  const [cat, setCat] = useState<CategoriaExame>(i?.categoria ?? 'Sangue');
  const [data, setDataBruta] = useState(i ? dataBR(i.dataColeta) : ex('27/10/2026', dataBR(HOJE)));
  const setData = (v: string) => setDataBruta(mascaraData(v));
  const [lab, setLab] = useState(i?.laboratorio ?? ex('Lab. Central', ''));
  const [solicitante, setSolicitante] = useState(i?.solicitante ?? '');
  const [anotacao, setAnotacao] = useState(i?.anotacao ?? '');
  const [laudo, setLaudo] = useState(i?.laudo ?? '');
  const [resultados, setResultados] = useState<Resultado[] | undefined>(undefined);
  const [lendoPdf, setLendoPdf] = useState(false);
  const lidos = useRef(new Set<string>());
  // Exame novo com PDF: lê o texto e preenche o resultado, os valores e a data da coleta (a pessoa confere antes de salvar).
  useEffect(() => {
    if (i) return;
    const novos = arquivos.filter((a) => ehPdf(a) && !lidos.current.has(a.id));
    if (!novos.length) return;
    novos.forEach((a) => lidos.current.add(a.id));
    let vivo = true;
    setLendoPdf(true);
    lerDosPdfs(novos)
      .then((r) => {
        if (!vivo) return;
        if (!r) { api.toast({ texto: 'O PDF é uma imagem escaneada, sem texto para ler.' }); return; }
        setLaudo((atual) => (atual.trim() ? `${atual.trim()}

${r.laudo}` : r.laudo));
        if (r.resultados.length) setResultados((atual) => [...(atual ?? []), ...r.resultados.filter((x) => !atual?.some((y) => y.marcador === x.marcador))]);
        if (r.dataColeta) setDataBruta(dataBR(r.dataColeta));
        const n = r.resultados.length;
        api.toast({ texto: n ? `Resultado lido do PDF · ${n} ${n === 1 ? 'valor' : 'valores'}` : 'Resultado lido do PDF' });
      })
      .catch(() => { if (vivo) api.toast({ texto: 'Não foi possível ler o texto do PDF.' }); })
      .finally(() => { if (vivo) setLendoPdf(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `api` não precisa reiniciar a leitura.
  }, [arquivos, i]);
  const [consulta, setConsulta] = useState<string | undefined>(i?.consultaId);
  // Na edição, a consulta já vinculada continua na lista mesmo que tenha passado.
  const consultasDaPessoa = state.consultas.filter((c) => c.pessoaId === de && (c.data >= HOJE || c.id === i?.consultaId));
  /** Trocar a pessoa desvincula a consulta. */
  const setDe = (v: string) => { setDeBruto(v); setConsulta(undefined); };
  /** Avança pelas consultas futuras da pessoa (e "nenhuma"). */
  const proxConsulta = () => {
    const ids = [undefined, ...consultasDaPessoa.map((c) => c.id)];
    setConsulta(ids[(ids.indexOf(consulta) + 1) % ids.length]);
  };

  const salvar = () => {
    const dataColeta = brParaISO(data);
    if (!dataColeta) { api.toast({ texto: 'Data da coleta assim: DD/MM/AAAA' }); return; }
    const exame: Exame = {
      ...(i ?? {}),
      id,
      pessoaId: de,
      nome: nome.trim(),
      categoria: cat,
      dataColeta,
      laboratorio: lab.trim(),
      solicitante: solicitante.trim() || undefined,
      anotacao: anotacao.trim() || undefined,
      laudo: laudo.trim() || undefined,
      ...(resultados?.length && !i?.resultados?.length ? { resultados } : {}),
      consultaId: consulta,
      arquivo: i?.arquivo ?? (arquivos.some((a) => a.mime === 'application/pdf') ? 'PDF' : 'FOTO'),
      paginas: i?.paginas ?? arquivos.length,
    } as Exame;
    if (i) api.editar('exames', id, diffRegistro(i, exame), `${exame.nome} atualizado`);
    else {
      api.addExame(exame);
      api.addAnexos(arquivos);
      api.toast({ texto: `${nome.trim()} arquivado` });
    }
    onSalvo();
  };

  return {
    id, arquivos, setArquivos, solicitante, setSolicitante, anotacao, setAnotacao, laudo, setLaudo, resultados, lendoPdf, editando: !!i, nome, setNome, de, setDe, cat, setCat, data, setData, lab, setLab,
    consulta, setConsulta, consultasDaPessoa, proxConsulta, valido: !!nome.trim(), salvar,
  };
}

// ── Plano de saúde ──────────────────────────────────────────────────────────

export function useFormPlano(pessoaInicial: string | undefined, onSalvo: (id: string) => void, inicial?: Plano) {
  const { state, api, perfil } = useStore();
  const [f, setF] = useState<FormPlano>(() => {
    if (inicial) {
      const t = (v?: string) => (v && v !== '—' ? v : '');
      return {
        pessoaId: inicial.pessoaId, operadora: inicial.operadora, numero: inicial.numero, produto: inicial.produto,
        acomodacao: t(inicial.acomodacao) || 'Apartamento', segmentacao: inicial.segmentacao, abrangencia: inicial.abrangencia,
        validade: t(inicial.validade), vinculo: inicial.vinculo, titularNome: inicial.titularNome, registroAns: t(inicial.registroAns),
        central: inicial.central ?? '', cns: inicial.cns ?? '', carencias: t(inicial.carencias), mensalidade: inicial.mensalidade ?? '', anotacao: inicial.anotacao ?? '',
      };
    }
    const pessoaId = pessoaInicial ?? perfil ?? eu(state).id;
    // Mesma operadora de alguém da família: já sugere (plano familiar).
    const outro = state.planos[0];
    return {
      pessoaId, operadora: outro?.operadora ?? '', numero: '', produto: outro?.produto ?? '', acomodacao: 'Apartamento',
      segmentacao: 'Ambulatorial + hospitalar', abrangencia: 'Nacional', validade: '', vinculo: 'titular', titularNome: '',
      registroAns: outro?.registroAns ?? '', central: outro?.central ?? '', cns: '', carencias: '', mensalidade: '', anotacao: '',
    };
  });
  const [erros, setErros] = useState<ErrosPlano>({});
  const set = (patch: Partial<FormPlano>) => {
    setF((x) => ({
      ...x, ...patch,
      ...(patch.validade != null ? { validade: mascaraValidade(patch.validade) } : {}),
      ...(patch.central != null ? { central: mascararTelefone(patch.central) } : {}),
    }));
    setErros({});
  };
  const salvar = () => {
    const r = montarPlano(f);
    if (!r.plano) { setErros(r.erros); return; }
    if (inicial) {
      api.editar('planos', inicial.id, diffRegistro(inicial, { ...inicial, ...r.plano }), 'Plano atualizado');
      onSalvo(inicial.id);
      return;
    }
    const id = `plano-${novoId()}`;
    api.addPlano({ id, ...r.plano });
    api.toast({ texto: 'Plano guardado' });
    onSalvo(id);
  };
  return { f, set, erros, editando: !!inicial, valido: !!f.operadora.trim() && !!f.numero.trim(), salvar };
}

// ── Pessoa ──────────────────────────────────────────────────────────────────

export function useFormPessoa({ souEu, onSalvo }: { souEu: boolean; onSalvo: (id: string) => void }) {
  const { state, api } = useStore();
  // Cor do avatar pela posição na família (os pets têm a sequência deles).
  const n = familia(state).length;
  const [nome, setNome] = useState(souEu ? '' : ex('Roberto Carlos Almeida', ''));
  const [nasc, setNascBruto] = useState(souEu ? '' : ex('14/02/1965', ''));
  const [par, setPar] = useState('cônjuge');
  const [sangue, setSangue] = useState<string>(souEu ? '' : ex('A+', ''));
  const [erroData, setErroData] = useState('');
  /** Aplica a máscara DD/MM/AAAA e limpa o erro. */
  const setNasc = (v: string) => { setNascBruto(mascaraData(v)); setErroData(''); };

  const salvar = () => {
    const r = lerNascimento(nasc, HOJE);
    if (r.erro) {
      setErroData(r.erro);
      return;
    }
    const id = nome.trim().toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 12) + '-' + novoId().slice(-6);
    api.addPessoa({
      id,
      nome: nome.trim().replace(/\s+/g, ' '),
      curto: nome.trim().split(' ')[0],
      nascimento: r.iso,
      parentesco: souEu ? undefined : par,
      sangue: sangue && sangue !== 'nao-sei' ? sangue : undefined,
      cor: souEu ? '#D6E8E9' : CORES[n % CORES.length],
      alergias: [],
      condicoes: [],
      souEu: souEu || undefined,
    });
    onSalvo(id);
  };

  return { nome, setNome, nasc, setNasc, par, setPar, sangue, setSangue, erroData, valido: !!nome.trim(), salvar };
}

// ── Pet ─────────────────────────────────────────────────────────────────────

export type SexoPet = 'Macho' | 'Fêmea';
export const SEXOS_PET: { id: SexoPet; nome: string }[] = [{ id: 'Macho', nome: 'Macho' }, { id: 'Fêmea', nome: 'Fêmea' }];
/** Macho/Fêmea ↔ o sexo guardado na pessoa. */
export const SEXO_DO_PET: Record<SexoPet, 'Masculino' | 'Feminino'> = { Macho: 'Masculino', Fêmea: 'Feminino' };
export const sexoPetDoForm = (sexo: '' | 'Masculino' | 'Feminino'): SexoPet | '' => (sexo === 'Masculino' ? 'Macho' : sexo === 'Feminino' ? 'Fêmea' : '');

/** Cadastro de pet (desktop e celular): nome, raça, sexo, nascimento, peso atual e castrado. */
export function useFormPet(onSalvo: (id: string) => void) {
  const { state, api } = useStore();
  const n = pets(state).length;
  const [nome, setNome] = useState('');
  const [raca, setRaca] = useState('');
  const [sexo, setSexo] = useState<SexoPet | ''>('');
  const [nasc, setNascBruto] = useState('');
  const [peso, setPesoBruto] = useState('');
  const [castrado, setCastrado] = useState(false);
  const [erros, setErros] = useState<{ nasc?: string; peso?: string }>({});
  const setNasc = (v: string) => { setNascBruto(mascaraData(v)); setErros((e) => ({ ...e, nasc: undefined })); };
  const setPeso = (v: string) => { setPesoBruto(v); setErros((e) => ({ ...e, peso: undefined })); };

  const salvar = () => {
    const r = lerNascimento(nasc, HOJE);
    const kg = peso.trim() ? lerNumeroBR(peso) : undefined;
    const pesoInvalido = !!peso.trim() && (kg === undefined || kg <= 0 || kg > 150);
    if (r.erro || pesoInvalido) {
      setErros({ nasc: r.erro, peso: pesoInvalido ? 'Peso inválido. Ex.: 12,5' : undefined });
      return;
    }
    const limpo = nome.trim().replace(/\s+/g, ' ');
    const id = (limpo.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 12) || 'pet') + '-' + novoId().slice(-6);
    api.addPessoa({
      id,
      nome: limpo,
      curto: limpo.split(' ')[0],
      nascimento: r.iso,
      sexo: sexo === 'Macho' ? 'Masculino' : sexo === 'Fêmea' ? 'Feminino' : undefined,
      cor: CORES[n % CORES.length],
      alergias: [],
      condicoes: [],
      tipo: 'pet',
      pet: { especie: 'cachorro', raca: raca.trim() || undefined, castrado },
    });
    if (kg !== undefined) api.addPesagem({ id: `pes-${novoId()}`, pessoaId: id, data: HOJE, kg });
    api.toast({ texto: `${limpo.split(' ')[0]} ${sexo === 'Fêmea' ? 'adicionada' : sexo === 'Macho' ? 'adicionado' : 'adicionado(a)'}` });
    onSalvo(id);
  };

  return {
    nome, setNome, raca, setRaca, sexo, setSexo, nasc, setNasc, peso, setPeso, castrado, setCastrado,
    erros, valido: !!nome.trim(), salvar,
  };
}

// ── Registros dos pets ──────────────────────────────────────────────────────
// Datas em DD/MM/AAAA com máscara, padrão hoje. Erros aparecem ao salvar e somem ao editar o campo.

const idRegistro = (prefixo: string) => `${prefixo}-${novoId()}`;
const textoOuNada = (v: string) => v.trim().replace(/\s+/g, ' ') || undefined;

/** Campo de data com máscara e erro próprio. */
function useCampoData(inicial = isoParaBR(HOJE)) {
  const [valor, setBruto] = useState(inicial);
  const [erro, setErro] = useState<string>();
  return { valor, erro, setErro, set: (v: string) => { setBruto(mascaraData(v)); setErro(undefined); } };
}

/** "Registrar vacina": nome (com sugestões), data, lote, veterinário e próximo reforço (atalhos ou data). */
/** Registrar vacina ou, com `vacina`, editar uma já registrada (só os campos que mudaram) e apagar. */
export function useFormVacina(pet: Pessoa, onSalvo: () => void, vacina?: Vacina) {
  const { api } = useStore();
  const [nome, setNome] = useState(vacina?.nome ?? '');
  const data = useCampoData(vacina ? isoParaBR(vacina.data) : undefined);
  const [lote, setLote] = useState(vacina?.lote ?? '');
  const [veterinario, setVeterinario] = useState(vacina ? vacina.veterinario ?? '' : pet.pet?.veterinario?.nome ?? '');
  // Atalho escolhido (recalcula o reforço quando a data muda); digitar a data do reforço solta o atalho.
  // Na edição, o reforço começa como foi salvo (data digitada, ou "Sem reforço").
  const [atalho, setAtalhoBruto] = useState<AtalhoReforco | ''>(vacina ? (vacina.proxima ? '' : 'sem') : '1a');
  const [proximaDigitada, setProximaDigitada] = useState(vacina?.proxima ? isoParaBR(vacina.proxima) : '');
  const [erroProxima, setErroProxima] = useState<string>();
  const dataIso = brParaISO(data.valor);
  const doAtalho = atalho && dataIso ? dataDoReforco(dataIso, atalho) : undefined;
  const proxima = atalho ? (doAtalho ? isoParaBR(doAtalho) : '') : proximaDigitada;

  const setData = (v: string) => { data.set(v); setErroProxima(undefined); };
  const setAtalho = (a: AtalhoReforco) => { setAtalhoBruto(a); setErroProxima(undefined); };
  const setProxima = (v: string) => { setAtalhoBruto(''); setProximaDigitada(mascaraData(v)); setErroProxima(undefined); };

  const salvar = () => {
    const d = lerDataRegistro(data.valor, HOJE);
    const p = lerReforco(proxima, d.iso);
    if (d.erro || p.erro) {
      data.setErro(d.erro);
      setErroProxima(p.erro);
      return;
    }
    const nova: Vacina = {
      id: vacina?.id ?? idRegistro('vac'),
      pessoaId: pet.id,
      nome: nome.trim().replace(/\s+/g, ' '),
      data: d.iso!,
      lote: textoOuNada(lote),
      veterinario: textoOuNada(veterinario),
      proxima: p.iso,
    };
    if (vacina) {
      // Só o que mudou; campo esvaziado vai como null (apaga).
      const patch: Record<string, unknown> = {};
      for (const k of ['nome', 'data', 'lote', 'veterinario', 'proxima'] as const) {
        if (nova[k] !== vacina[k]) patch[k] = nova[k] ?? null;
      }
      api.editar('vacinas', vacina.id, patch, 'Vacina atualizada');
    } else {
      api.addVacina(nova);
      api.toast({ texto: 'Vacina registrada' });
    }
    onSalvo();
  };
  const apagar = vacina && (() => { api.remover('vacinas', vacina, `${vacina.nome} apagada`); onSalvo(); });

  return {
    editando: !!vacina,
    nome, setNome, data: data.valor, setData, lote, setLote, veterinario, setVeterinario,
    atalho, setAtalho, proxima, setProxima,
    erros: { data: data.erro, proxima: erroProxima },
    valido: !!nome.trim() && !!data.valor, salvar, apagar,
  };
}

export type TipoPrevencao = Prevencao['tipo'];
/** Tipos da prevenção, com o intervalo padrão de cada um. */
export const TIPOS_PREVENCAO: { id: TipoPrevencao; nome: string; dias: number }[] = [
  { id: 'vermifugo', nome: 'Vermífugo', dias: 90 },
  { id: 'antipulgas', nome: 'Antipulgas', dias: 30 },
  { id: 'outro', nome: 'Outro', dias: 30 },
];
export const ATALHOS_INTERVALO = [30, 90];

/** Só os campos que mudaram; campo esvaziado vai como null (apaga). */
function patchDe<T extends object>(novo: T, antigo: T, chaves: readonly (keyof T)[]) {
  const patch: Record<string, unknown> = {};
  for (const k of chaves) {
    const n = novo[k], v = antigo[k];
    const igual = Array.isArray(n) && Array.isArray(v) ? n.length === v.length && n.every((x, i) => x === v[i]) : n === v;
    if (!igual) patch[k as string] = n ?? null;
  }
  return patch;
}

/** "Registrar prevenção": tipo, produto, data da aplicação e "a cada N dias" (próxima calculada ao vivo). Com `inicial`, edita e apaga. */
export function useFormPrevencao(pet: Pessoa, onSalvo: () => void, inicial?: Prevencao) {
  const { api } = useStore();
  const [tipo, setTipoBruto] = useState<TipoPrevencao | ''>(inicial?.tipo ?? '');
  const [produto, setProduto] = useState(inicial?.produto ?? '');
  const data = useCampoData(inicial ? isoParaBR(inicial.data) : undefined);
  const [intervalo, setIntervaloBruto] = useState(String(inicial?.intervaloDias ?? 30));
  // Enquanto o intervalo não for mexido, segue o padrão do tipo (vermífugo 90, antipulgas 30). Na edição, fica o salvo.
  const [intervaloMexido, setIntervaloMexido] = useState(!!inicial);
  const [erroIntervalo, setErroIntervalo] = useState<string>();
  const setTipo = (t: TipoPrevencao) => {
    setTipoBruto(t);
    if (!intervaloMexido) setIntervaloBruto(String(TIPOS_PREVENCAO.find((x) => x.id === t)!.dias));
  };
  const setIntervalo = (v: string) => { setIntervaloBruto(v.replace(/\D/g, '').slice(0, 3)); setIntervaloMexido(true); setErroIntervalo(undefined); };

  const dias = lerIntervaloDias(intervalo);
  const dataIso = brParaISO(data.valor);
  const proxima = dataIso && dias ? somarDias(dataIso, dias) : undefined;

  const salvar = () => {
    const d = lerDataRegistro(data.valor, HOJE);
    const erroDias = dias ? undefined : 'Informe de 1 a 365 dias.';
    if (d.erro || erroDias || !tipo) {
      data.setErro(d.erro);
      setErroIntervalo(erroDias);
      return;
    }
    const nova: Prevencao = { id: inicial?.id ?? idRegistro('prev'), pessoaId: pet.id, tipo, produto: produto.trim().replace(/\s+/g, ' '), data: d.iso!, intervaloDias: dias! };
    if (inicial) api.editar('prevencoes', inicial.id, patchDe(nova, inicial, ['tipo', 'produto', 'data', 'intervaloDias']), 'Prevenção atualizada');
    else {
      api.addPrevencao(nova);
      api.toast({ texto: 'Prevenção registrada' });
    }
    onSalvo();
  };
  const apagar = inicial && (() => { api.remover('prevencoes', inicial, 'Prevenção apagada'); onSalvo(); });

  return {
    editando: !!inicial,
    tipo, setTipo, produto, setProduto, data: data.valor, setData: data.set, intervalo, setIntervalo, proxima,
    erros: { data: data.erro, intervalo: erroIntervalo },
    valido: !!tipo && !!produto.trim() && !!data.valor && !!intervalo, salvar, apagar,
  };
}

/** "Registrar sintoma": data, sinais (pelo menos um) e observação. Com `inicial`, edita e apaga. */
export function useFormSintoma(pet: Pessoa, onSalvo: () => void, inicial?: Sintoma) {
  const { api } = useStore();
  const data = useCampoData(inicial ? isoParaBR(inicial.data) : undefined);
  const [sinais, setSinais] = useState<string[]>(inicial?.sinais ?? []);
  const [nota, setNota] = useState(inicial?.nota ?? '');
  const alternarSinal = (s: string) => setSinais((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));

  const salvar = () => {
    const d = lerDataRegistro(data.valor, HOJE);
    if (d.erro || !sinais.length) {
      data.setErro(d.erro);
      return;
    }
    // Sinais na ordem da lista fixa, não na dos cliques (algum fora da lista vai no fim).
    const ordenados = [...SINAIS.filter((s) => sinais.includes(s)), ...sinais.filter((s) => !SINAIS.includes(s))];
    const novo: Sintoma = { id: inicial?.id ?? idRegistro('sint'), pessoaId: pet.id, data: d.iso!, sinais: ordenados, nota: nota.trim() || undefined };
    if (inicial) api.editar('sintomas', inicial.id, patchDe(novo, inicial, ['data', 'sinais', 'nota']), 'Sintoma atualizado');
    else {
      api.addSintoma(novo);
      api.toast({ texto: 'Sintoma registrado' });
    }
    onSalvo();
  };
  const apagar = inicial && (() => { api.remover('sintomas', inicial, 'Sintoma apagado'); onSalvo(); });

  return { editando: !!inicial, data: data.valor, setData: data.set, sinais, alternarSinal, nota, setNota, erros: { data: data.erro }, valido: sinais.length > 0 && !!data.valor, salvar, apagar };
}

/**
 * "Registrar procedimento" (pessoa ou pet): data, tipo, descrição, clínica ou hospital, quem realizou,
 * anestesista e observações. No pet novo, a clínica começa com a do veterinário. Com `inicial`, edita e apaga.
 */
export function useFormProcedimento(dono: Pessoa, onSalvo: () => void, inicial?: Procedimento) {
  const { api } = useStore();
  const data = useCampoData(inicial ? isoParaBR(inicial.data) : undefined);
  const [tipo, setTipo] = useState<TipoProcedimento | ''>(inicial?.tipo ?? '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [clinica, setClinica] = useState(inicial ? inicial.clinica ?? '' : dono.pet?.veterinario?.clinica ?? '');
  const [medico, setMedico] = useState(inicial?.medico ?? '');
  const [anestesista, setAnestesista] = useState(inicial?.anestesista ?? '');
  const [nota, setNota] = useState(inicial?.nota ?? '');

  const salvar = () => {
    const d = lerDataRegistro(data.valor, HOJE);
    if (d.erro || !tipo) {
      data.setErro(d.erro);
      return;
    }
    const novo: Procedimento = {
      id: inicial?.id ?? idRegistro('proc'),
      pessoaId: dono.id,
      data: d.iso!,
      tipo,
      descricao: textoOuNada(descricao),
      clinica: textoOuNada(clinica),
      medico: textoOuNada(medico),
      anestesista: textoOuNada(anestesista),
      nota: nota.trim() || undefined,
    };
    if (inicial) api.editar('procedimentos', inicial.id, patchDe(novo, inicial, ['data', 'tipo', 'descricao', 'clinica', 'medico', 'anestesista', 'nota']), 'Procedimento atualizado');
    else {
      api.addProcedimento(novo);
      api.toast({ texto: 'Procedimento registrado' });
    }
    onSalvo();
  };
  const apagar = inicial && (() => { api.remover('procedimentos', inicial, 'Procedimento apagado'); onSalvo(); });

  return {
    editando: !!inicial,
    data: data.valor, setData: data.set, tipo, setTipo, descricao, setDescricao, clinica, setClinica,
    medico, setMedico, anestesista, setAnestesista, nota, setNota,
    erros: { data: data.erro }, valido: !!tipo && !!data.valor, salvar, apagar,
  };
}

/** "Nova pesagem": data e peso em kg (vírgula decimal, até 150 kg). Com `inicial`, edita e apaga. */
export function useFormPesagem(pet: Pessoa, onSalvo: () => void, inicial?: Pesagem) {
  const { api } = useStore();
  const data = useCampoData(inicial ? isoParaBR(inicial.data) : undefined);
  const [peso, setPesoBruto] = useState(inicial ? String(inicial.kg).replace('.', ',') : '');
  const [erroPeso, setErroPeso] = useState<string>();
  const setPeso = (v: string) => { setPesoBruto(v); setErroPeso(undefined); };

  const salvar = () => {
    const d = lerDataRegistro(data.valor, HOJE);
    const kg = lerNumeroBR(peso);
    const erroKg = kg === undefined || kg <= 0 || kg > 150 ? 'Peso inválido. Ex.: 12,5' : undefined;
    if (d.erro || erroKg) {
      data.setErro(d.erro);
      setErroPeso(erroKg);
      return;
    }
    const nova: Pesagem = { id: inicial?.id ?? `pes-${novoId()}`, pessoaId: pet.id, data: d.iso!, kg: kg! };
    if (inicial) api.editar('pesagens', inicial.id, patchDe(nova, inicial, ['data', 'kg']), 'Pesagem atualizada');
    else {
      api.addPesagem(nova);
      api.toast({ texto: 'Peso registrado' });
    }
    onSalvo();
  };
  const apagar = inicial && (() => { api.remover('pesagens', inicial, 'Pesagem apagada'); onSalvo(); });

  return { editando: !!inicial, data: data.valor, setData: data.set, peso, setPeso, erros: { data: data.erro, peso: erroPeso }, valido: !!peso.trim() && !!data.valor, salvar, apagar };
}

// ── Editar perfil ───────────────────────────────────────────────────────────

/** Estado do "Editar perfil" (desktop e celular). `salvar()` emite só o que mudou; sem mudanças, só fecha. */
export function useFormPerfil(p: Pessoa, onSalvo: () => void) {
  const { api } = useStore();
  const [f, setF] = useState<FormPerfil>(() => formDePessoa(p));
  const [erros, setErros] = useState<ErrosPerfil>({});
  /** Muda um campo e limpa o erro dele. */
  const set = <K extends keyof FormPerfil>(k: K, v: FormPerfil[K], erro: keyof ErrosPerfil | undefined = k as keyof ErrosPerfil) => {
    setF((x) => ({ ...x, [k]: v }));
    if (erro) setErros((e) => ({ ...e, [erro]: undefined }));
  };

  /** Adiciona uma linha vazia e devolve a chave dela (para focar). */
  const addAlergia = () => { const chave = novaChave(); setF((x) => ({ ...x, alergias: [...x.alergias, { chave, substancia: '', reacao: '' }] })); return chave; };
  const setAlergia = (chave: string, m: Partial<LinhaAlergia>) => setF((x) => ({ ...x, alergias: x.alergias.map((a) => (a.chave === chave ? { ...a, ...m } : a)) }));
  const removerAlergia = (chave: string) => setF((x) => ({ ...x, alergias: x.alergias.filter((a) => a.chave !== chave) }));
  const addCondicao = () => { const chave = novaChave(); setF((x) => ({ ...x, condicoes: [...x.condicoes, { chave, nome: '', tipo: 'condicao', desde: '' }] })); return chave; };
  const setCondicao = (chave: string, m: Partial<LinhaCondicao>) => setF((x) => ({ ...x, condicoes: x.condicoes.map((c) => (c.chave === chave ? { ...c, ...m } : c)) }));
  const removerCondicao = (chave: string) => setF((x) => ({ ...x, condicoes: x.condicoes.filter((c) => c.chave !== chave) }));

  const salvar = () => {
    const r = pessoaDoForm(p, f, HOJE);
    if (!r.pessoa) {
      setErros(r.erros);
      return;
    }
    const patch = diffPessoa(p, r.pessoa);
    if (Object.keys(patch).length) {
      api.editarPessoa(p.id, patch);
      api.toast({ texto: 'Perfil atualizado' });
    }
    onSalvo();
  };

  return {
    ...f,
    setNome: (v: string) => set('nome', v),
    setNasc: (v: string) => set('nasc', mascaraData(v)),
    setSexo: (v: FormPerfil['sexo']) => set('sexo', v, undefined),
    setSangue: (v: string) => set('sangue', v, undefined),
    setPeso: (v: string) => set('peso', v),
    setAltura: (v: string) => set('altura', v),
    setPressao: (v: string) => set('pressao', v, undefined),
    setContato: (m: Partial<FormPerfil['contato']>) => set('contato', { ...f.contato, ...m }, 'contato'),
    setFoto: (v: string | undefined) => set('foto', v, undefined),
    setResponsavel: (v: string) => set('responsavel', v, undefined),
    /** Campos do pet (só existem quando `p` é pet). */
    setPet: (m: Partial<Omit<FormPet, 'veterinario' | 'clinica24h'>>) => f.pet && set('pet', { ...f.pet, ...m }, undefined),
    setVeterinario: (m: Partial<FormPet['veterinario']>) => f.pet && set('pet', { ...f.pet, veterinario: { ...f.pet.veterinario, ...m } }, 'veterinario'),
    setClinica24h: (m: Partial<FormPet['clinica24h']>) => f.pet && set('pet', { ...f.pet, clinica24h: { ...f.pet.clinica24h, ...m } }, 'clinica24h'),
    addAlergia, setAlergia, removerAlergia, addCondicao, setCondicao, removerCondicao,
    /** Data da pressão que fica salva: a medida anterior se o valor não mudou, senão hoje. */
    dataPressao: normalizarTexto(f.pressao) ? (normalizarTexto(f.pressao) === p.pressao?.valor ? p.pressao.data : HOJE) : undefined,
    erros, valido: !!f.nome.trim(), salvar,
  };
}

// ── Medição (peso, pressão, glicemia…) ──────────────────────────────────────

/** Nova medição ou, com `inicial`, edição (só o que mudou) e apagar. */
export function useFormMedicao(pessoaId: string, tipoInicial: TipoMedicao, onSalvo: () => void, inicial?: Medicao) {
  const { api } = useStore();
  const [f, setF] = useState<FormMedicao>(() => {
    if (inicial) {
      const i = infoMedicao(inicial.tipo);
      const valor = inicial.tipo === 'pressao' ? String(inicial.valor) : i.casas ? String(inicial.valor).replace('.', ',') : String(inicial.valor);
      return { tipo: inicial.tipo, data: dataBR(inicial.data), hora: inicial.hora ?? '', valor, valor2: inicial.valor2 != null ? String(inicial.valor2) : '', contexto: inicial.contexto ?? 'Jejum', nota: inicial.nota ?? '' };
    }
    const agora = new Date();
    return {
      tipo: tipoInicial, data: dataBR(HOJE), hora: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
      valor: '', valor2: '', contexto: 'Jejum', nota: '',
    };
  });
  const [erros, setErros] = useState<ErrosMedicao>({});
  const set = (patch: Partial<FormMedicao>) => {
    setF((x) => ({ ...x, ...patch, ...(patch.data != null ? { data: mascaraData(patch.data) } : {}), ...(patch.tipo ? { valor: '', valor2: '' } : {}) }));
    setErros({});
  };
  const salvar = () => {
    const r = montarMedicao(f, pessoaId, HOJE);
    if (!r.medicao) { setErros(r.erros); return; }
    if (inicial) {
      const nova: Medicao = { id: inicial.id, ...r.medicao };
      api.editar('medicoes', inicial.id, patchDe(nova, inicial, ['tipo', 'data', 'hora', 'valor', 'valor2', 'contexto', 'nota']), 'Medição atualizada');
    } else api.addMedicao(r.medicao);
    onSalvo();
  };
  const apagar = inicial && (() => { api.remover('medicoes', inicial, 'Medição apagada'); onSalvo(); });
  return { editando: !!inicial, f, set, erros, valido: !!f.valor.trim(), salvar, apagar };
}
