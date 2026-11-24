import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Relogio } from '../../platform/domain/relogio';
import {
  ArquivoRecusadoError,
  chaveDoObjeto,
  conferirChaveDoTenant,
  ehPastaValida,
  validarArquivo,
} from '../domain/armazenamento';
import { ObjetosDeArmazenamento, TenantDoContexto } from './portas';

export const VALIDADE_PADRAO_DA_URL_EM_SEGUNDOS = 300;
export const VALIDADE_MAXIMA_DA_URL_EM_SEGUNDOS = 3600;

export interface ArquivoEnviado {
  chave: string;
  tipo: string;
  tamanhoEmBytes: number;
}

export interface UrlAssinada {
  url: string;
  expiraEm: Date;
}

/**
 * Arquivos da academia no S3 compatível (T13d). Toda chave é `tenant/<id>/<pasta>/<uuid>.<ext>` e só
 * se abre a chave do próprio tenant; o upload confere tipo, extensão, conteúdo e tamanho; a URL de
 * leitura é assinada, de curta duração, e vale só para o objeto pedido.
 */
@Injectable()
export class Armazenamento {
  constructor(
    private readonly objetos: ObjetosDeArmazenamento,
    private readonly tenant: TenantDoContexto,
    private readonly relogio: Relogio,
  ) {}

  async enviar(arquivo: {
    pasta: string;
    nome: string;
    tipo: string;
    conteudo: Buffer;
  }): Promise<ArquivoEnviado> {
    if (!ehPastaValida(arquivo.pasta)) {
      throw new ArquivoRecusadoError('tipo_nao_permitido', 'Pasta inválida.');
    }
    const extensao = validarArquivo(arquivo);
    const chave = chaveDoObjeto(this.tenant.id(), arquivo.pasta, randomUUID(), extensao);
    await this.objetos.gravar(chave, arquivo.conteudo, arquivo.tipo.toLowerCase());
    return { chave, tipo: arquivo.tipo.toLowerCase(), tamanhoEmBytes: arquivo.conteudo.length };
  }

  async urlAssinada(
    chave: string,
    validadeEmSegundos = VALIDADE_PADRAO_DA_URL_EM_SEGUNDOS,
  ): Promise<UrlAssinada> {
    conferirChaveDoTenant(this.tenant.id(), chave);
    const segundos = Math.min(Math.max(1, validadeEmSegundos), VALIDADE_MAXIMA_DA_URL_EM_SEGUNDOS);
    const agora = this.relogio.agora();
    const expiraEm = new Date(agora.getTime() + segundos * 1000);
    return { url: await this.objetos.urlAssinada(chave, expiraEm, agora), expiraEm };
  }

  async remover(chave: string): Promise<void> {
    conferirChaveDoTenant(this.tenant.id(), chave);
    await this.objetos.remover(chave);
  }
}
