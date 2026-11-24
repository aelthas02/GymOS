import { Logger, type OnModuleInit } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { ObjetosDeArmazenamento } from '../application/portas';
import type { ConfiguracaoDasIntegracoes } from './configuracao';

export interface PedidoDeAssinatura {
  metodo: 'GET' | 'PUT' | 'DELETE';
  host: string;
  /** Caminho já com o bucket quando a URL é path-style (`/bucket/chave`). */
  caminho: string;
  regiao: string;
  chaveDeAcesso: string;
  segredo: string;
  agora: Date;
  expiraEmSegundos: number;
}

const sha256 = (texto: string): string => createHash('sha256').update(texto).digest('hex');
const hmac = (chave: Buffer | string, texto: string): Buffer =>
  createHmac('sha256', chave).update(texto).digest();
const codificar = (texto: string): string =>
  encodeURIComponent(texto).replace(
    /[!'()*]/g,
    (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** Consulta de uma URL pré-assinada AWS Signature V4 (assina só o cabeçalho `host`). */
export function consultaAssinadaSigV4(pedido: PedidoDeAssinatura): string {
  const instante = pedido.agora.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const dia = instante.slice(0, 8);
  const escopo = `${dia}/${pedido.regiao}/s3/aws4_request`;
  const parametros: Array<[string, string]> = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${pedido.chaveDeAcesso}/${escopo}`],
    ['X-Amz-Date', instante],
    ['X-Amz-Expires', String(pedido.expiraEmSegundos)],
    ['X-Amz-SignedHeaders', 'host'],
  ];
  const consulta = parametros
    .map(([nome, valor]) => [codificar(nome), codificar(valor)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([nome, valor]) => `${nome}=${valor}`)
    .join('&');
  const caminho = pedido.caminho.split('/').map(codificar).join('/');
  const requisicao = [
    pedido.metodo,
    caminho,
    consulta,
    `host:${pedido.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const paraAssinar = ['AWS4-HMAC-SHA256', instante, escopo, sha256(requisicao)].join('\n');
  const chave = hmac(
    hmac(hmac(hmac(`AWS4${pedido.segredo}`, dia), pedido.regiao), 's3'),
    'aws4_request',
  );
  const assinatura = createHmac('sha256', chave).update(paraAssinar).digest('hex');
  return `${consulta}&X-Amz-Signature=${assinatura}`;
}

/**
 * Armazenamento S3 compatível (MinIO no compose, S3 gerenciado em staging e produção), URLs
 * path-style. Gravação e remoção usam a mesma URL pré-assinada que a leitura, sem SDK.
 */
export class ObjetosDeArmazenamentoS3 extends ObjetosDeArmazenamento implements OnModuleInit {
  private readonly logger = new Logger(ObjetosDeArmazenamentoS3.name);

  constructor(
    private readonly config: ConfiguracaoDasIntegracoes['s3'],
    private readonly agora: () => Date,
  ) {
    super();
  }

  /** O ticket cria o bucket `gymos` do compose; se já existe (409) ou não dá, só registra. */
  async onModuleInit(): Promise<void> {
    try {
      const resposta = await fetch(this.url('PUT', ''), { method: 'PUT' });
      if (!resposta.ok && resposta.status !== 409) {
        this.logger.warn({ status: resposta.status }, 'Não foi possível criar o bucket');
      }
    } catch (err) {
      this.logger.warn({ err }, 'Armazenamento S3 indisponível ao subir');
    }
  }

  async gravar(chave: string, conteudo: Buffer, tipo: string): Promise<void> {
    const resposta = await fetch(this.url('PUT', chave), {
      method: 'PUT',
      headers: { 'content-type': tipo },
      body: new Uint8Array(conteudo),
    });
    if (!resposta.ok) {
      throw new Error(`O armazenamento recusou o objeto (${resposta.status}).`);
    }
  }

  async remover(chave: string): Promise<void> {
    const resposta = await fetch(this.url('DELETE', chave), { method: 'DELETE' });
    if (!resposta.ok && resposta.status !== 404) {
      throw new Error(`O armazenamento recusou a remoção (${resposta.status}).`);
    }
  }

  async urlAssinada(chave: string, expiraEm: Date, agora: Date): Promise<string> {
    const segundos = Math.max(1, Math.round((expiraEm.getTime() - agora.getTime()) / 1000));
    return this.url('GET', chave, segundos, agora);
  }

  private url(
    metodo: PedidoDeAssinatura['metodo'],
    chave: string,
    expiraEmSegundos = 60,
    agora = this.agora(),
  ): string {
    const base = new URL(this.config.endpoint);
    const caminho = `/${this.config.bucket}${chave ? `/${chave}` : ''}`;
    const consulta = consultaAssinadaSigV4({
      metodo,
      host: base.host,
      caminho,
      regiao: this.config.regiao,
      chaveDeAcesso: this.config.chaveDeAcesso,
      segredo: this.config.segredo,
      agora,
      expiraEmSegundos,
    });
    return `${this.config.endpoint}${caminho.split('/').map(codificar).join('/')}?${consulta}`;
  }
}
