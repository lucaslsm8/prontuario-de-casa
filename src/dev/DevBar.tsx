import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import type { Layout } from '../layout';

// Navegador de telas para comparar com os mockups. Só aparece em `npm run dev`.
export const TELAS: { id: string; nome: string; layout: Layout; rota: string; vazio?: boolean }[] = [
  { id: 'M01', nome: 'Boas-vindas', layout: 'mobile', rota: '/boas-vindas' },
  { id: 'M02', nome: 'Cadastro de membro', layout: 'mobile', rota: '/cadastro?passo=2' },
  { id: 'M03', nome: 'Início', layout: 'mobile', rota: '/' },
  { id: 'M04', nome: 'Perfil do membro', layout: 'mobile', rota: '/pessoa/roberto' },
  { id: 'M05', nome: 'Remédios', layout: 'mobile', rota: '/remedios' },
  { id: 'M06', nome: 'Novo remédio', layout: 'mobile', rota: '/remedios/novo' },
  { id: 'M07', nome: 'Agenda', layout: 'mobile', rota: '/agenda' },
  { id: 'M08', nome: 'Exames', layout: 'mobile', rota: '/exames' },
  { id: 'M09', nome: 'Plano de saúde', layout: 'mobile', rota: '/pessoa/roberto/plano' },
  { id: 'M10', nome: 'Privacidade e bloqueio', layout: 'mobile', rota: '/privacidade' },
  { id: 'M11', nome: 'Desbloqueio', layout: 'mobile', rota: '/desbloqueio' },
  { id: 'M12', nome: 'Família', layout: 'mobile', rota: '/familia' },
  { id: 'M13', nome: 'Compartilhar perfil', layout: 'mobile', rota: '/compartilhar/pedro' },
  { id: 'M14', nome: 'Ficha de emergência', layout: 'mobile', rota: '/pessoa/roberto/emergencia' },
  { id: 'M15', nome: 'Lembrete de dose', layout: 'mobile', rota: '/lembrete' },
  { id: 'M16', nome: 'Detalhe do remédio', layout: 'mobile', rota: '/remedios/levotiroxina' },
  { id: 'M17', nome: 'Adicionar exame', layout: 'mobile', rota: '/exames/novo' },
  { id: 'M18', nome: 'Nova consulta', layout: 'mobile', rota: '/agenda/nova' },
  { id: 'M19', nome: 'Resumo para consulta', layout: 'mobile', rota: '/consulta/cardio-0511/resumo' },
  { id: 'M20', nome: 'Início vazio', layout: 'mobile', rota: '/', vazio: true },
  { id: 'M21', nome: 'Exames vazio', layout: 'mobile', rota: '/exames', vazio: true },
  { id: 'M22', nome: 'Atualizações', layout: 'mobile', rota: '/atualizacoes' },
  { id: 'M23', nome: 'Instalando atualização', layout: 'mobile', rota: '/atualizacoes/instalando' },
  { id: 'M·Editar perfil', nome: 'Editar perfil', layout: 'mobile', rota: '/pessoa/roberto/editar' },
  { id: 'M·Pet', nome: 'Perfil do pet', layout: 'mobile', rota: '/pessoa/mel' },
  { id: 'M·Novo pet', nome: 'Novo pet', layout: 'mobile', rota: '/pet/novo' },
  { id: 'M·Sintoma', nome: 'Novo sintoma', layout: 'mobile', rota: '/pet/mel/sintoma' },
  { id: 'D01', nome: 'Início', layout: 'desktop', rota: '/' },
  { id: 'D02', nome: 'Perfil clínico', layout: 'desktop', rota: '/pessoa/roberto' },
  { id: 'D03', nome: 'Exames', layout: 'desktop', rota: '/exames/lipidico' },
  { id: 'D04', nome: 'Agenda', layout: 'desktop', rota: '/agenda' },
  { id: 'D05', nome: 'Remédios', layout: 'desktop', rota: '/remedios' },
  { id: 'D06', nome: 'Planos de saúde', layout: 'desktop', rota: '/planos' },
  { id: 'D07', nome: 'Configurações', layout: 'desktop', rota: '/configuracoes' },
  { id: 'D08', nome: 'Atualização disponível', layout: 'desktop', rota: '/?update=1' },
  { id: 'D·Primeiro uso', nome: 'Primeiro uso', layout: 'desktop', rota: '/boas-vindas' },
  { id: 'D·Novo remédio', nome: 'Novo remédio', layout: 'desktop', rota: '/?abrir=remedio' },
  { id: 'D·Nova consulta', nome: 'Nova consulta', layout: 'desktop', rota: '/?abrir=consulta' },
  { id: 'D·Novo exame', nome: 'Novo exame', layout: 'desktop', rota: '/?abrir=exame' },
  { id: 'D·Nova pessoa', nome: 'Nova pessoa', layout: 'desktop', rota: '/?abrir=pessoa' },
  { id: 'D·Emergência', nome: 'Ficha de emergência', layout: 'desktop', rota: '/?abrir=emergencia:roberto' },
  { id: 'D·Editar perfil', nome: 'Editar perfil', layout: 'desktop', rota: '/?abrir=perfil:roberto' },
  { id: 'D·Remédio', nome: 'Detalhe do remédio', layout: 'desktop', rota: '/remedios/levotiroxina' },
  { id: 'D·Resumo', nome: 'Resumo para consulta', layout: 'desktop', rota: '/consulta/cardio-0511/resumo' },
  { id: 'D·Pet', nome: 'Perfil do pet', layout: 'desktop', rota: '/pessoa/mel' },
  { id: 'D·Novo pet', nome: 'Novo pet', layout: 'desktop', rota: '/?abrir=pet' },
  { id: 'D·Vacina', nome: 'Nova vacina', layout: 'desktop', rota: '/?abrir=vacina:mel' },
  { id: 'D·Resumo vet', nome: 'Resumo veterinário', layout: 'desktop', rota: '/consulta/vet-mel-0611/resumo' },
  { id: 'D·Ficha pet', nome: 'Ficha de emergência do pet', layout: 'desktop', rota: '/?abrir=emergencia:mel' },
  { id: 'D·Balcão', nome: 'Carteirinha no balcão', layout: 'desktop', rota: '/planos?balcao=1' },
];

