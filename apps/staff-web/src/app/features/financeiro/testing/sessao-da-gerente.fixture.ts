import type { Schemas } from '@gymos/api-contracts';
import type { RespostaDeApi } from '../../../../../../e2e/src/fixture-de-tela';

/** Carla Menezes (Gerente) logada: refresh, perfil e a identidade da academia do shell. */
const perfil: Schemas['PerfilDto'] = {
  id: '00000000-0000-4000-8000-00000000c001',
  tipo: 'staff',
  nome: 'Carla Menezes',
  email: 'carla@academiaritmo.com',
  tipoDeAcesso: { id: '00000000-0000-4000-8000-00000000a001', nome: 'Gerente' },
  modulos: ['aulas', 'marketing', 'loja', 'saude'],
  permissoes: [
    'inicio:ver',
    'recepcao:ver',
    'alunos:ver',
    'planos:ver',
    'financeiro:ver',
    'financeiro:criar',
    'financeiro:excluir',
    'crm:ver',
    'acesso:ver',
    'treinos:ver',
    'relatorios:ver',
    'equipe:ver',
    'permissoes:ver',
    'configuracoes:ver',
    'aulas:ver',
    'marketing:ver',
    'loja:ver',
    'saude:ver',
  ],
};

export const SESSAO_DA_GERENTE: readonly RespostaDeApi[] = [
  { caminho: '/auth/staff/refresh', metodo: 'POST', corpo: { accessToken: 'token-do-fixture' } },
  { caminho: '/me', corpo: perfil },
  {
    caminho: '/public/tenant',
    corpo: { nome: 'Academia Ritmo', corDestaque: '#22C98A', logotipoUrl: null },
  },
];
