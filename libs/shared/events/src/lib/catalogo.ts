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
    payload: {
      contratoId: Id;
      alunoId: Id;
      planoId: Id;
      inicio: Dia;
      valorEmCentavos: number;
      /** Em quantas parcelas o valor é cobrado (T19 gera o cronograma). */
      parcelas: number;
    };
  };
  ContratoRenovado: {
    versao: 1;
    payload: {
      contratoId: Id;
      alunoId: Id;
      /** Primeiro dia do novo período. */
      novoInicio: Dia;
      novoFim: Dia;
      valorEmCentavos: number;
      parcelas: number;
    };
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
      parcelaId: Id | null;
      /** pix, cartao, boleto ou link. */
      forma: string;
      valorEmCentavos: number;
      vencimento: Dia;
    };
  };
  PagamentoConfirmado: {
    versao: 1;
    payload: {
      pagamentoId: Id;
      /** Nulo no pagamento do balcão, que não passa pelo provedor. */
      cobrancaId: Id | null;
      parcelaId: Id | null;
      contratoId: Id | null;
      alunoId: Id;
      valorEmCentavos: number;
      taxaEmCentavos: number;
      meio: string;
      /** mensalidade, plano, aula_avulsa, personal, nutricao ou loja. */
      origem: string;
      /** Setor que recebe a receita, atribuído pela origem (o rateio é do T21). */
      setor: string;
      confirmadoEm: Instante;
    };
  };
  PagamentoAtrasado: {
    versao: 1;
    payload: {
      parcelaId: Id;
      contratoId: Id;
      alunoId: Id;
      vencimento: Dia;
      /** Saldo em aberto da parcela. */
      valorEmCentavos: number;
    };
  };
  PagamentoEstornado: {
    versao: 1;
    payload: {
      pagamentoId: Id;
      cobrancaId: Id | null;
      parcelaId: Id | null;
      alunoId: Id;
      valorEmCentavos: number;
      /** Estorno de todo o valor que restava do pagamento. */
      total: boolean;
      estornadoEm: Instante;
    };
  };
  /** Combinar nova data (T19): o vencimento da parcela mudou e o atraso foi zerado. */
  VencimentoCombinado: {
    versao: 1;
    payload: {
      parcelaId: Id;
      contratoId: Id;
      alunoId: Id;
      vencimentoAnterior: Dia;
      novoVencimento: Dia;
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
      /** facial, biometria, qr_code ou manual (T23a). */
      metodo: string;
      /** entrada ou saida. */
      direcao: string;
      /** liberado, tolerancia ou negado. */
      resultado: string;
      /** Chave do motivo da negação (ex.: mensalidade_em_atraso); nulo quando liberado. */
      motivo: string | null;
    };
  };
  MensagemRecebida: {
    versao: 1;
    payload: {
      mensagemId: Id;
      /** Hoje é o próprio aluno: a conversa é uma por aluno. */
      conversaId: Id;
      alunoId: Id;
      /** whatsapp ou email. */
      canal: string;
      recebidaEm: Instante;
    };
  };
  /** Avisos gravados com push pedido (T13e): o consumidor envia o Web Push depois do commit. */
  PushSolicitado: { versao: 1; payload: { avisoIds: Id[] } };
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
  VencimentoCombinado: 1,
  AcessoRegistrado: 1,
  MensagemRecebida: 1,
  PushSolicitado: 1,
};

export const TIPOS_DE_EVENTO = Object.keys(VERSAO_ATUAL) as readonly TipoDeEvento[];

export function ehTipoDeEvento(valor: unknown): valor is TipoDeEvento {
  return typeof valor === 'string' && Object.hasOwn(VERSAO_ATUAL, valor);
}
