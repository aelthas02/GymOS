import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { type DataCivil, FUSO_PADRAO, Relogio } from '../../platform/domain/relogio';
import {
  EmissorFiscal,
  EmissorRecusouError,
  type EventoDoEmissor,
  FalhaDeComunicacaoComOEmissorError,
  type PedidoDeEmissao,
  type ResultadoNoEmissor,
} from '../application/portas';
import { competenciaExibida, NOME_DO_TIPO } from '../domain/nota-fiscal';
import { CONFIGURACAO_DO_FISCAL, type ConfiguracaoDoFiscal } from './configuracao';

export const CABECALHO_DA_ASSINATURA_FISCAL = 'x-assinatura';

/**
 * CPFs com dígitos válidos que a "Receita" do fake não encontra: a nota volta rejeitada por regra do
 * emissor, não por validação local. O seed usa o primeiro.
 */
export const CPFS_NAO_ENCONTRADOS_NA_RECEITA: readonly string[] = ['52998224725'];
export const MOTIVO_CPF_NAO_ENCONTRADO = 'CPF não encontrado na Receita Federal';

/** Próximo comportamento programado (testes e QA): o padrão é emitir na hora. */
export type ComportamentoDoFake =
  /** Aceita e emite, mas a resposta não chega (FalhaDeComunicacao). */
  | 'resposta-perdida'
  /** Aceita e devolve "processando"; a nota sai na consulta seguinte. */
  | 'demora'
  /** Não chega ao emissor (FalhaDeComunicacao sem aceitar). */
  | 'fora-do-ar';

interface NotaNoFake {
  pedido: PedidoDeEmissao;
  situacao: 'emitida' | 'rejeitada' | 'processando' | 'cancelada';
  numero: string | null;
  motivo: string | null;
  emitidaEm: Date | null;
}

const escapar = (texto: string): string =>
  texto.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Emissor fiscal fake (ADR-008): determinístico, sem rede, idempotente pela chave. Numeração própria
 * por CNPJ e tipo. Simula sucesso, rejeição por regra do emissor (CPF não encontrado), demora e
 * resposta perdida. Webhook: `{ chave, situacao, numero?, motivo? }` com HMAC em `x-assinatura`.
 */
@Injectable()
export class EmissorFiscalFake extends EmissorFiscal {
  readonly provedor = 'fiscal-fake';

  private readonly notas = new Map<string, NotaNoFake>();
  private readonly numeracao = new Map<string, number>();
  private readonly programados: ComportamentoDoFake[] = [];
  /** Quantas vezes `emitir` chegou ao emissor (aceita ou não), por chave. */
  readonly emissoes = new Map<string, number>();

  constructor(
    @Inject(CONFIGURACAO_DO_FISCAL) private readonly config: ConfiguracaoDoFiscal,
    private readonly relogio: Relogio,
  ) {
    super();
  }

  /** Programa as próximas emissões, em ordem. */
  programar(...comportamentos: ComportamentoDoFake[]): void {
    this.programados.push(...comportamentos);
  }

  limpar(): void {
    this.notas.clear();
    this.numeracao.clear();
    this.programados.length = 0;
    this.emissoes.clear();
  }

  async emitir(pedido: PedidoDeEmissao): Promise<ResultadoNoEmissor> {
    const comportamento = this.programados.shift();
    if (comportamento === 'fora-do-ar') {
      throw new FalhaDeComunicacaoComOEmissorError();
    }
    this.emissoes.set(pedido.chave, (this.emissoes.get(pedido.chave) ?? 0) + 1);
    const existente = this.notas.get(pedido.chave);
    // Idempotência pela chave: o que já foi aceito não gera outro número.
    if (existente && existente.situacao !== 'rejeitada') {
      return this.resultado(existente);
    }
    const nota = this.registrar(pedido, comportamento === 'demora');
    if (comportamento === 'resposta-perdida') {
      throw new FalhaDeComunicacaoComOEmissorError(
        'O emissor aceitou a nota, mas a resposta se perdeu.',
      );
    }
    return this.resultado(nota);
  }

  async consultar(chave: string): Promise<ResultadoNoEmissor> {
    const nota = this.notas.get(chave);
    if (!nota) {
      return { situacao: 'desconhecida' };
    }
    if (nota.situacao === 'processando') {
      this.concluir(nota);
    }
    return this.resultado(nota);
  }

  async cancelar(chave: string): Promise<void> {
    const nota = this.notas.get(chave);
    if (!nota || (nota.situacao !== 'emitida' && nota.situacao !== 'cancelada')) {
      throw new EmissorRecusouError('O emissor não tem nota emitida com esta chave.');
    }
    nota.situacao = 'cancelada';
  }

  async enviarCertificado(arquivo: Buffer): Promise<{ validade: DataCivil }> {
    if (arquivo.length === 0) {
      throw new EmissorRecusouError('Certificado vazio.');
    }
    // Validade simulada: um ano a partir de hoje.
    const hoje = this.relogio.hojeEm(FUSO_PADRAO);
    return { validade: `${Number(hoje.slice(0, 4)) + 1}${hoje.slice(4)}` as DataCivil };
  }

