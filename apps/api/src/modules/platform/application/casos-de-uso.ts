import { Injectable } from '@nestjs/common';
import {
  COR_DE_DESTAQUE_PADRAO,
  type IdentidadeDoTenant,
  slugDisponivelParaAcademia,
  type Tenant,
} from '../domain/tenant';
import { ConviteDoAdministrador, RepositorioDeTenants } from './portas';

export class SlugInvalidoError extends Error {
  constructor(readonly slug: string) {
    super(
      `"${slug}" não serve de endereço: use letras minúsculas, números e hífen, sem nomes reservados.`,
    );
    this.name = 'SlugInvalidoError';
  }
}

export class SlugEmUsoError extends Error {
  constructor(readonly slug: string) {
    super(`Já existe uma academia com o endereço "${slug}".`);
    this.name = 'SlugEmUsoError';
  }
}

export interface DadosDaNovaAcademia {
  slug: string;
  nome: string;
  adminEmail: string;
  corDestaque?: string;
  nomeDaUnidade?: string;
}

export interface AcademiaCriada {
  tenantId: string;
  slug: string;
  unidadeId: string;
  linkDoConvite: string;
}

export const NOME_DA_PRIMEIRA_UNIDADE = 'Unidade principal';

/** Cria tenant e primeira unidade e convida o administrador (comando e endpoint interno). */
@Injectable()
export class CriarAcademia {
  constructor(
    private readonly tenants: RepositorioDeTenants,
    private readonly convite: ConviteDoAdministrador,
  ) {}

  async executar(dados: DadosDaNovaAcademia): Promise<AcademiaCriada> {
    if (!slugDisponivelParaAcademia(dados.slug)) {
      throw new SlugInvalidoError(dados.slug);
    }
    if (await this.tenants.porSlug(dados.slug)) {
      throw new SlugEmUsoError(dados.slug);
    }
    const { tenant, unidadeId } = await this.tenants.criarComUnidade({
      slug: dados.slug,
      nome: dados.nome,
      corDestaque: dados.corDestaque ?? COR_DE_DESTAQUE_PADRAO,
      nomeDaUnidade: dados.nomeDaUnidade ?? NOME_DA_PRIMEIRA_UNIDADE,
    });
    const { link } = await this.convite.convidar({ tenant, email: dados.adminEmail });
    return { tenantId: tenant.id, slug: tenant.slug, unidadeId, linkDoConvite: link };
  }
}

/** Passo 1 dos Primeiros passos (T17) e Configurações (T26c). A permissão chega no T12. */
@Injectable()
export class AtualizarIdentidadeDoTenant {
  constructor(private readonly tenants: RepositorioDeTenants) {}

  executar(identidade: IdentidadeDoTenant): Promise<Tenant> {
    return this.tenants.atualizarIdentidade(identidade);
  }
}
