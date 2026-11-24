import type { VariavelDeMensagem } from '@gymos/shared-templates';
import type { DataCivil } from '../../platform/domain/relogio';
import type {
  Canal,
  FormaDeCobranca,
  FormaDoPagamento,
  FormaPreferida,
  Origem,
  Pagamento,
  Setor,
  SituacaoDoPagamento,
} from '../domain/pagamento';
import type { NovaParcela, Parcela, SituacaoDaParcela } from '../domain/parcela';

// Portas do domínio cobrança. Os repositórios rodam no contexto do tenant (RLS).

export type CamposDaParcela = Partial<
  Pick<Parcela, 'vencimento' | 'situacao' | 'pagoCentavos' | 'suspensaDesde'>
>;

export abstract class RepositorioDeParcelas {
  /** Cria o cronograma de um período; parcelas que já existem (mesmo período e número) ficam. */
  abstract criarCronograma(
    contrato: { contratoId: string; alunoId: string; periodo: DataCivil },
    parcelas: readonly NovaParcela[],
  ): Promise<number>;
  abstract porId(id: string): Promise<Parcela | null>;
  /** Lê a parcela travando a linha (FOR UPDATE) até o fim da transação. */
  abstract travar(id: string): Promise<Parcela | null>;
  abstract doContrato(contratoId: string): Promise<Parcela[]>;
  /** Por vencimento. */
  abstract doAluno(alunoId: string): Promise<Parcela[]>;
  abstract atualizar(id: string, campos: CamposDaParcela): Promise<Parcela>;
  abstract comSituacao(situacoes: readonly SituacaoDaParcela[]): Promise<Parcela[]>;
  /** Em aberto com vencimento antes de `hoje`, para a rotina diária. */
  abstract vencidasEmAberto(hoje: DataCivil): Promise<Parcela[]>;
  /** LGPD: tira o aluno e cancela o que ainda estava a receber. */
  abstract anonimizarDoAluno(alunoId: string): Promise<number>;
}

export interface DadosDaCobranca {
  pixCopiaECola?: string;
  pixQrCode?: string;
  linhaDigitavel?: string;
  /** Página de pagamento (link, boleto ou checkout do cartão). */
  url?: string;
}

export type SituacaoDaCobranca = 'pendente' | 'paga' | 'cancelada';

export interface Cobranca {
  id: string;
  parcelaId: string | null;
  alunoId: string | null;
  forma: FormaDeCobranca;
  valorCentavos: number;
  vencimento: DataCivil;
  provedor: string;
  idExterno: string;
  situacao: SituacaoDaCobranca;
  dados: DadosDaCobranca;
  criadoEm: Date;
}

export abstract class RepositorioDeCobrancas {
  /** O id vem do caso de uso: é a referência enviada ao provedor antes de gravar. */
  abstract criar(dados: Omit<Cobranca, 'criadoEm'>): Promise<Cobranca>;
  abstract porId(id: string): Promise<Cobranca | null>;
  abstract porIdExterno(provedor: string, idExterno: string): Promise<Cobranca | null>;
  abstract pendentesDaParcela(parcelaId: string): Promise<Cobranca[]>;
  abstract atualizarSituacao(id: string, situacao: SituacaoDaCobranca): Promise<void>;
  abstract doAluno(alunoId: string): Promise<Cobranca[]>;
  abstract anonimizarDoAluno(alunoId: string): Promise<number>;
}

export interface NovoPagamento {
  parcelaId: string | null;
  cobrancaId: string | null;
  contratoId: string | null;
  alunoId: string;
  valorCentavos: number;
  taxaCentavos: number;
  forma: FormaDoPagamento;
  canal: Canal;
  origem: Origem;
  setor: Setor;
  emDuplicidade: boolean;
  provedor: string | null;
  idEventoExterno: string | null;
  confirmadoEm: Date;
}

export abstract class RepositorioDePagamentos {
  abstract criar(dados: NovoPagamento): Promise<Pagamento>;
  abstract porId(id: string): Promise<Pagamento | null>;
  abstract porEventoExterno(provedor: string, idEvento: string): Promise<Pagamento | null>;
  abstract daCobranca(cobrancaId: string): Promise<Pagamento[]>;
  /** Mais recentes primeiro. */
  abstract doAluno(alunoId: string): Promise<Pagamento[]>;
  abstract atualizarEstorno(
    id: string,
    campos: { estornadoCentavos: number; situacao: SituacaoDoPagamento },
  ): Promise<Pagamento>;
  /** Pagamentos em duplicidade ainda não estornados (alerta). */
  abstract emDuplicidadeAEstornar(): Promise<Pagamento[]>;
  abstract anonimizarDoAluno(alunoId: string): Promise<number>;
}