export function DevBar({
  layout, forcado, setForcado, aberto, setAberto,
}: { layout: Layout; forcado: Layout | null; setForcado: (v: Layout | null) => void; aberto: boolean; setAberto: (v: boolean) => void }) {
  const nav = useNavigate();
  const { api } = useStore();
  const ir = (t: (typeof TELAS)[number]) => {
    if (t.vazio) api.carregarVazio();
    else api.carregarExemplo();
    setForcado(t.layout);
    setAberto(false);
    setTimeout(() => nav(t.rota), 0);
  };
  return (
    <>
      {aberto && (
        <div className="devpanel">
          {TELAS.map((t) => (
            <a key={t.id} href={`#${t.rota}`} onClick={(e) => { e.preventDefault(); ir(t); }}>
              <span className="mono">{t.id}</span>{t.nome}
            </a>
          ))}
        </div>
      )}
      <div className="devbar">
        <button type="button" className={aberto ? 'is-on' : ''} onClick={() => setAberto(!aberto)}>Telas</button>
        <button type="button" className={forcado === 'mobile' ? 'is-on' : ''} onClick={() => setForcado(layout === 'mobile' && forcado ? null : 'mobile')}>Celular</button>
        <button type="button" className={forcado === 'desktop' ? 'is-on' : ''} onClick={() => setForcado(layout === 'desktop' && forcado ? null : 'desktop')}>Desktop</button>
        <button type="button" onClick={() => api.carregarExemplo()}>Dados de exemplo</button>
      </div>
    </>
  );
}
