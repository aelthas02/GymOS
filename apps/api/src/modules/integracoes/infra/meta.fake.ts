import { Inject, Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ConexaoInvalidaError, NOMES_DOS_CANAIS, type CanalMeta } from '../domain/meta';
import {
  AssinadorDoFluxo,
  type ContaNaMeta,
  ProvedorMeta,
  TenantDoContexto,
} from '../application/portas';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import { CONFIGURACAO_DAS_INTEGRACOES, type ConfiguracaoDasIntegracoes } from './configuracao';

const SESSENTA_DIAS_MS = 60 * 24 * 60 * 60 * 1000;

/** Código do fluxo que o fake trata como "empresa ainda em verificação na Meta" (só WhatsApp). */
export const CODIGO_DE_VERIFICACAO_PENDENTE = 'verificacao-pendente';

const curto = (texto: string): string =>
  createHash('sha256').update(texto).digest('hex').slice(0, 16);

/**
 * Meta fake (T13d): determinístico e sem rede. O "fluxo oficial" é um endereço de mentira; o código
 * de retorno é qualquer texto não vazio (`verificacao-pendente` simula a empresa ainda em análise,
 * e a verificação passa quando a academia usa "Concluir conexão").
 */
@Injectable()
export class ProvedorMetaFake extends ProvedorMeta {
  urlDoFluxo(canal: CanalMeta, estado: string, redirecionarPara: string): string {
    const consulta = new URLSearchParams({ state: estado, redirect_uri: redirecionarPara });
    return `https://meta.fake.gymos.local/fluxo/${canal}?${consulta.toString()}`;
  }

  async trocarCodigo(canal: CanalMeta, codigo: string, agora: Date): Promise<ContaNaMeta> {
    if (codigo.trim() === '') {
      throw new ConexaoInvalidaError('A Meta não devolveu um código de autorização.');
    }
    const id = curto(`${canal}:${codigo}`);
    return {
      contaId: `fake_${canal}_${id}`,
      contaNome: `${NOMES_DOS_CANAIS[canal]} (conta de teste)`,
      token: `fake_token_${id}`,
      expiraEm: new Date(agora.getTime() + SESSENTA_DIAS_MS),
      verificada: !(canal === 'whatsapp' && codigo === CODIGO_DE_VERIFICACAO_PENDENTE),
    };
  }

  async verificada(): Promise<boolean> {
    return true;
  }

  async renovar(token: string, agora: Date): Promise<{ token: string; expiraEm: Date }> {
    return {
      token: `fake_token_${curto(token + agora.toISOString())}`,
      expiraEm: new Date(agora.getTime() + SESSENTA_DIAS_MS),
    };
  }

  async revogar(): Promise<void> {
    // O fake não guarda estado do lado da Meta.
  }
}

@Injectable()
export class TenantDoContextoAtual extends TenantDoContexto {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  id(): string {
    return this.contexto.tenant().id;
  }
}

/** `state` = `<tenant>.<canal>.<expiraEm em ms>.<HMAC>`: só vale para o tenant que o pediu. */
@Injectable()
export class AssinadorDoFluxoHmac extends AssinadorDoFluxo {
  constructor(
    private readonly contexto: ContextoDoTenant,
    @Inject(CONFIGURACAO_DAS_INTEGRACOES) private readonly config: ConfiguracaoDasIntegracoes,
  ) {
    super();
  }

  assinar(canal: CanalMeta, expiraEm: Date): string {
    const corpo = `${this.contexto.tenant().id}.${canal}.${expiraEm.getTime()}`;
    return `${corpo}.${this.mac(corpo)}`;
  }

  valido(estado: string, canal: CanalMeta, agora: Date): boolean {
    const partes = estado.split('.');
    if (partes.length !== 4) {
      return false;
    }
    const [tenantId, canalDoEstado, expira, mac] = partes as [string, string, string, string];
    const esperado = Buffer.from(this.mac(`${tenantId}.${canalDoEstado}.${expira}`));
    const recebido = Buffer.from(mac);
    return (
      recebido.length === esperado.length &&
      timingSafeEqual(recebido, esperado) &&
      tenantId === this.contexto.tenant().id &&
      canalDoEstado === canal &&
      Number(expira) > agora.getTime()
    );
  }

  private mac(corpo: string): string {
    return createHmac('sha256', this.config.segredoInterno)
      .update(`meta-state:${corpo}`)
      .digest('hex');
  }
}
