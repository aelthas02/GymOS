import type { Schemas } from '@gymos/api-contracts';

export type Plano = Schemas['PlanoDto'];
export type DadosDoPlano = Schemas['DadosDoPlanoDto'];
export type PreviaDoPlano = Schemas['PreviaDoPlanoDto'];
export type FormaDeCobranca = DadosDoPlano['formaDeCobranca'];

/** Campos que mudam o valor da parcela; a API é quem calcula (`GET /planos/previa`). */
export interface ConsultaDaPrevia {
  readonly valorTotalCentavos: number;
  readonly duracaoMeses: number;
  readonly parcelas: number;
}
