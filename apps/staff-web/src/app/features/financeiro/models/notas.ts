import type { Schemas } from '@gymos/api-contracts';

export type NotaFiscal = Schemas['NotaFiscalDto'];
export type NotaFiscalDetalhe = Schemas['NotaFiscalDetalheDto'];
export type ResumoDasNotas = Schemas['ResumoDasNotasDto'];
export type SugestaoDeNota = Schemas['SugestaoDeNotaDto'];
export type PreviaDaNota = Schemas['PreviaDaNotaDto'];
export type TipoDeNota = NotaFiscal['tipo'];
export type SituacaoDaNota = NotaFiscal['situacao'];
export type ItemDaListaDeAlunos = Schemas['PaginaDeAlunosDto']['itens'][number];
