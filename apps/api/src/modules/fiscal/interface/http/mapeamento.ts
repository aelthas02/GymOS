import { formatarCnpj, formatarCpf, formatarTelefone } from '@gymos/shared-pipes/formatadores';
import type { DadosFiscaisDaAcademia } from '../../application/dados-fiscais';
import type { PreviaDaNota, SugestaoDeNota } from '../../application/notas-fiscais';
import type { NotaFiscal, ResumoDasNotas } from '../../application/portas';
import {
  type Competencia,
  competenciaExibida,
  NOME_DO_TIPO,
  rotuloDoNumero,
} from '../../domain/nota-fiscal';
import type {
  DadosFiscaisDto,
  NotaFiscalDetalheDto,
  NotaFiscalDto,
  PreviaDaNotaDto,
  ResumoDasNotasDto,
  SugestaoDeNotaDto,
} from './dto';

const FORMAS: Readonly<Record<string, string>> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  boleto: 'Boleto',
  link: 'Link de pagamento',
};

const formaExibida = (forma: string | null): string | null =>
  forma ? (FORMAS[forma] ?? forma) : null;

function atencao(nota: NotaFiscal): string {
  switch (nota.situacao) {
    case 'rejeitada':
      return nota.motivoDaRejeicao ?? 'Rejeitada pelo emissor';
    case 'processando':
      return 'Aguardando o emissor';
    case 'pendente':
      return 'Aguardando emissão';
    case 'cancelada':
      return nota.motivoDoCancelamento ?? 'Cancelada';
    default:
      return 'Emitida';
  }
}

export function notaDto(nota: NotaFiscal): NotaFiscalDto {
  return {
    id: nota.id,
    tipo: nota.tipo,
    tipoExibido: NOME_DO_TIPO[nota.tipo],
    situacao: nota.situacao,
    numero: nota.numero,
    rotulo: rotuloDoNumero(nota.tipo, nota.numero),
    alunoId: nota.alunoId,
    cliente: nota.tomadorNome,
    descricao: nota.descricao,
    codigoDoServico: nota.codigoDoServico,
    competencia: nota.competencia,
    competenciaExibida: competenciaExibida(nota.competencia),
    valorCentavos: nota.valorCentavos,
    aliquotaIssPontosBase: nota.aliquotaIssPontosBase,
    issCentavos: nota.issCentavos,
    retencoesCentavos: nota.retencoesCentavos,
    totalCentavos: nota.valorCentavos - nota.retencoesCentavos,
    formaDePagamento: formaExibida(nota.formaDePagamento),
    motivoDaRejeicao: nota.motivoDaRejeicao,
    motivoDoCancelamento: nota.motivoDoCancelamento,
    data: (nota.emitidaEm ?? nota.criadoEm).toISOString(),
    emitidaEm: nota.emitidaEm?.toISOString() ?? null,
    canceladaEm: nota.canceladaEm?.toISOString() ?? null,
    temPdf: nota.pdfChave !== null,
    temXml: nota.xmlChave !== null,
    registradaNaFicha: nota.registradaNaFicha,
    enviadaAoAlunoEm: nota.enviadaAoAlunoEm?.toISOString() ?? null,
    acao:
      nota.situacao === 'rejeitada' ? 'corrigir' : nota.situacao === 'pendente' ? 'emitir' : 'ver',
    atencao: atencao(nota),
  };
}

export function notaDetalheDto(nota: NotaFiscal): NotaFiscalDetalheDto {
  return { ...notaDto(nota), cpf: nota.tomadorCpf ? formatarCpf(nota.tomadorCpf) : null };
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function resumoDto(competencia: Competencia, resumo: ResumoDasNotas): ResumoDasNotasDto {
  return {
    competencia,
    competenciaPorExtenso: `${MESES[Number(competencia.slice(5, 7)) - 1]} ${competencia.slice(0, 4)}`,
    ...resumo,
  };
}

export function previaDto(previa: PreviaDaNota): PreviaDaNotaDto {
  return { ...previa };
}

export function sugestaoDto(sugestao: SugestaoDeNota, previa: PreviaDaNota): SugestaoDeNotaDto {
  return {
    cliente: {
      ...sugestao.cliente,
      cpf: formatarCpf(sugestao.cliente.cpf),
      telefone: sugestao.cliente.telefone ? formatarTelefone(sugestao.cliente.telefone) : null,
    },
    servico: {
      ...sugestao.servico,
      competenciaExibida: competenciaExibida(sugestao.servico.competencia),
      formaDePagamento: formaExibida(sugestao.servico.formaDePagamento),
    },
    dataDeEmissao: sugestao.dataDeEmissao,
    resumo: previaDto(previa),
  };
}

export function dadosFiscaisDto(dados: DadosFiscaisDaAcademia): DadosFiscaisDto {
  return {
    razaoSocial: dados.razaoSocial,
    cnpj: dados.cnpj ? formatarCnpj(dados.cnpj) : '',
    regime: dados.regime,
    municipio: dados.municipio,
    codigoDoServico: dados.codigoDoServico,
    aliquotaIssPontosBase: dados.aliquotaIssPontosBase,
    emitirNfseAoConfirmar: dados.emitirNfseAoConfirmar,
    emitirNfceNaVenda: dados.emitirNfceNaVenda,
    enviarAoAluno: dados.enviarAoAluno,
    emitirEmLote: dados.emitirEmLote,
    certificado: dados.certificado,
    emissor: dados.emissor,
    preenchido: dados.preenchido,
  };
}
