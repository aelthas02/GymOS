import type { Destinatario, TipoDeAviso, TipoDeDestinatario } from '../domain/aviso';

// Portas do domínio avisos. Os repositórios usam o cliente da transação do tenant (RLS); o WebPush
// é a única saída para fora (provedores de push dos navegadores).

export interface Aviso {
  id: string;
  destinatarioTipo: TipoDeDestinatario;
  destinatarioId: string;
  tipo: TipoDeAviso;
  titulo: string;
  texto: string;
  link: string | null;
  lidoEm: Date | null;
  criadoEm: Date;
}

export interface NovoAvisoGravado {
  destinatario: Destinatario;
  tipo: TipoDeAviso;
  titulo: string;
  texto: string;
  link: string | null;
  /** Instante do aviso, do Relogio (não o do banco): vale também com o relógio simulado. */
  criadoEm: Date;
  /** Só o seed cria avisos já lidos. */
  lidoEm?: Date | null;
}

export interface PaginaDeAvisos {
  itens: Aviso[];
  /** Nulo na última página. */
  proximoCursor: string | null;
}

export abstract class RepositorioDeAvisos {
  abstract criar(avisos: readonly NovoAvisoGravado[]): Promise<Aviso[]>;
  /** Do mais novo ao mais antigo; só os não lidos com `naoLidos`. */
  abstract listar(
    destinatario: Destinatario,
    consulta: { naoLidos: boolean; limite: number; cursor?: string },
  ): Promise<PaginaDeAvisos>;
  abstract contarNaoLidos(destinatario: Destinatario): Promise<number>;
  /** Falso quando o aviso não é do destinatário. Marcar de novo um aviso lido não muda a data. */
  abstract marcarComoLido(destinatario: Destinatario, id: string, quando: Date): Promise<boolean>;
  abstract marcarTodosComoLidos(destinatario: Destinatario, quando: Date): Promise<number>;
  abstract porIds(ids: readonly string[]): Promise<Aviso[]>;
  abstract doDestinatario(destinatario: Destinatario): Promise<Aviso[]>;
}

export interface InscricaoDePush {
  id: string;
  destinatarioTipo: TipoDeDestinatario;
  destinatarioId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  dispositivo: string | null;
  criadoEm: Date;
}

export interface DadosDaInscricao {
  endpoint: string;
  p256dh: string;
  auth: string;
  dispositivo?: string | null;
}

export abstract class RepositorioDeInscricoes {
  /** Um endpoint é um dispositivo: inscrever de novo atualiza as chaves e troca o dono. */
  abstract salvar(destinatario: Destinatario, dados: DadosDaInscricao): Promise<void>;
  /** Falso quando o endpoint não é do destinatário. */
  abstract remover(destinatario: Destinatario, endpoint: string): Promise<boolean>;
  abstract removerPorId(id: string): Promise<void>;
  abstract dosDestinatarios(
    tipo: TipoDeDestinatario,
    ids: readonly string[],
  ): Promise<InscricaoDePush[]>;
}

export interface PreferenciaDeAviso {
  tipo: TipoDeAviso;
  push: boolean;
}

export abstract class RepositorioDePreferencias {
  /** Só as preferências explícitas; o que falta está ligado. */
  abstract doDestinatario(destinatario: Destinatario): Promise<PreferenciaDeAviso[]>;
  abstract salvar(destinatario: Destinatario, preferencia: PreferenciaDeAviso): Promise<void>;
  /** Ids (entre `ids`) que desligaram o push desse tipo de aviso. */
  abstract comPushDesligado(
    tipoDestinatario: TipoDeDestinatario,
    ids: readonly string[],
    tipo: TipoDeAviso,
  ): Promise<Set<string>>;
}

export type EstadoDoAgendamento = 'pendente' | 'enviado' | 'cancelado';

export interface AvisoAgendado {
  id: string;
  chave: string | null;
  destinatario: Destinatario;
  tipo: TipoDeAviso;
  titulo: string;
  texto: string;
  link: string | null;
  push: boolean;
  quando: Date;
  estado: EstadoDoAgendamento;
}

export type NovoAgendamento = Omit<AvisoAgendado, 'id' | 'estado'>;

export abstract class RepositorioDeAgendamentos {
  abstract criar(dados: NovoAgendamento): Promise<AvisoAgendado>;
  abstract porId(id: string): Promise<AvisoAgendado | null>;
  /** Cancela o agendamento pendente; falso se não existe ou já foi enviado ou cancelado. */
  abstract cancelar(id: string): Promise<boolean>;
  /** Cancela os pendentes da chave e devolve quantos eram. */
  abstract cancelarPorChave(chave: string): Promise<number>;
  /** Pendente → enviado; falso se já não estava pendente (cancelado a tempo). */
  abstract marcarComoEnviado(id: string): Promise<boolean>;
}

/** Ids dos alunos que recebem um comunicado da academia (domínio de alunos). */
export abstract class DestinatariosDeComunicado {
  abstract todosOsAlunos(): Promise<string[]>;
}

export interface MensagemDePush {
  avisoId: string;
  tipo: TipoDeAviso;
  titulo: string;
  texto: string;
  link: string | null;
}

export interface AlvoDePush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type ResultadoDoPush = 'enviado' | 'expirada';

/**
 * Web Push com VAPID. `expirada` quando o provedor responde 404 ou 410 (a inscrição não vale mais);
 * qualquer outra falha é lançada e o chamador só registra: o aviso já está na caixa.
 */
export abstract class WebPush {
  /** Chave pública VAPID que o navegador usa em `applicationServerKey` (base64url). */
  abstract chavePublica(): string;
  abstract enviar(alvo: AlvoDePush, mensagem: MensagemDePush): Promise<ResultadoDoPush>;
}

/**
 * Programa o envio de um aviso agendado para a hora marcada (fila `notificacoes`, no tenant do
 * contexto). Cancelar é marcar o agendamento: o job que chegar na hora não faz nada.
 */
export abstract class AgendadorDeAvisos {
  abstract agendar(agendamentoId: string, quando: Date): Promise<void>;
}
