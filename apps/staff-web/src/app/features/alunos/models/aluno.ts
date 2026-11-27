import type { Schemas } from '@gymos/api-contracts';

export type ItemDaLista = Schemas['ItemDaListaDeAlunosDto'];
export type PaginaDeAlunos = Schemas['PaginaDeAlunosDto'];
export type ContadoresDeAlunos = Schemas['ContadoresDeAlunosDto'];
export type Aluno = Schemas['AlunoDto'];
export type DadosDoAluno = Schemas['DadosDoAlunoDto'];
export type CadastroDeAluno = Schemas['CadastrarAlunoDto'];
export type Consentimento = Schemas['ConsentimentoDto'];
export type Plano = Schemas['PlanoDto'];
export type Profissional = Schemas['ProfissionalDto'];
export type LinhaDaPlanilha = Schemas['LinhaDaPlanilhaDto'];
export type RelatorioDaImportacao = Schemas['RelatorioDaImportacaoDto'];
export type LinhaDoRelatorio = Schemas['LinhaDoRelatorioDto'];
export type Contrato = Schemas['ContratoDto'];
export type SituacaoDoAluno = Schemas['SituacaoDoAlunoDto'];
export type Parcela = Schemas['ParcelaDto'];
export type Pagamento = Schemas['PagamentoDto'];

/** Chips da lista: `todos` não manda filtro ao servidor. */
export type FiltroDeSituacao = 'todos' | 'em_dia' | 'a_vencer' | 'em_atraso';

export type EstadoDaTela = 'carregando' | 'pronto' | 'erro' | 'sem-permissao';
