// Catálogo dos eventos de domínio do GymOS (ADR-007). Cada evento tem um tipo, uma versão e o
// payload daquela versão. O payload viaja em JSON pelo outbox e pelas filas: datas são ISO 8601
// (`yyyy-MM-dd` para dia do calendário), dinheiro em centavos inteiros e ids em UUID.
//
// Os payloads abaixo são o ponto de partida do T13a: o dono de cada domínio ajusta o do seu evento
// no primeiro PR do domínio. Mudança incompatível sobe a versão e mantém a anterior enquanto houver
// consumidor dela.

/** Id em UUID. */
type Id = string;
/** Instante em ISO 8601 com fuso (`2026-11-23T14:00:00.000Z`). */
type Instante = string;
/** Dia do calendário (`yyyy-MM-dd`), sem hora. */
type Dia = string;

export interface CatalogoDeEventos {
  AlunoCadastrado: { versao: 1; payload: { alunoId: Id; unidadeId: Id; nome: string } };
  ContratoCriado: {
    versao: 1;
    payload: { contratoId: Id; alunoId: Id; planoId: Id; inicio: Dia; valorEmCentavos: number };
  };
  ContratoRenovado: {
    versao: 1;
    payload: { contratoId: Id; alunoId: Id; novoFim: Dia; valorEmCentavos: number };
  };
  ContratoEncerrado: {
    versao: 1;
    payload: { contratoId: Id; alunoId: Id; encerradoEm: Dia; motivo: string };
  };
  ContratoReativado: { versao: 1; payload: { contratoId: Id; alunoId: Id; reativadoEm: Dia } };
  ContratoTrancado: {
    versao: 1;
    payload: { contratoId: Id; alunoId: Id; inicio: Dia; fim: Dia };
  };
  ContratoDestrancado: { versao: 1; payload: { contratoId: Id; alunoId: Id; destrancadoEm: Dia } };
  CobrancaCriada: {
    versao: 1;
    payload: {
      cobrancaId: Id;
      alunoId: Id;
      contratoId: Id | null;
      valorEmCentavos: number;
      vencimento: Dia;
    };
  };
  PagamentoConfirmado: {
    versao: 1;
    payload: {
      pagamentoId: Id;
      cobrancaId: Id;
      alunoId: Id;
      valorEmCentavos: number;
      meio: string;
      confirmadoEm: Instante;
    };
  };
  PagamentoAtrasado: {
    versao: 1;
    payload: { cobrancaId: Id; alunoId: Id; vencimento: Dia; valorEmCentavos: number };
  };
  PagamentoEstornado: {
    versao: 1;
    payload: {
      pagamentoId: Id;
      cobrancaId: Id;
      alunoId: Id;
      valorEmCentavos: number;
      estornadoEm: Instante;
    };
  };
  AcessoRegistrado: {
    versao: 1;
    payload: {
      acessoId: Id;
      alunoId: Id | null;
      unidadeId: Id;
      liberado: boolean;
      registradoEm: Instante;
    };
  };
  MensagemRecebida: {
    versao: 1;
    payload: { mensagemId: Id; conversaId: Id; canal: string; recebidaEm: Instante };
  };
}

export type TipoDeEvento = keyof CatalogoDeEventos;
export type VersaoDoEvento<T extends TipoDeEvento> = CatalogoDeEventos[T]['versao'];
export type PayloadDoEvento<T extends TipoDeEvento> = CatalogoDeEventos[T]['payload'];

/** Envelope gravado no outbox e entregue aos consumidores. */
export interface EventoDeDominio<T extends TipoDeEvento = TipoDeEvento> {
  /** Id do evento; com o nome do consumidor, é a chave de idempotência. */
  id: Id;
  tipo: T;
  versao: VersaoDoEvento<T>;
  tenantId: Id;
  ocorridoEm: Instante;
  payload: PayloadDoEvento<T>;
}

/** O que o caso de uso entrega para publicar; id, tenant e instante são da plataforma. */
export interface NovoEvento<T extends TipoDeEvento = TipoDeEvento> {
  tipo: T;
  payload: PayloadDoEvento<T>;
}

/** Versão que o produtor publica hoje de cada evento. */
export const VERSAO_ATUAL: { readonly [T in TipoDeEvento]: VersaoDoEvento<T> } = {
  AlunoCadastrado: 1,
  ContratoCriado: 1,
  ContratoRenovado: 1,
  ContratoEncerrado: 1,
  ContratoReativado: 1,
  ContratoTrancado: 1,
  ContratoDestrancado: 1,
  CobrancaCriada: 1,
  PagamentoConfirmado: 1,
  PagamentoAtrasado: 1,
  PagamentoEstornado: 1,
  AcessoRegistrado: 1,
  MensagemRecebida: 1,
};

export const TIPOS_DE_EVENTO = Object.keys(VERSAO_ATUAL) as readonly TipoDeEvento[];

export function ehTipoDeEvento(valor: unknown): valor is TipoDeEvento {
  return typeof valor === 'string' && Object.hasOwn(VERSAO_ATUAL, valor);
}
