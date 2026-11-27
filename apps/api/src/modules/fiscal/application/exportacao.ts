import { Injectable } from '@nestjs/common';
import { Armazenamento } from '../../integracoes/application/armazenamento';
import { type Competencia, NOME_DO_TIPO, rotuloDoNumero } from '../domain/nota-fiscal';
import { type NotaFiscal, RepositorioDeNotas } from './portas';
import { montarZip, type ArquivoDoZip } from './zip';

const PAGINA = 200;
const BOM_UTF8 = String.fromCharCode(0xfeff);
const COLUNAS = [
  'numero',
  'tipo',
  'situacao',
  'emitida_em',
  'competencia',
  'tomador',
  'cpf',
  'descricao',
  'codigo_do_servico',
  'valor',
  'aliquota_iss_pontos_base',
  'iss',
  'retencoes',
  'total',
] as const;

const reais = (valorCentavos: number): string =>
  `${Math.trunc(valorCentavos / 100)},${String(Math.abs(valorCentavos % 100)).padStart(2, '0')}`;

function celula(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor;
}

function linhaDoCsv(nota: NotaFiscal): string {
  return [
    rotuloDoNumero(nota.tipo, nota.numero) ?? '',
    NOME_DO_TIPO[nota.tipo],
    nota.situacao,
    nota.emitidaEm?.toISOString() ?? '',
    nota.competencia,
    nota.tomadorNome,
    nota.tomadorCpf ?? '',
    nota.descricao,
    nota.codigoDoServico,
    reais(nota.valorCentavos),
    String(nota.aliquotaIssPontosBase),
    reais(nota.issCentavos),
    reais(nota.retencoesCentavos),
    reais(nota.valorCentavos - nota.retencoesCentavos),
  ]
    .map(celula)
    .join(';');
}

/**
 * "Exportar para o contador": ZIP com o XML de cada nota emitida ou cancelada da competência e um CSV
 * do período. Só lê o tenant do contexto (RLS e chaves do Armazenamento por tenant).
 */
@Injectable()
export class ExportacaoParaOContador {
  constructor(
    private readonly notas: RepositorioDeNotas,
    private readonly armazenamento: Armazenamento,
  ) {}

  async exportar(competencia: Competencia): Promise<{ nome: string; conteudo: Buffer }> {
    const doPeriodo: NotaFiscal[] = [];
    let cursor: string | undefined;
    do {
      const pagina = await this.notas.listar(
        { competencia, situacoes: ['emitida', 'cancelada'] },
        { limite: PAGINA, ...(cursor ? { cursor } : {}) },
      );
      doPeriodo.push(...pagina.itens);
      cursor = pagina.proximoCursor ?? undefined;
    } while (cursor);

    const arquivos: ArquivoDoZip[] = [];
    for (const nota of doPeriodo) {
      const xml = nota.xmlChave ? await this.armazenamento.ler(nota.xmlChave) : null;
      if (xml) {
        arquivos.push({ nome: `xml/${nota.tipo}-${nota.numero ?? nota.id}.xml`, conteudo: xml });
      }
    }
    const csv = [COLUNAS.join(';'), ...doPeriodo.map(linhaDoCsv)].join('\r\n');
    // BOM: o Excel em português abre o CSV em UTF-8 com acentos.
    arquivos.push({
      nome: `notas-${competencia}.csv`,
      conteudo: Buffer.from(`${BOM_UTF8}${csv}\r\n`),
    });
    return { nome: `notas-fiscais-${competencia}.zip`, conteudo: montarZip(arquivos) };
  }
}
