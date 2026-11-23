import type { IdentidadeDoTenant, Tenant } from '../domain/tenant';

export interface NovaAcademia {
  slug: string;
  nome: string;
  corDestaque: string;
  nomeDaUnidade: string;
}

/** Leitura e escrita de tenants, só pelas funções gymos_* do banco. */
export abstract class RepositorioDeTenants {
  abstract porSlug(slug: string): Promise<Tenant | null>;
  abstract porId(id: string): Promise<Tenant | null>;
  abstract listar(): Promise<Array<Pick<Tenant, 'id' | 'slug'>>>;
  /** Cria o tenant e a primeira unidade na mesma transação. */
  abstract criarComUnidade(dados: NovaAcademia): Promise<{ tenant: Tenant; unidadeId: string }>;
  /** Atualiza a identidade do tenant do contexto atual. */
  abstract atualizarIdentidade(identidade: IdentidadeDoTenant): Promise<Tenant>;
  /** Tenant dono de um id externo, para webhooks que não carregam o tenant. */
  abstract tenantDaReferenciaExterna(provedor: string, idExterno: string): Promise<string | null>;
}

/** Convite do primeiro administrador. O T12 troca o adapter provisório pelo convite real. */
export abstract class ConviteDoAdministrador {
  abstract convidar(dados: { tenant: Tenant; email: string }): Promise<{ link: string }>;
}

export type ResultadoDoWebhook = 'processado' | 'recurso-nao-encontrado';

/**
 * Integração que recebe webhooks. `processar` sempre roda dentro de runAsTenant, então só enxerga
 * os recursos do tenant da rota (ou do dono do id externo).
 */
export abstract class ProvedorDeWebhook {
  abstract readonly nome: string;
  /** Id externo do recurso no corpo do evento, para a rota sem tenant. */
  abstract idExterno(corpo: unknown): string | null;
  abstract processar(corpo: unknown): Promise<ResultadoDoWebhook>;
}

export const PROVEDORES_DE_WEBHOOK = Symbol('ProvedoresDeWebhook');
