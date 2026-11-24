import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  PROVEDORES_DE_WEBHOOK,
  ProvedorDeWebhook,
  RepositorioDeTenants,
} from '../../application/portas';
import { ExecutorDeTenant } from '../../infra/contexto/executor-de-tenant';
import { Publica } from './acesso-publico';

const NAO_ENCONTRADO = 'Webhook sem destino.';

/**
 * Webhooks de provedores externos. Fora da resolução por Host: o tenant vem do caminho
 * (`/webhooks/:provedor/:tenantSlug`) ou do dono do id externo (`/webhooks/:provedor`), e o handler
 * sempre roda em runAsTenant. Recurso não encontrado no tenant responde 404 sem alterar nada.
 */
@ApiExcludeController()
@Publica()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    @Inject(PROVEDORES_DE_WEBHOOK) private readonly provedores: ProvedorDeWebhook[],
    private readonly tenants: RepositorioDeTenants,
    private readonly executor: ExecutorDeTenant,
  ) {}

  @Post(':provedor/:tenantSlug')
  @HttpCode(200)
  async doTenant(
    @Param('provedor') nome: string,
    @Param('tenantSlug') slug: string,
    @Body() corpo: unknown,
    @Headers() cabecalhos: Record<string, string | undefined>,
  ): Promise<{ recebido: true }> {
    const provedor = this.provedor(nome, corpo, cabecalhos);
    const tenant = await this.tenants.porSlug(slug);
    if (!tenant) {
      throw new NotFoundException(NAO_ENCONTRADO);
    }
    return this.processar(provedor, tenant.id, corpo);
  }

  @Post(':provedor')
  @HttpCode(200)
  async porReferenciaExterna(
    @Param('provedor') nome: string,
    @Body() corpo: unknown,
    @Headers() cabecalhos: Record<string, string | undefined>,
  ): Promise<{ recebido: true }> {
    const provedor = this.provedor(nome, corpo, cabecalhos);
    const idExterno = provedor.idExterno(corpo);
    const tenantId = idExterno
      ? await this.tenants.tenantDaReferenciaExterna(provedor.nome, idExterno)
      : null;
    if (!tenantId) {
      throw new NotFoundException(NAO_ENCONTRADO);
    }
    return this.processar(provedor, tenantId, corpo);
  }

  private provedor(
    nome: string,
    corpo: unknown,
    cabecalhos: Record<string, string | undefined>,
  ): ProvedorDeWebhook {
    const provedor = this.provedores.find((candidato) => candidato.nome === nome);
    if (!provedor) {
      throw new NotFoundException(NAO_ENCONTRADO);
    }
    if (provedor.assinaturaValida && !provedor.assinaturaValida(corpo, cabecalhos)) {
      throw new UnauthorizedException('Assinatura inválida.');
    }
    return provedor;
  }

  private async processar(
    provedor: ProvedorDeWebhook,
    tenantId: string,
    corpo: unknown,
  ): Promise<{ recebido: true }> {
    const resultado = await this.executor.runAsTenant(tenantId, () => provedor.processar(corpo));
    if (resultado === 'recurso-nao-encontrado') {
      throw new NotFoundException(NAO_ENCONTRADO);
    }
    return { recebido: true };
  }
}
