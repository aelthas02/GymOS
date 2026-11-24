import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ProvedorDeChaves } from '../../application/protecao-de-dados';
import { transacaoDoTenant } from '../contexto/transacao-do-tenant';
import type { ClienteTransacional } from '../prisma/criar-cliente';
import { PrismaService } from '../prisma/prisma.service';

export interface ChavesDoTenantNaVersao {
  versao: number;
  /** Chave AES-256-GCM dos campos. */
  dados: Buffer;
  /** Chave HMAC-SHA256 do índice cego; a mesma em todas as versões. */
  indice: Buffer;
}

export class VersaoDeChaveDesconhecidaError extends Error {
  constructor(versao: number) {
    super(`O tenant não tem a chave de dados na versão ${versao}.`);
    this.name = 'VersaoDeChaveDesconhecidaError';
  }
}

/**
 * Chaves de dados e de índice de cada tenant, envelopadas pela chave mestra em `chave_do_tenant`.
 * Criação e rotação rodam numa transação própria, confirmada na hora: a chave nunca some num
 * rollback da requisição que a criou. As chaves abertas ficam em memória no processo.
 */
@Injectable()
export class ChavesDoTenant {
  private readonly porVersao = new Map<string, Promise<ChavesDoTenantNaVersao>>();
  private readonly versaoAtiva = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly provedor: ProvedorDeChaves,
  ) {}

  /** A versão mais alta do tenant, criada na primeira vez. */
  async ativa(tenantId: string): Promise<ChavesDoTenantNaVersao> {
    const versao = this.versaoAtiva.get(tenantId);
    if (versao !== undefined) {
      return this.daVersao(tenantId, versao);
    }
    const chaves = await this.naTransacao(tenantId, async (cliente) => {
      let linha = await cliente.chaveDoTenant.findFirst({ orderBy: { versao: 'desc' } });
      if (!linha) {
        // Dois processos criando ao mesmo tempo: o segundo espera o primeiro e fica com a dele.
        await cliente.chaveDoTenant.createMany({
          data: [await this.novaLinha(tenantId, 1, randomBytes(32))],
          skipDuplicates: true,
        });
        linha = await this.maisRecente(cliente);
      }
      return this.abrir(linha);
    });
    return this.lembrar(tenantId, chaves);
  }

  async daVersao(tenantId: string, versao: number): Promise<ChavesDoTenantNaVersao> {
    const chave = `${tenantId}:${versao}`;
    let chaves = this.porVersao.get(chave);
    if (!chaves) {
      chaves = this.naTransacao(tenantId, async (cliente) => {
        const linha = await cliente.chaveDoTenant.findFirst({ where: { versao } });
        if (!linha) {
          throw new VersaoDeChaveDesconhecidaError(versao);
        }
        return this.abrir(linha);
      });
      this.porVersao.set(chave, chaves);
      chaves.catch(() => this.porVersao.delete(chave));
    }
    return chaves;
  }

  /**
   * Nova chave de dados, que passa a cifrar; as anteriores continuam decifrando. A chave de índice
   * se mantém, então os hashes gravados continuam valendo. Devolve a nova versão.
   */
  async rotacionar(tenantId: string): Promise<number> {
    const atual = await this.ativa(tenantId);
    const nova = await this.naTransacao(tenantId, async (cliente) => {
      const maisRecente = await this.maisRecente(cliente);
      const linha = await this.novaLinha(tenantId, maisRecente.versao + 1, atual.indice);
      await cliente.chaveDoTenant.create({ data: linha });
      return this.abrir(linha);
    });
    return (await this.lembrar(tenantId, nova)).versao;
  }

  private naTransacao<T>(
    tenantId: string,
    fn: (cliente: ClienteTransacional) => Promise<T>,
  ): Promise<T> {
    return transacaoDoTenant(this.prisma, tenantId, fn);
  }

  private async maisRecente(cliente: ClienteTransacional) {
    return cliente.chaveDoTenant.findFirstOrThrow({ orderBy: { versao: 'desc' } });
  }

  private async novaLinha(tenantId: string, versao: number, indice: Buffer) {
    const dados = await this.provedor.envelopar(randomBytes(32));
    const chaveDeIndice = await this.provedor.envelopar(indice);
    return {
      tenantId,
      versao,
      chaveDeDados: dados.envelope,
      chaveDeIndice: chaveDeIndice.envelope,
      idDaChaveMestra: dados.idDaChaveMestra,
    };
  }

  private async abrir(linha: {
    versao: number;
    chaveDeDados: string;
    chaveDeIndice: string;
    idDaChaveMestra: string;
  }): Promise<ChavesDoTenantNaVersao> {
    return {
      versao: linha.versao,
      dados: await this.provedor.desenvelopar(linha.chaveDeDados, linha.idDaChaveMestra),
      indice: await this.provedor.desenvelopar(linha.chaveDeIndice, linha.idDaChaveMestra),
    };
  }

  private lembrar(tenantId: string, chaves: ChavesDoTenantNaVersao): ChavesDoTenantNaVersao {
    this.porVersao.set(`${tenantId}:${chaves.versao}`, Promise.resolve(chaves));
    this.versaoAtiva.set(tenantId, chaves.versao);
    return chaves;
  }
}
