import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { centavos, formatarBrl } from '@gymos/shared-money';
import { RepositorioDeTenants } from '../../../platform/application/portas';
import { Relogio } from '../../../platform/domain/relogio';
import {
  CONFIGURACAO_DA_PLATAFORMA,
  type ConfiguracaoDaPlataforma,
  permiteRecursosDeDesenvolvimento,
} from '../../../platform/infra/configuracao';
import { ExecutorDeTenant } from '../../../platform/infra/contexto/executor-de-tenant';
import { Publica } from '../../../platform/interface/http/acesso-publico';
import { type Cobranca, RepositorioDeCobrancas } from '../../application/portas';
import { WebhookDePagamentos } from '../../infra/adapters';
import { GatewayDePagamentoFake } from '../../infra/gateway.fake';

const NAO_ENCONTRADA = 'Cobrança não encontrada.';

const escapar = (texto: string): string =>
  texto.replace(/[&<>"']/g, (caractere) => `&#${caractere.charCodeAt(0)};`);

function pagina(titulo: string, corpo: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title><style>body{font-family:system-ui,sans-serif;max-width:420px;margin:48px auto;padding:0 16px}button{font:inherit;padding:12px 20px;cursor:pointer}code{word-break:break-all}</style></head><body><p><small>Provedor de pagamento simulado (desenvolvimento)</small></p>${corpo}</body></html>`;
}

/**
 * Página de pagamento simulada do provedor fake (ADR-009), só fora de produção: "Pagar" gera o
 * webhook de confirmação assinado e o processa como o provedor faria.
 */
@ApiExcludeController()
@Publica()
@Controller('pagamento-simulado')
export class PagamentoSimuladoController {
  constructor(
    @Inject(CONFIGURACAO_DA_PLATAFORMA) private readonly plataforma: ConfiguracaoDaPlataforma,
    private readonly tenants: RepositorioDeTenants,
    private readonly executor: ExecutorDeTenant,
    private readonly cobrancas: RepositorioDeCobrancas,
    private readonly gateway: GatewayDePagamentoFake,
    private readonly webhook: WebhookDePagamentos,
    private readonly relogio: Relogio,
  ) {}

  @Get(':idExterno')
  @Header('content-type', 'text/html; charset=utf-8')
  async exibir(@Param('idExterno') idExterno: string): Promise<string> {
    const { cobranca } = await this.localizar(idExterno);
    const valor = formatarBrl(centavos(cobranca.valorCentavos));
    if (cobranca.situacao !== 'pendente') {
      return pagina('Cobrança', `<h1>Cobrança ${escapar(cobranca.situacao)}</h1><p>${valor}</p>`);
    }
    const extra = [
      cobranca.dados.pixCopiaECola
        ? `<p>PIX copia e cola:<br><code>${escapar(cobranca.dados.pixCopiaECola)}</code></p>`
        : '',
      cobranca.dados.linhaDigitavel
        ? `<p>Linha digitável:<br><code>${escapar(cobranca.dados.linhaDigitavel)}</code></p>`
        : '',
    ].join('');
    return pagina(
      'Pagar',
      `<h1>Pagar ${valor}</h1><p>Forma: ${escapar(cobranca.forma)} · vence em ${escapar(cobranca.vencimento)}</p>${extra}<form method="post" action="${escapar(idExterno)}/pagar"><button type="submit">Pagar</button></form>`,
    );
  }

  @Post(':idExterno/pagar')
  @HttpCode(200)
  @Header('content-type', 'text/html; charset=utf-8')
  async pagar(@Param('idExterno') idExterno: string): Promise<string> {
    const { tenantId, cobranca } = await this.localizar(idExterno);
    const corpo = this.gateway.eventoDePagamento(cobranca, this.relogio.agora());
    if (!this.webhook.assinaturaValida(corpo, { 'x-assinatura': this.gateway.assinar(corpo) })) {
      throw new NotFoundException(NAO_ENCONTRADA);
    }
    await this.executor.runAsTenant(tenantId, () => this.webhook.processar(corpo));
    return pagina(
      'Pagamento confirmado',
      `<h1>Pagamento confirmado</h1><p>${formatarBrl(centavos(cobranca.valorCentavos))}</p>`,
    );
  }

  private async localizar(idExterno: string): Promise<{ tenantId: string; cobranca: Cobranca }> {
    if (!permiteRecursosDeDesenvolvimento(this.plataforma)) {
      throw new NotFoundException(NAO_ENCONTRADA);
    }
    const tenantId = await this.tenants.tenantDaReferenciaExterna(this.gateway.provedor, idExterno);
    const cobranca =
      tenantId &&
      (await this.executor.runAsTenant(tenantId, () =>
        this.cobrancas.porIdExterno(this.gateway.provedor, idExterno),
      ));
    if (!tenantId || !cobranca) {
      throw new NotFoundException(NAO_ENCONTRADA);
    }
    return { tenantId, cobranca };
  }
}
