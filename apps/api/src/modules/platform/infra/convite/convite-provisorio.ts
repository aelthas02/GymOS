import { Inject, Injectable } from '@nestjs/common';
import { ConviteDoAdministrador } from '../../application/portas';
import type { Tenant } from '../../domain/tenant';
import { CONFIGURACAO_DA_PLATAFORMA, type ConfiguracaoDaPlataforma } from '../configuracao';

/**
 * Até o T12 existir, não há convite gravado nem e-mail: devolvemos o link do painel da academia
 * com o e-mail do administrador, e o comando criar-academia o imprime. O T12 troca este adapter.
 */
@Injectable()
export class ConviteProvisorio extends ConviteDoAdministrador {
  constructor(
    @Inject(CONFIGURACAO_DA_PLATAFORMA) private readonly config: ConfiguracaoDaPlataforma,
  ) {
    super();
  }

  async convidar({ tenant, email }: { tenant: Tenant; email: string }): Promise<{ link: string }> {
    const painel = this.config.urlDoPainel.replaceAll('{tenant}', tenant.slug);
    return { link: `${painel}/convite?email=${encodeURIComponent(email)}` };
  }
}
