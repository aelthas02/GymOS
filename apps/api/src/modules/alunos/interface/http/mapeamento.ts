import { FUSO_PADRAO, type DataCivil } from '../../../platform/domain/relogio';
import type { SituacaoDoAluno } from '../../application/contratos';
import type {
  Aluno,
  Contrato,
  ItemDaListaDeAlunos,
  PlanoComAlunos,
} from '../../application/portas';
import {
  avaliarContrato,
  type ConfiguracaoDeContrato,
  situacaoDeVencimento,
} from '../../domain/contrato';
import { diasEntre, ehDataCivil, fimDoDiaEm } from '../../domain/datas';
import { type Plano, valorDasParcelas } from '../../domain/plano';
import type { DadosPessoaisDoAluno } from '../../application/portas';
import type {
  AlunoDto,
  ContratoDto,
  DadosDoAlunoDto,
  ItemDaListaDeAlunosDto,
  PlanoDto,
  SituacaoDoAlunoDto,
} from './dto';
import { DataInvalidaError } from './erros.filter';

/** `AAAA-MM-DD` que existe no calendário (31/02 é recusado). */
export function dia(valor: string, campo: string): DataCivil;
export function dia(valor: string | null | undefined, campo: string): DataCivil | null;
export function dia(valor: string | null | undefined, campo: string): DataCivil | null {
  if (!valor) {
    return null;
  }
  if (!ehDataCivil(valor)) {
    throw new DataInvalidaError(campo);
  }
  return valor;
}

export function dadosPessoais(corpo: DadosDoAlunoDto): DadosPessoaisDoAluno {
  return {
    nome: corpo.nome,
    cpf: corpo.cpf,
    telefone: corpo.telefone ?? null,
    email: corpo.email ?? null,
    dataNascimento: dia(corpo.dataNascimento, 'dataNascimento'),
    professorId: corpo.professorId ?? null,
    meta: corpo.meta ?? null,
    restricoes: corpo.restricoes ?? null,
    leadId: corpo.leadId ?? null,
  };
}

export function planoDto(plano: Plano & Partial<Pick<PlanoComAlunos, 'alunosAtivos'>>): PlanoDto {
  const valores = valorDasParcelas(plano.valorTotalCentavos, plano.parcelas);
  return {
    id: plano.id,
    nome: plano.nome,
    valorTotalCentavos: plano.valorTotalCentavos,
    duracaoMeses: plano.duracaoMeses,
    parcelas: plano.parcelas,
    formaDeCobranca: plano.formaDeCobranca,
    modalidades: [...plano.modalidades],
    acessosPorSemana: plano.acessosPorSemana,
    renovacaoAutomatica: plano.renovacaoAutomatica,
    ativo: plano.ativo,
    parcelaCentavos: valores.parcelaCentavos,
    ultimaParcelaCentavos: valores.ultimaCentavos,
    alunosAtivos: plano.alunosAtivos ?? 0,
  };
}

export function contratoDto(contrato: Contrato): ContratoDto {
  return {
    id: contrato.id,
    alunoId: contrato.alunoId,
    planoId: contrato.planoId,
    planoNome: contrato.planoNome,
    estado: contrato.estado,
    inicio: contrato.inicio,
    fim: contrato.fim,
    vigenteAte: fimDoDiaEm(contrato.fim, FUSO_PADRAO).toISOString(),
    valorTotalCentavos: contrato.valorTotalCentavos,
    parcelas: contrato.parcelas,
    vencimentoEmAtraso: contrato.vencimentoEmAtraso,
    proximoVencimento: contrato.proximoVencimento,
    encerradoEm: contrato.encerradoEm,
    motivoDoEncerramento: contrato.motivoDoEncerramento,
    trancadoDesde: contrato.trancadoDesde,
    trancadoAte: contrato.trancadoAte,
  };
}

export function situacaoDto(situacao: SituacaoDoAluno): SituacaoDoAlunoDto {
  return {
    alunoId: situacao.alunoId,
    situacaoDeVencimento: situacao.situacaoDeVencimento,
    avaliacao: situacao.avaliacao,
    contrato: situacao.contrato ? contratoDto(situacao.contrato) : null,
  };
}

export function alunoDto(aluno: Aluno): AlunoDto {
  return { ...aluno, criadoEm: aluno.criadoEm.toISOString() };
}

export function itemDaListaDto(
  item: ItemDaListaDeAlunos,
  hoje: DataCivil,
  config: ConfiguracaoDeContrato,
): ItemDaListaDeAlunosDto {
  const situacao = situacaoDeVencimento(item.contrato, hoje);
  const avaliacao = item.contrato ? avaliarContrato(item.contrato, hoje, config) : null;
  const proximo = item.contrato?.proximoVencimento ?? null;
  return {
    id: item.id,
    nome: item.nome,
    plano: item.plano,
    situacao,
    estadoDoContrato: avaliacao?.estado ?? null,
    diasDeAtraso: avaliacao?.diasDeAtraso ?? 0,
    venceEmDias: situacao === 'a_vencer' && proximo ? diasEntre(hoje, proximo) : null,
  };
}
