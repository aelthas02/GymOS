import type { ContextoDeMensagem, VariavelDeMensagem } from '@gymos/shared-templates';
import type { CanalMeta, ConexaoMeta, EstadoDaConexao } from '../domain/meta';
import type {
  CanalDeMensagem,
  EstadoDaMensagem,
  FinalidadeDeMensagem,
  MotivoDaRecusa,
} from '../domain/mensagens';

// Portas do domínio integracoes. Os repositórios usam o cliente da transação do tenant (RLS); os
// provedores (Meta, WhatsApp, IA, armazenamento) são as saídas para fora, cada uma com adapter fake.

// ---------- Conexões Meta ----------

export interface ContaNaMeta {
  contaId: string;
  contaNome: string;
  token: string;
  expiraEm: Date;
  /** WhatsApp: a verificação da empresa na Meta já foi concluída. */
  verificada: boolean;
}

/** Fluxos oficiais da Meta: OAuth do Instagram e do Facebook e o cadastro do WhatsApp Business. */
export abstract class ProvedorMeta {
  /** Endereço do fluxo oficial para o usuário autorizar (OAuth) ou cadastrar o WhatsApp. */
  abstract urlDoFluxo(canal: CanalMeta, estado: string, redirecionarPara: string): string;
  /** Troca o código devolvido pelo fluxo por um token de longa duração; lança se o código não vale. */
  abstract trocarCodigo(canal: CanalMeta, codigo: string, agora: Date): Promise<ContaNaMeta>;
  /** WhatsApp: a Meta já verificou a empresa? */
  abstract verificada(token: string): Promise<boolean>;
  abstract renovar(token: string, agora: Date): Promise<{ token: string; expiraEm: Date }>;
  abstract revogar(token: string): Promise<void>;
}

export interface DadosDaConexao {
  canal: CanalMeta;
  estado: EstadoDaConexao;
  contaId?: string | null;
  contaNome?: string | null;
  /** Em claro: o repositório cifra. `null` apaga; omitido mantém. */
  token?: string | null;
  expiraEm?: Date | null;
  conectadoEm?: Date | null;
  atualizadoEm: Date;
}

export abstract class RepositorioDeConexoes {
  abstract todas(): Promise<ConexaoMeta[]>;
  abstract porCanal(canal: CanalMeta): Promise<ConexaoMeta | null>;
  /** Uma conexão por canal: grava a primeira vez e atualiza depois. */
  abstract salvar(dados: DadosDaConexao): Promise<ConexaoMeta>;
  /** Token decifrado; uso interno (renovação e revogação), nunca sai pela API. */
  abstract token(canal: CanalMeta): Promise<string | null>;
  /** Conectadas que vencem até `ate`. */
  abstract aVencer(ate: Date): Promise<ConexaoMeta[]>;
}

// ---------- Mensageria ----------

export interface PedidoDeMensagem {
  alunoId: string;
  finalidade: FinalidadeDeMensagem;
  /** Catálogo de variáveis do modelo; padrão `cobranca` (marketing não leva `{link}`). */
  contexto?: ContextoDeMensagem;
  /** Texto com `{variaveis}` (T08). Sem ele, vale o modelo de cobrança. */
  modelo?: string;
  assunto?: string;
  /** Sem canal, vai pelo WhatsApp se conectado e, se não, pelo e-mail. */
  canal?: CanalDeMensagem;
  /** Valores já conhecidos de quem pede; têm prioridade sobre os provedores de variável. */
  variaveis?: Partial<Record<VariavelDeMensagem, string>>;
}

export type ResultadoDoEnvio =
  | { enviada: true; mensagemId: string; canal: CanalDeMensagem }
  | { enviada: false; mensagemId: string; motivo: MotivoDaRecusa };

export interface Mensagem {
  id: string;
  alunoId: string | null;
  direcao: 'enviada' | 'recebida';
  canal: CanalDeMensagem;
  finalidade: FinalidadeDeMensagem | null;
  contexto: ContextoDeMensagem | null;
  texto: string;
  estado: EstadoDaMensagem;
  motivo: MotivoDaRecusa | null;
  idExterno: string | null;
  criadoEm: Date;
}

