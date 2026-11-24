import { somenteDigitos, validarEmail } from '@gymos/shared-validation';

// Regras do Funcionário (T26a): cargos, validação do cadastro e a decisão do que muda no acesso ao
// painel quando o cadastro muda. TypeScript puro.

export interface CargoDoCatalogo {
  chave: string;
  nome: string;
  /** Chip de filtro da tela Equipe a que o cargo pertence (Gerente e Outro só aparecem em "Todos"). */
  filtro: string | null;
}

export const CARGOS: readonly CargoDoCatalogo[] = [
  { chave: 'professor', nome: 'Professor', filtro: 'professor' },
  { chave: 'recepcao', nome: 'Recepção', filtro: 'recepcao' },
  { chave: 'nutricionista', nome: 'Nutricionista', filtro: 'nutricao' },
  { chave: 'limpeza', nome: 'Limpeza', filtro: 'limpeza' },
  { chave: 'manutencao', nome: 'Manutenção', filtro: 'manutencao' },
  { chave: 'administrativo', nome: 'Administrativo', filtro: 'administrativo' },
  { chave: 'gerente', nome: 'Gerente', filtro: null },
  { chave: 'outro', nome: 'Outro', filtro: null },
];

export type ChaveDoCargo =
  | 'professor'
  | 'recepcao'
  | 'nutricionista'
  | 'limpeza'
  | 'manutencao'
  | 'administrativo'
  | 'gerente'
  | 'outro';

/** Chips da tela Equipe, na ordem em que aparecem; "todos" soma tudo, inclusive Gerente e Outro. */
export const FILTROS_DA_EQUIPE = [
  'professor',
  'recepcao',
  'nutricao',
  'limpeza',
  'manutencao',
  'administrativo',
] as const;
export type FiltroDeCargo = (typeof FILTROS_DA_EQUIPE)[number];

/** Chave do cargo → chave do chip (nulo para Gerente e Outro). */
export function filtroDoCargo(cargo: string): FiltroDeCargo | null {
  const filtro = CARGOS.find((c) => c.chave === cargo)?.filtro ?? null;
  return filtro as FiltroDeCargo | null;
}

/** Cargos que a academia escala como profissional de atendimento (aulas T28, Saúde T30). */
export const CARGOS_DE_ATENDIMENTO: readonly string[] = ['professor', 'nutricionista'];

export const ehCargo = (valor: string): valor is ChaveDoCargo =>
  CARGOS.some((cargo) => cargo.chave === valor);

export class FuncionarioInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'FuncionarioInvalidoError';
  }
}

/** Dados de um funcionário depois de normalizados; `tipoDeAcessoId` nulo é "Sem acesso". */
export interface DadosDoFuncionario {
  nome: string;
  cargo: string;
  cargoDescricao: string | null;
  telefone: string | null;
  email: string | null;
  tipoDeAcessoId: string | null;
  custoMensalCentavos: number;
}

export interface EntradaDoFuncionario {
  nome: string;
  cargo: string;
  cargoDescricao?: string | null;
  telefone?: string | null;
  email?: string | null;
  tipoDeAcessoId?: string | null;
  custoMensalCentavos?: number;
}

const vazioParaNulo = (valor: string | null | undefined): string | null => {
  const limpo = valor?.trim() ?? '';
  return limpo === '' ? null : limpo;
};

/**
 * Valida e normaliza o cadastro. Com tipo de acesso, o e-mail de login é obrigatório; sem acesso, é
 * opcional (limpeza e manutenção ficam só no cadastro). O custo é centavo inteiro, nunca negativo.
 */
export function normalizarFuncionario(entrada: EntradaDoFuncionario): DadosDoFuncionario {
  const nome = entrada.nome.trim();
  if (nome === '') {
    throw new FuncionarioInvalidoError('O funcionário precisa de um nome.');
  }
  if (!ehCargo(entrada.cargo)) {
    throw new FuncionarioInvalidoError('Cargo inexistente.');
  }
  const cargoDescricao = vazioParaNulo(entrada.cargoDescricao);
  if (entrada.cargo === 'outro' && cargoDescricao === null) {
    throw new FuncionarioInvalidoError('Informe qual é o cargo.');
  }
  const email = vazioParaNulo(entrada.email)?.toLowerCase() ?? null;
  if (email !== null && !validarEmail(email)) {
    throw new FuncionarioInvalidoError('E-mail inválido.');
  }
  const tipoDeAcessoId = entrada.tipoDeAcessoId ?? null;
  if (tipoDeAcessoId !== null && email === null) {
    throw new FuncionarioInvalidoError('O e-mail de login é obrigatório para quem tem acesso.');
  }
  const custo = entrada.custoMensalCentavos ?? 0;
  if (!Number.isInteger(custo) || custo < 0) {
    throw new FuncionarioInvalidoError(
      'O custo mensal deve ser um valor em centavos, sem negativo.',
    );
  }
  const telefone = vazioParaNulo(entrada.telefone);
  return {
    nome,
    cargo: entrada.cargo,
    cargoDescricao: entrada.cargo === 'outro' ? cargoDescricao : null,
    telefone: telefone === null ? null : somenteDigitos(telefone),
    email,
    tipoDeAcessoId,
    custoMensalCentavos: custo,
  };
}

/** O que o acesso ao painel precisa fazer quando o cadastro passa de `antes` para `depois`. */
export type MudancaDeAcesso =
  | { tipo: 'nenhuma' }
  /** Passa a ter acesso: cria (ou religa) o usuário e convida quem ainda não tem senha. */
  | { tipo: 'conceder' }
  /** Já tinha acesso e o tipo mudou. */
  | { tipo: 'trocar-tipo' }
  /** Volta para "Sem acesso" ou foi inativado: o usuário é desativado e a sessão cai. */
  | { tipo: 'revogar' };

export interface EstadoDoAcesso {
  tipoDeAcessoId: string | null;
  ativo: boolean;
}

/** Só quem está ativo e tem tipo de acesso entra no painel. */
const temAcesso = (estado: EstadoDoAcesso): boolean =>
  estado.ativo && estado.tipoDeAcessoId !== null;

export function mudancaDeAcesso(antes: EstadoDoAcesso, depois: EstadoDoAcesso): MudancaDeAcesso {
  if (temAcesso(antes) && !temAcesso(depois)) {
    return { tipo: 'revogar' };
  }
  if (!temAcesso(antes) && temAcesso(depois)) {
    return { tipo: 'conceder' };
  }
  if (temAcesso(antes) && antes.tipoDeAcessoId !== depois.tipoDeAcessoId) {
    return { tipo: 'trocar-tipo' };
  }
  return { tipo: 'nenhuma' };
}