  assinar(corpo: unknown): string {
    return createHmac('sha256', this.config.segredoDoWebhook)
      .update(JSON.stringify(corpo))
      .digest('hex');
  }

  assinaturaValida(corpo: unknown, cabecalhos: Record<string, string | undefined>): boolean {
    const recebida = Buffer.from(cabecalhos[CABECALHO_DA_ASSINATURA_FISCAL] ?? '', 'utf-8');
    const esperada = Buffer.from(this.assinar(corpo), 'utf-8');
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  }

  interpretar(corpo: unknown): EventoDoEmissor | null {
    if (typeof corpo !== 'object' || corpo === null) {
      return null;
    }
    const { chave } = corpo as Record<string, unknown>;
    if (typeof chave !== 'string' || chave === '') {
      return null;
    }
    const nota = this.notas.get(chave);
    return nota ? { chave, resultado: this.resultado(nota) } : null;
  }

  /** Corpo do webhook que o emissor mandaria ao concluir a nota (para testes e QA). */
  concluirComWebhook(chave: string): Record<string, unknown> | null {
    const nota = this.notas.get(chave);
    if (!nota) {
      return null;
    }
    if (nota.situacao === 'processando') {
      this.concluir(nota);
    }
    return { chave, situacao: nota.situacao, numero: nota.numero, motivo: nota.motivo };
  }

  private registrar(pedido: PedidoDeEmissao, demorar: boolean): NotaNoFake {
    const nota: NotaNoFake = {
      pedido,
      situacao: 'processando',
      numero: null,
      motivo: null,
      emitidaEm: null,
    };
    this.notas.set(pedido.chave, nota);
    if (!demorar) {
      this.concluir(nota);
    }
    return nota;
  }

  private concluir(nota: NotaNoFake): void {
    const cpf = nota.pedido.tomador.cpf;
    if (cpf && CPFS_NAO_ENCONTRADOS_NA_RECEITA.includes(cpf)) {
      nota.situacao = 'rejeitada';
      nota.motivo = MOTIVO_CPF_NAO_ENCONTRADO;
      return;
    }
    const serie = `${nota.pedido.prestador.cnpj}:${nota.pedido.tipo}`;
    const numero = (this.numeracao.get(serie) ?? 0) + 1;
    this.numeracao.set(serie, numero);
    nota.situacao = 'emitida';
    nota.numero = String(numero);
    nota.motivo = null;
    nota.emitidaEm = this.relogio.agora();
  }

  private resultado(nota: NotaNoFake): ResultadoNoEmissor {
    switch (nota.situacao) {
      case 'emitida':
        return {
          situacao: 'emitida',
          numero: nota.numero as string,
          emitidaEm: nota.emitidaEm as Date,
          pdf: this.pdf(nota),
          xml: this.xml(nota),
        };
      case 'rejeitada':
        return { situacao: 'rejeitada', motivo: nota.motivo as string };
      case 'cancelada':
        return { situacao: 'cancelada' };
      default:
        return { situacao: 'processando' };
    }
  }

  private xml(nota: NotaNoFake): string {
    const { pedido } = nota;
    const raiz = pedido.tipo === 'nfse' ? 'NFSe' : 'NFCe';
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<${raiz} chave="${escapar(pedido.chave)}" numero="${escapar(nota.numero ?? '')}">`,
      `  <Prestador cnpj="${escapar(pedido.prestador.cnpj)}">${escapar(pedido.prestador.razaoSocial)}</Prestador>`,
      `  <Tomador cpf="${escapar(pedido.tomador.cpf ?? '')}">${escapar(pedido.tomador.nome)}</Tomador>`,
      `  <Servico codigo="${escapar(pedido.codigoDoServico)}" competencia="${pedido.competencia}">${escapar(pedido.descricao)}</Servico>`,
      `  <Valores servico="${pedido.valorCentavos}" aliquotaIss="${pedido.aliquotaIssPontosBase}" iss="${pedido.issCentavos}" retencoes="${pedido.retencoesCentavos}"/>`,
      `  <Emissao>${nota.emitidaEm?.toISOString() ?? ''}</Emissao>`,
      `</${raiz}>`,
      '',
    ].join('\n');
  }

  /** PDF mínimo (uma página com o resumo), só para o fluxo de download e envio. */
  private pdf(nota: NotaNoFake): Buffer {
    const { pedido } = nota;
    const texto =
      `${NOME_DO_TIPO[pedido.tipo]} ${nota.numero ?? ''} - ${pedido.tomador.nome} - competencia ${competenciaExibida(pedido.competencia)}`
        .normalize('NFD')
        .replace(/[^\x20-\x7e]/g, '')
        .replace(/[()\\]/g, '');
    const conteudo = `BT /F1 12 Tf 72 720 Td (${texto}) Tj ET`;
    const objetos = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let corpo = '%PDF-1.4\n';
    const posicoes: number[] = [];
    objetos.forEach((objeto, indice) => {
      posicoes.push(corpo.length);
      corpo += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
    });
    const xref = corpo.length;
    corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    corpo += posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
    corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(corpo, 'latin1');
  }
}