export type NovaMensagem = Omit<Mensagem, 'id' | 'criadoEm'> & { criadoEm: Date };

export abstract class RepositorioDeMensagens {
  abstract criar(dados: NovaMensagem): Promise<Mensagem>;
  abstract porIdExterno(idExterno: string): Promise<Mensagem | null>;
  abstract atualizarEstado(
    id: string,
    estado: EstadoDaMensagem,
    quando: Date,
    idExterno?: string,
    motivo?: MotivoDaRecusa,
  ): Promise<void>;
  /** Mais recentes primeiro. */
  abstract doAluno(alunoId: string): Promise<Mensagem[]>;
  abstract excluirDoAluno(alunoId: string): Promise<number>;
}

/** Canal de WhatsApp (Meta Cloud API). O telefone só passa por aqui, nunca é gravado. */
export abstract class TransporteDeWhatsapp {
  abstract enviar(mensagem: {
    tenantId: string;
    telefone: string;
    texto: string;
  }): Promise<{ idExterno: string }>;
}

export interface ContatoDoAluno {
  nome: string;
  telefone: string | null;
  email: string | null;
}

/** O que a Mensageria precisa do cadastro do aluno; o domínio de alunos registra a fonte. */
export interface FonteDeContatos {
  contato(alunoId: string): Promise<ContatoDoAluno | null>;
  /** Aluno dono do telefone (resposta recebida pelo webhook), pelo índice cego. */
  idPorTelefone(telefone: string): Promise<string | null>;
}

/** Dono de uma variável de mensagem: devolve o texto para o aluno, ou null se não tem. */
export interface ProvedorDeVariavel {
  variavel: VariavelDeMensagem;
  valor(alunoId: string): Promise<string | null>;
}

// ---------- GeradorIA ----------

export type TipoDeCampoGerado = 'texto' | 'lista';

export interface PedidoAoProvedorDeIA {
  instrucao: string;
  dados: Record<string, unknown>;
  /** Campos esperados na resposta. */
  formato: Record<string, TipoDeCampoGerado>;
}

export type ResultadoGerado = Record<string, string | string[]>;

export abstract class ProvedorDeIA {
  abstract readonly nome: string;
  abstract gerar(pedido: PedidoAoProvedorDeIA): Promise<ResultadoGerado>;
}

export interface NovoUsoDeIA {
  finalidade: string;
  provedor: string;
  tokensEntrada: number;
  tokensSaida: number;
}

export abstract class RepositorioDeUsoDeIA {
  abstract registrar(uso: NovoUsoDeIA): Promise<void>;
  abstract totalDoPeriodo(
    de: Date,
    ate: Date,
  ): Promise<{ chamadas: number; tokensEntrada: number; tokensSaida: number }>;
}

// ---------- Armazenamento ----------

/** Back-end de objetos (S3 compatível ou fake). As regras de chave e validação são do `Armazenamento`. */
export abstract class ObjetosDeArmazenamento {
  abstract gravar(chave: string, conteudo: Buffer, tipo: string): Promise<void>;
  abstract remover(chave: string): Promise<void>;
  /** URL que abre só este objeto até `expiraEm`. */
  abstract urlAssinada(chave: string, expiraEm: Date, agora: Date): Promise<string>;
}

// ---------- Contexto ----------

/** Tenant da requisição ou do job em andamento (a implementação lê o ContextoDoTenant). */
export abstract class TenantDoContexto {
  abstract id(): string;
}

/** Assina e confere o `state` do fluxo da Meta: amarra o retorno ao tenant, ao canal e ao prazo. */
export abstract class AssinadorDoFluxo {
  abstract assinar(canal: CanalMeta, expiraEm: Date): string;
  abstract valido(estado: string, canal: CanalMeta, agora: Date): boolean;
}
