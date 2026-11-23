import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { SlugEmUsoError } from '../../application/casos-de-uso';
import { type NovaAcademia, RepositorioDeTenants } from '../../application/portas';
import type { IdentidadeDoTenant, Tenant } from '../../domain/tenant';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { OPCOES_DA_TRANSACAO } from '../contexto/transacao-do-tenant';
import { PrismaService } from '../prisma/prisma.service';

interface LinhaDeTenant {
  id: string;
  slug: string;
  nome: string;
  cor_destaque: string;
  logotipo_url: string | null;
  plano: string;
  configurada: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIOLACAO_DE_UNICIDADE = '23505';

function paraTenant(linha: LinhaDeTenant): Tenant {
  return {
    id: linha.id,
    slug: linha.slug,
    nome: linha.nome,
    corDestaque: linha.cor_destaque,
    logotipoUrl: linha.logotipo_url,
    plano: linha.plano,
    configurada: linha.configurada,
  };
}

function violouUnicidade(error: unknown): boolean {
  const texto = error instanceof Error ? error.message : '';
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
    texto.includes(VIOLACAO_DE_UNICIDADE) ||
    texto.includes('tenant_slug_key')
  );
}

@Injectable()
export class RepositorioDeTenantsPrisma extends RepositorioDeTenants {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: ContextoDoTenant,
  ) {
    super();
  }

  async porSlug(slug: string): Promise<Tenant | null> {
    const [linha] = await this.prisma.$queryRaw<
      LinhaDeTenant[]
    >`SELECT * FROM gymos_tenant_por_slug(${slug})`;
    return linha ? paraTenant(linha) : null;
  }

  async porId(id: string): Promise<Tenant | null> {
    if (!UUID.test(id)) {
      return null;
    }
    const [linha] = await this.prisma.$queryRaw<
      LinhaDeTenant[]
    >`SELECT * FROM gymos_tenant_por_id(${id}::uuid)`;
    return linha ? paraTenant(linha) : null;
  }

  listar(): Promise<Array<Pick<Tenant, 'id' | 'slug'>>> {
    return this.prisma.$queryRaw<Array<Pick<Tenant, 'id' | 'slug'>>>`
      SELECT id, slug FROM gymos_listar_tenants()`;
  }

  async criarComUnidade(dados: NovaAcademia): Promise<{ tenant: Tenant; unidadeId: string }> {
    try {
      return await this.prisma.$transaction(async (cliente) => {
        const [criado] = await cliente.$queryRaw<Array<{ id: string }>>`
          SELECT gymos_criar_tenant(${dados.slug}, ${dados.nome}, ${dados.corDestaque}, NULL, 'base') AS id`;
        const tenantId = criado?.id ?? '';
        await cliente.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        const unidade = await cliente.unidade.create({
          data: { tenantId, nome: dados.nomeDaUnidade },
        });
        const [linha] = await cliente.$queryRaw<LinhaDeTenant[]>`
          SELECT * FROM gymos_tenant_por_id(${tenantId}::uuid)`;
        if (!linha) {
          throw new Error(`Tenant ${dados.slug} não encontrado logo após a criação.`);
        }
        return { tenant: paraTenant(linha), unidadeId: unidade.id };
      }, OPCOES_DA_TRANSACAO);
    } catch (error) {
      if (violouUnicidade(error)) {
        throw new SlugEmUsoError(dados.slug);
      }
      throw error;
    }
  }

  async atualizarIdentidade(identidade: IdentidadeDoTenant): Promise<Tenant> {
    const [linha] = await this.contexto.cliente().$queryRaw<LinhaDeTenant[]>`
      SELECT * FROM gymos_atualizar_identidade_do_tenant(
        ${identidade.nome}, ${identidade.corDestaque}, ${identidade.logotipoUrl})`;
    if (!linha) {
      throw new Error('O tenant do contexto não existe mais.');
    }
    return paraTenant(linha);
  }

  async tenantDaReferenciaExterna(provedor: string, idExterno: string): Promise<string | null> {
    const [linha] = await this.prisma.$queryRaw<Array<{ tenant_id: string | null }>>`
      SELECT gymos_tenant_da_referencia_externa(${provedor}, ${idExterno}) AS tenant_id`;
    return linha?.tenant_id ?? null;
  }
}