export interface Estorno {
  id: string;
  pagamentoId: string;
  valorCentavos: number;
  motivo: string;
  provedor: string | null;
  estornadoEm: Date;
}

export abstract class RepositorioDeEstornos {
  abstract criar(dados: Omit<Estorno, 'id'> & { idEventoExterno: string | null }): Promise<Estorno>;
  abstract porEventoExterno(provedor: string, idEvento: string): Promise<Estorno | null>;
  abstract doPagamento(pagamentoId: string): Promise<Estorno[]>;
}

export interface FormaDePagamentoDoAluno {
  alunoId: string;
  forma: FormaPreferida;
  /** Token do cartão no provedor; nenhum dado do cartão passa pelo nosso servidor. */
  tokenDoCartao: string | null;
  finalDoCartao: string | null;
  atualizadoEm: Date;
}

export abstract class RepositorioDeFormasDePagamento {
  abstract doAluno(alunoId: string): Promise<FormaDePagamentoDoAluno | null>;
  abstract salvar(forma: FormaDePagamentoDoAluno): Promise<FormaDePagamentoDoAluno>;
  abstract excluirDoAluno(alunoId: string): Promise<number>;
}

/** O que a cobrança precisa saber do aluno (o cadastro é do domínio alunos). */
export abstract class AlunosDaCobranca {
  abstract nomes(ids: readonly string[]): Promise<Map<string, string>>;
}

/** Liga o id externo da cobrança ao tenant, para o webhook sem tenant no caminho. */
export abstract class ReferenciasExternas {
  abstract registrar(provedor: string, idExterno: string, cobrancaId: string): Promise<void>;
}

// ---------- Provedor de pagamento (ADR-009) ----------

export interface PedidoDeCobranca {
  /** Nosso id da cobrança: é a referência no provedor. */
  referencia: string;
  forma: FormaDeCobranca;
  valorCentavos: number;
  vencimento: DataCivil;
  descricao: string;
  /** Só cartão: token gerado no navegador pelo SDK do provedor. */
  tokenDoCartao: string | null;
}

export interface CobrancaNoProvedor {
  idExterno: string;
  dados: DadosDaCobranca;
}

export type EventoDoProvedor =
  | {
      tipo: 'pagamento_confirmado';
      /** Id do evento no provedor: chave de idempotência do webhook. */
      idEvento: string;
      idCobranca: string;
      valorCentavos: number;
      taxaCentavos: number;
      forma: FormaDeCobranca;
      ocorridoEm: Date;
    }
  | {
      tipo: 'pagamento_estornado';
      idEvento: string;
      idCobranca: string;
      valorCentavos: number;
      ocorridoEm: Date;
    };

/**
 * Porta do provedor de pagamento (ADR-009). O adapter real entra quando o provedor for escolhido;
 * até lá, o fake determinístico com páginas de pagamento simuladas em dev.
 */
export abstract class GatewayDePagamento {
  /** Nome do provedor nas referências externas e na rota do webhook (`/webhooks/<provedor>`). */
  abstract readonly provedor: string;
  abstract criarCobranca(pedido: PedidoDeCobranca): Promise<CobrancaNoProvedor>;
  abstract consultar(idExterno: string): Promise<SituacaoDaCobranca>;
  abstract cancelar(idExterno: string): Promise<void>;
  /** Estorno total ou parcial; o id devolvido é o `idEvento` do webhook de estorno correspondente. */
  abstract estornar(idExterno: string, valorCentavos: number): Promise<{ idEstorno: string }>;
  /** Verifica a assinatura do webhook (cabeçalhos em minúsculas). */
  abstract assinaturaValida(
    corpo: unknown,
    cabecalhos: Record<string, string | undefined>,
  ): boolean;
  abstract interpretar(corpo: unknown): EventoDoProvedor | null;
}

// ---------- Mensageria (T13d) ----------

export interface MensagemTransacional {
  alunoId: string;
  finalidade: 'transacional';
  contexto: 'cobranca';
  variaveis: Partial<Record<VariavelDeMensagem, string>>;
}

/** Envio de mensagens ao aluno; a implementação (WhatsApp, e-mail) é da Mensageria (T13d). */
export abstract class Mensageria {
  abstract enviar(mensagem: MensagemTransacional): Promise<void>;
}
