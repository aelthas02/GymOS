import type { Pendencia } from '../../application/parcelas';
import type { Cobranca, FormaDePagamentoDoAluno } from '../../application/portas';
import type { Pagamento } from '../../domain/pagamento';
import { diasDeAtrasoDaParcela, type Parcela, saldo } from '../../domain/parcela';
import type { DataCivil } from '../../../platform/domain/relogio';
import type {
  CobrancaDto,
  FormaDePagamentoDoAlunoDto,
  PagamentoDto,
  ParcelaDto,
  PendenciaDto,
} from './dto';

export function parcelaDto(parcela: Parcela, hoje: DataCivil): ParcelaDto {
  const aReceber = saldo(parcela);
  return {
    id: parcela.id,
    contratoId: parcela.contratoId,
    numero: parcela.numero,
    totalDeParcelas: parcela.totalDeParcelas,
    valorCentavos: parcela.valorCentavos,
    pagoCentavos: parcela.pagoCentavos,
    saldoCentavos: aReceber,
    vencimento: parcela.vencimento,
    vencimentoOriginal: parcela.vencimentoOriginal,
    situacao: parcela.situacao,
    pagoParcial: parcela.pagoCentavos > 0 && aReceber > 0,
    diasDeAtraso: diasDeAtrasoDaParcela(parcela, hoje),
  };
}

export function pagamentoDto(pagamento: Pagamento): PagamentoDto {
  return {
    id: pagamento.id,
    parcelaId: pagamento.parcelaId,
    cobrancaId: pagamento.cobrancaId,
    valorCentavos: pagamento.valorCentavos,
    taxaCentavos: pagamento.taxaCentavos,
    estornadoCentavos: pagamento.estornadoCentavos,
    forma: pagamento.forma,
    canal: pagamento.canal,
    origem: pagamento.origem,
    setor: pagamento.setor,
    situacao: pagamento.situacao,
    emDuplicidade: pagamento.emDuplicidade,
    confirmadoEm: pagamento.confirmadoEm.toISOString(),
  };
}

export function cobrancaDto(cobranca: Cobranca): CobrancaDto {
  return {
    id: cobranca.id,
    parcelaId: cobranca.parcelaId,
    forma: cobranca.forma,
    valorCentavos: cobranca.valorCentavos,
    vencimento: cobranca.vencimento,
    situacao: cobranca.situacao,
    ...cobranca.dados,
  };
}

export function formaDto(forma: FormaDePagamentoDoAluno): FormaDePagamentoDoAlunoDto {
  return {
    forma: forma.forma,
    finalDoCartao: forma.finalDoCartao,
    atualizadoEm: forma.atualizadoEm.toISOString(),
  };
}

export function pendenciaDto(pendencia: Pendencia): PendenciaDto {
  if (pendencia.tipo === 'pagamento_em_duplicidade') {
    return {
      tipo: pendencia.tipo,
      titulo: pendencia.titulo,
      alunoId: pendencia.alunoId,
      alunoNome: pendencia.alunoNome,
      parcelaId: pendencia.parcelaId,
      pagamentoId: pendencia.pagamentoId,
      valorCentavos: pendencia.valorCentavos,
    };
  }
  return {
    tipo: pendencia.tipo,
    titulo: pendencia.titulo,
    alunoId: pendencia.alunoId,
    alunoNome: pendencia.alunoNome,
    parcelaId: pendencia.parcelaId,
    vencimento: pendencia.vencimento,
    valorCentavos: pendencia.saldoCentavos,
    diasDeAtraso: pendencia.diasDeAtraso,
  };
}
