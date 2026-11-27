import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { contadoresDaLista } from './Alunos.fixture';
import { planosDoFixture, respostasDaSessao } from './sessao.fixture';

type Item = Schemas['ItemDaListaDeAlunosDto'];

const idDoAluno = (numero: number): string => `9c2e5a10-4d7b-4f31-8a52-00000000001${numero}`;

const plano = (nome: string): Item['plano'] => {
  const encontrado = planosDoFixture.find((item) => item.nome === nome);
  return encontrado ? { id: encontrado.id, nome } : null;
};

const atrasado = (numero: number, nome: string, nomeDoPlano: string, dias: number): Item => ({
  id: idDoAluno(numero),
  nome,
  plano: plano(nomeDoPlano),
  situacao: 'em_atraso',
  estadoDoContrato: 'tolerancia',
  diasDeAtraso: dias,
  venceEmDias: null,
});

const aVencer = (numero: number, nome: string, nomeDoPlano: string, dias: number): Item => ({
  id: idDoAluno(numero),
  nome,
  plano: plano(nomeDoPlano),
  situacao: 'a_vencer',
  estadoDoContrato: 'ativo',
  diasDeAtraso: 0,
  venceEmDias: dias,
});

/** Linhas de `AlunosLote.html`, na ordem da tela (o protótipo intercala atrasados e a vencer). */
export const alunosDoLote: Item[] = [
  atrasado(1, 'Rafael Souza', 'Mensal', 6),
  atrasado(2, 'Juliana Prado', 'Mensal', 2),
  aVencer(3, 'Camila Duarte', 'Trimestral', 3),
  atrasado(4, 'Bruno Lima', 'Trimestral', 9),
  atrasado(5, 'Marcos Vieira', 'Mensal', 4),
  aVencer(6, 'Letícia Ramos', 'Mensal', 5),
];

/** Quem o teste marca, como em `AlunosLote.html` ("3 alunos selecionados"). */
export const selecionadosDoLote = ['Rafael Souza', 'Juliana Prado', 'Camila Duarte'] as const;

/**
 * O servidor filtra uma situação por vez; a tela junta as duas listas sem repetir ninguém. O fixture
 * devolve as seis linhas da tela nas duas consultas para reproduzir a ordem do protótipo.
 */
const pagina: Schemas['PaginaDeAlunosDto'] = {
  itens: alunosDoLote,
  contadores: contadoresDaLista,
  proximoCursor: null,
};

/** Fixture de `/alunos/lote` (ADR-019). Relógio padrão. */
export default {
  respostas: [...respostasDaSessao, { caminho: /^\/alunos\?/, corpo: pagina }],
} satisfies FixtureDeTela;
