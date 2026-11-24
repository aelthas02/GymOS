import { RepositorioDeUsuarios } from '../modules/autenticacao/application/portas';
import { RepositorioDeFuncionarios } from '../modules/funcionarios/application/portas';
import type { ChaveDoCargo } from '../modules/funcionarios/domain/funcionario';
import { RepositorioDeTenants } from '../modules/platform/application/portas';
import { ExecutorDeTenant } from '../modules/platform/infra/contexto/executor-de-tenant';
import { EQUIPE_DO_SEED } from './autenticacao';
import type { ModuloDeSeed } from './modulo-de-seed';
import { ACADEMIA_RITMO } from './plataforma';

interface FuncionarioDoSeed {
  nome: string;
  cargo: ChaveDoCargo;
  telefone: string;
  /** Custo mensal em centavos (FinFuncionarios.html). */
  custoMensalCentavos: number;
  /** E-mail de um usuário do seed da autenticação: liga o funcionário ao login dele. */
  loginDe?: string;
  ativo?: boolean;
}

const EMAIL_DE = (nome: string): string => {
  const pessoa = EQUIPE_DO_SEED.find((membro) => membro.nome === nome);
  if (!pessoa) {
    throw new Error(`Seed de funcionários: ${nome} não está na equipe do seed da autenticação.`);
  }
  return pessoa.email;
};

/**
 * Equipe de Equipe.html: Carla, João e Diego são os usuários do T12 ligados a um Funcionário; os
 * demais são só cadastro, sem acesso. Dona Neide está inativa, então fica fora da folha do mês.
 */
export const FUNCIONARIOS_DO_SEED: readonly FuncionarioDoSeed[] = [
  {
    nome: 'Carla Menezes',
    cargo: 'gerente',
    telefone: '11991110001',
    custoMensalCentavos: 30000,
    loginDe: EMAIL_DE('Carla Menezes'),
  },
  {
    nome: 'João Batista',
    cargo: 'recepcao',
    telefone: '11991110002',
    custoMensalCentavos: 25000,
    loginDe: EMAIL_DE('João Batista'),
  },
  {
    nome: 'Diego Martins',
    cargo: 'professor',
    telefone: '11991110003',
    custoMensalCentavos: 45000,
    loginDe: EMAIL_DE('Diego Martins'),
  },
  {
    nome: 'Lia Fernandes',
    cargo: 'professor',
    telefone: '11991110004',
    custoMensalCentavos: 40000,
  },
  { nome: 'Camila Rocha', cargo: 'professor', telefone: '11991110005', custoMensalCentavos: 40000 },
  {
    nome: 'Renata Alves',
    cargo: 'nutricionista',
    telefone: '11991110006',
    custoMensalCentavos: 35000,
  },
  {
    nome: 'Marcos Silva',
    cargo: 'manutencao',
    telefone: '11991110007',
    custoMensalCentavos: 15000,
  },
  {
    nome: 'Dona Neide',
    cargo: 'limpeza',
    telefone: '11991110008',
    custoMensalCentavos: 10000,
    ativo: false,
  },
];

/** Equipe da Academia Ritmo. Idempotente: o que já existe (por e-mail de login ou nome) fica como está. */
export const seedDosFuncionarios: ModuloDeSeed = {
  nome: 'funcionarios',
  dependeDe: ['autenticacao'],
  async executar(app) {
    const ritmo = await app.get(RepositorioDeTenants).porSlug(ACADEMIA_RITMO.slug);
    if (!ritmo) {
      throw new Error('Seed de funcionários exige o tenant Ritmo (seed da plataforma).');
    }
    const funcionarios = app.get(RepositorioDeFuncionarios);
    const usuarios = app.get(RepositorioDeUsuarios);
    await app.get(ExecutorDeTenant).runAsTenant(ritmo.id, async () => {
      for (const pessoa of FUNCIONARIOS_DO_SEED) {
        const usuario = pessoa.loginDe ? await usuarios.porEmail(pessoa.loginDe) : null;
        if (pessoa.loginDe && !usuario) {
          throw new Error(`Seed de funcionários: usuário ${pessoa.loginDe} não existe.`);
        }
        const existente = pessoa.loginDe
          ? await funcionarios.porEmail(pessoa.loginDe)
          : (await funcionarios.listar({ busca: pessoa.nome, pagina: 1, limite: 100 })).itens.find(
              (f) => f.nome === pessoa.nome,
            );
        if (existente) {
          continue;
        }
        const criado = await funcionarios.criar({
          nome: pessoa.nome,
          cargo: pessoa.cargo,
          cargoDescricao: null,
          telefone: pessoa.telefone,
          email: usuario?.email ?? null,
          tipoDeAcessoId: usuario?.tipoDeAcesso.id ?? null,
          custoMensalCentavos: pessoa.custoMensalCentavos,
          usuarioId: usuario?.id ?? null,
        });
        if (pessoa.ativo === false) {
          await funcionarios.atualizar(criado.id, { ativo: false });
        }
      }
    });
  },
};
