import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConviteDoAdministrador } from '../../platform/application/portas';
import type { Tenant } from '../../platform/domain/tenant';
import {
  CONFIGURACAO_DA_PLATAFORMA,
  type ConfiguracaoDaPlataforma,
} from '../../platform/infra/configuracao';
import { ExecutorDeTenant } from '../../platform/infra/contexto/executor-de-tenant';
import { ConvidarParaEquipe } from '../application/convites';
import {
  AoNegarPermissao,
  EnderecosDosApps,
  type PermissaoNegada,
  RepositorioDeTiposDeAcesso,
} from '../application/portas';
import { TIPOS_PADRAO } from '../domain/tipos-de-acesso';
import { CONFIGURACAO_DA_AUTENTICACAO, type ConfiguracaoDaAutenticacao } from './configuracao';

/** Até o T13b gravar na auditoria, o 403 vira um log de aviso. */
@Injectable()
export class AoNegarPermissaoNoLog extends AoNegarPermissao {
  private readonly logger = new Logger('Permissoes');

  async registrar(negada: PermissaoNegada): Promise<void> {
    this.logger.warn({ ...negada }, `Permissão ${negada.permissao} negada em ${negada.rota}.`);
  }
}

@Injectable()
export class EnderecosDaConfiguracao extends EnderecosDosApps {
  constructor(
    @Inject(CONFIGURACAO_DA_PLATAFORMA) private readonly plataforma: ConfiguracaoDaPlataforma,
    @Inject(CONFIGURACAO_DA_AUTENTICACAO) private readonly autenticacao: ConfiguracaoDaAutenticacao,
  ) {
    super();
  }

  painel(slug: string): string {
    return this.plataforma.urlDoPainel.replaceAll('{tenant}', slug);
  }

  app(slug: string): string {
    return this.autenticacao.urlDoApp.replaceAll('{tenant}', slug);
  }
}

/**
 * Convite do primeiro administrador ao criar a academia (substitui o adapter provisório do T11):
 * cria os tipos de acesso padrão do tenant e convida com o tipo Administrador.
 */
@Injectable()
export class ConviteDoAdministradorPorEmail extends ConviteDoAdministrador {
  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly tipos: RepositorioDeTiposDeAcesso,
    private readonly convidarParaEquipe: ConvidarParaEquipe,
  ) {
    super();
  }

  convidar({ tenant, email }: { tenant: Tenant; email: string }): Promise<{ link: string }> {
    return this.executor.runAsTenant(tenant.id, async () => {
      await this.tipos.garantirPadrao(TIPOS_PADRAO);
      const administrador = await this.tipos.porChave('administrador');
      const resultado = await this.convidarParaEquipe.executar(tenant, {
        email,
        nome: null,
        tipoDeAcessoId: administrador?.id ?? '',
      });
      if (resultado.tipo !== 'ok') {
        throw new Error(`Não foi possível convidar o administrador (${resultado.tipo}).`);
      }
      return { link: resultado.link };
    });
  }
}
