import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { planosDoFixture, respostasDaSessao } from './sessao.fixture';

/** Nome do arquivo que `Importar.html` mostra no cabeçalho do passo 2. */
export const NOME_DA_PLANILHA = 'alunos-sistema-antigo.xlsx';
export const TOTAL_DE_LINHAS = 312;
export const LINHAS_COM_CPF_INVALIDO = 12;
/** Planos da planilha que não existem em Planos: as linhas com eles voltam em "para corrigir". */
export const PLANOS_INEXISTENTES = ['Black', 'Família', 'Corporativo'] as const;

export const CABECALHOS = [
  'Nome completo',
  'CPF',
  'Telefone',
  'Plano',
  'Vencimento',
  'Observações',
] as const;

function digitoDoCpf(digitos: readonly number[]): number {
  const peso = digitos.length + 1;
  const soma = digitos.reduce((total, digito, indice) => total + digito * (peso - indice), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** CPF válido a partir de um número de 0 a 999 999 999 (com a pontuação do protótipo). */
function cpfValido(base: number): string {
  const digitos = String(100_000_000 + base)
    .slice(0, 9)
    .split('')
    .map(Number);
  const primeiro = digitoDoCpf(digitos);
  const segundo = digitoDoCpf([...digitos, primeiro]);
  const todos = [...digitos, primeiro, segundo].join('');
  return `${todos.slice(0, 3)}.${todos.slice(3, 6)}.${todos.slice(6, 9)}-${todos.slice(9)}`;
}

/** Troca o último dígito: o CPF deixa de ser válido. */
function cpfInvalido(base: number): string {
  const valido = cpfValido(base);
  return `${valido.slice(0, -1)}${(Number(valido.slice(-1)) + 1) % 10}`;
}

/**
 * As 312 linhas da planilha de `Importar.html`: 12 com CPF inválido (a primeira é a do exemplo da
 * tela, `123.456.789-00`) e 3 com plano que não existe. Sobram 300 linhas importáveis.
 */
export function linhasDaPlanilha(): string[][] {
  const planos = planosDoFixture.map((plano) => plano.nome);
  return Array.from({ length: TOTAL_DE_LINHAS }, (_, indice) => {
    if (indice === 0) {
      return [
        'Rafael Souza',
        '123.456.789-00',
        '(11) 99999-0000',
        'Mensal',
        '10/12/2026',
        'Lesão no ombro',
      ];
    }
    const invalida = indice <= LINHAS_COM_CPF_INVALIDO - 1;
    const inexistente = PLANOS_INEXISTENTES[indice - LINHAS_COM_CPF_INVALIDO];
    return [
      `Aluno ${String(indice + 1).padStart(3, '0')}`,
      invalida ? cpfInvalido(indice) : cpfValido(indice),
      `(11) 9${String(1000 + indice).padStart(4, '0')}-${String(2000 + indice).padStart(4, '0')}`,
      inexistente ?? planos[indice % planos.length] ?? 'Mensal',
      '10/12/2026',
      '',
    ];
  });
}

/** O relatório que a API devolve para essa planilha: 12 puladas e 3 para corrigir. */
export const relatorioDaImportacao: Schemas['RelatorioDaImportacaoDto'] = {
  criados: 300,
  comContrato: 297,
  semContrato: 3,
  linhas: [
    ...Array.from({ length: LINHAS_COM_CPF_INVALIDO }, (_, indice) => ({
      linha: indice + 1,
      nome: indice === 0 ? 'Rafael Souza' : `Aluno ${String(indice + 1).padStart(3, '0')}`,
      cpf: indice === 0 ? '123.456.789-00' : cpfInvalido(indice),
      situacao: 'pulada' as const,
      motivo: 'CPF inválido',
    })),
    ...PLANOS_INEXISTENTES.map((plano, indice) => ({
      linha: LINHAS_COM_CPF_INVALIDO + indice + 1,
      nome: `Aluno ${String(LINHAS_COM_CPF_INVALIDO + indice + 1).padStart(3, '0')}`,
      cpf: cpfValido(LINHAS_COM_CPF_INVALIDO + indice),
      situacao: 'para_corrigir' as const,
      motivo: `Plano "${plano}" não encontrado: aluno criado sem contrato`,
    })),
  ],
};

/** Fixture de `/alunos/importar` (ADR-019). Relógio padrão. */
export default {
  respostas: [
    ...respostasDaSessao,
    { caminho: '/planos', corpo: planosDoFixture },
    { caminho: '/alunos/importacao', metodo: 'POST', corpo: relatorioDaImportacao },
  ],
} satisfies FixtureDeTela;
