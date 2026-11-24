import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FINALIDADES, type Finalidade } from '../../../platform/domain/consentimento';
import type { DataCivil } from '../../../platform/domain/relogio';
import { LIMITE_MAXIMO_DA_LISTA, LIMITE_PADRAO_DA_LISTA } from '../../application/alunos';
import {
  ESTADOS_DO_CONTRATO,
  type EstadoDoContrato,
  MOTIVOS_DE_ENCERRAMENTO,
  type MotivoDoEncerramento,
  SITUACOES_DE_VENCIMENTO,
  type SituacaoDeVencimento,
} from '../../domain/contrato';
import { FORMAS_DE_COBRANCA, type FormaDeCobranca } from '../../domain/plano';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MENSAGEM_DO_DIA = 'use o formato AAAA-MM-DD';

// ---------- Planos ----------

export class DadosDoPlanoDto {
  @ApiProperty({ example: 'Anual', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  nome!: string;

  @ApiProperty({ example: 94800, description: 'Valor total em centavos.' })
  @IsInt()
  @Min(1)
  valorTotalCentavos!: number;

  @ApiProperty({ example: 12, minimum: 1, maximum: 120 })
  @IsInt()
  @Min(1)
  @Max(120)
  duracaoMeses!: number;

  @ApiProperty({ example: 9, minimum: 1, description: 'No máximo a duração em meses.' })
  @IsInt()
  @Min(1)
  parcelas!: number;

  @ApiProperty({ enum: FORMAS_DE_COBRANCA, example: 'cartao_ou_pix' })
  @IsIn(FORMAS_DE_COBRANCA)
  formaDeCobranca!: FormaDeCobranca;

  @ApiProperty({ type: [String], example: ['Musculação', 'Spinning', 'Funcional'] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  modalidades!: string[];

  @ApiProperty({ type: Number, nullable: true, example: null, description: 'null é ilimitado.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  acessosPorSemana!: number | null;

  @ApiProperty()
  @IsBoolean()
  renovacaoAutomatica!: boolean;

  @ApiProperty({ description: 'Plano ativo para venda.' })
  @IsBoolean()
  ativo!: boolean;
}

export class PlanoDto extends DadosDoPlanoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 10533, description: 'Parcela derivada com o rateio (centavos).' })
  parcelaCentavos!: number;

  @ApiProperty({ example: 10536, description: 'A última parcela leva o resto da divisão.' })
  ultimaParcelaCentavos!: number;

  @ApiProperty({ example: 38, description: 'Alunos com contrato vigente não encerrado.' })
  alunosAtivos!: number;
}

export class ConsultaDePlanosDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  busca?: string;
}

export class PreviaDoPlanoConsultaDto {
  @ApiProperty({ example: 94800 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  valorTotalCentavos!: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duracaoMeses!: number;

  @ApiProperty({ example: 9 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parcelas!: number;
}

export class PreviaDoPlanoDto {
  @ApiProperty({ example: 9 })
  parcelas!: number;

  @ApiProperty({ example: 10533 })
  parcelaCentavos!: number;

  @ApiProperty({ example: 10536 })
  ultimaCentavos!: number;

  @ApiProperty({
    example:
      'O aluno tem acesso por 12 meses e paga em 9 parcelas. As cobranças terminam na 9ª parcela, e o contrato segue ativo até o fim dos 12 meses.',
  })
  explicacao!: string;
}

// ---------- Contratos ----------

export class ContratoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  alunoId!: string;

  @ApiProperty({ format: 'uuid' })
  planoId!: string;

  @ApiProperty({ example: 'Anual' })
  planoNome!: string;

  @ApiProperty({ enum: ESTADOS_DO_CONTRATO, description: 'Estado guardado (ADR-018).' })
  estado!: EstadoDoContrato;

  @ApiProperty({ format: 'date', example: '2026-11-19' })
  inicio!: string;

  @ApiProperty({ format: 'date', example: '2027-11-18', description: 'Último dia da vigência.' })
  fim!: string;

  @ApiProperty({ format: 'date-time', description: 'Fim da vigência às 23:59:59 de São Paulo.' })
  vigenteAte!: string;

  @ApiProperty({ example: 94800 })
  valorTotalCentavos!: number;

  @ApiProperty({ example: 9 })
  parcelas!: number;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  vencimentoEmAtraso!: string | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  proximoVencimento!: string | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  encerradoEm!: string | null;

  @ApiProperty({ enum: MOTIVOS_DE_ENCERRAMENTO, nullable: true })
  motivoDoEncerramento!: MotivoDoEncerramento | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  trancadoDesde!: string | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  trancadoAte!: string | null;
}

export class AvaliacaoDoContratoDto {
  @ApiProperty({ enum: ESTADOS_DO_CONTRATO, description: 'Estado hoje (ADR-018).' })
  estado!: EstadoDoContrato;

  @ApiProperty({
    example: 6,
    description: 'Dias corridos desde o vencimento mais antigo em aberto.',
  })
  diasDeAtraso!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 1,
    description: 'Só em Tolerância: "Contrato encerra em N dias" (T − diasDeAtraso).',
  })
  encerraEmDias!: number | null;

  @ApiProperty({ format: 'date', nullable: true, type: String })
  encerradoEm!: string | null;

  @ApiProperty({ enum: MOTIVOS_DE_ENCERRAMENTO, nullable: true })
  motivoDoEncerramento!: MotivoDoEncerramento | null;
}

export class SituacaoDoAlunoDto {
  @ApiProperty({ format: 'uuid' })
  alunoId!: string;

  @ApiProperty({ enum: SITUACOES_DE_VENCIMENTO, description: 'A vencer: até 7 dias, inclusive.' })
  situacaoDeVencimento!: SituacaoDeVencimento;

  @ApiProperty({ type: AvaliacaoDoContratoDto, nullable: true })
  avaliacao!: AvaliacaoDoContratoDto | null;

  @ApiProperty({ type: ContratoDto, nullable: true, description: 'null quando não há contrato.' })
  contrato!: ContratoDto | null;
}

export class AderirDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  planoId!: string;

  @ApiPropertyOptional({ format: 'date', description: 'Padrão: hoje (São Paulo).' })
  @IsOptional()
  @Matches(DIA, { message: MENSAGEM_DO_DIA })
  inicio?: string;
}

export class TrancarDto {
  @ApiProperty({ example: 30, minimum: 1, description: 'Até o máximo configurado (padrão 90).' })
  @IsInt()
  @Min(1)
  dias!: number;
}

export class ConfiguracaoDeContratoDto {
  @ApiProperty({ example: 7, minimum: 1, maximum: 90, description: 'Tolerância de atraso (dias).' })
  @IsInt()
  @Min(1)
  @Max(90)
  toleranciaDias!: number;

  @ApiProperty({
    example: 30,
    minimum: 0,
    maximum: 365,
    description: 'Reativar sem nova adesão até.',
  })
  @IsInt()
  @Min(0)
  @Max(365)
  reativacaoDias!: number;

  @ApiProperty({ example: 90, minimum: 1, maximum: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  trancamentoMaximoDias!: number;
}

// ---------- Alunos ----------

export class ConsentimentoDto {
  @ApiProperty({ enum: FINALIDADES })
  @IsIn(FINALIDADES)
  finalidade!: Finalidade;

  @ApiProperty({ enum: ['aceite', 'revogacao'] })
  @IsIn(['aceite', 'revogacao'])
  decisao!: 'aceite' | 'revogacao';
}

export class DadosDoAlunoDto {
  @ApiProperty({ example: 'Pedro Almeida', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ example: '123.456.789-09', description: 'Com ou sem pontuação.' })
  @IsString()
  @MaxLength(14)
  cpf!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '(11) 98888-7777' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'pedro@email.com' })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date' })
  @IsOptional()
  @Matches(DIA, { message: MENSAGEM_DO_DIA })
  dataNascimento?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  professorId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meta?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 1000,
    description: 'Dado de saúde: cifrado, e cada leitura vai para o log de acesso.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  restricoes?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    format: 'uuid',
    description: 'Lead de origem.',
  })
  @IsOptional()
  @IsUUID()
  leadId?: string | null;
}

export class CadastrarAlunoDto extends DadosDoAlunoDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Padrão: a primeira unidade da academia.' })
  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Com plano, o cadastro já cria o contrato.' })
  @IsOptional()
  @IsUUID()
  planoId?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Início do contrato; padrão: hoje.' })
  @IsOptional()
  @Matches(DIA, { message: MENSAGEM_DO_DIA })
  inicioDoContrato?: string;

  @ApiPropertyOptional({ type: [ConsentimentoDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ConsentimentoDto)
  consentimentos?: ConsentimentoDto[];
}

export class AlunoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  unidadeId!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty({ example: '12345678909', description: 'Só dígitos.' })
  cpf!: string;

  @ApiProperty({ type: String, nullable: true })
  telefone!: string | null;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date' })
  dataNascimento!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  professorId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  meta!: string | null;

  @ApiProperty({ type: String, nullable: true })
  restricoes!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  leadId!: string | null;

  @ApiProperty({ format: 'date-time' })
  criadoEm!: string;
}

export class ConsultaDeAlunosDto {
  @ApiPropertyOptional({ enum: SITUACOES_DE_VENCIMENTO })
  @IsOptional()
  @IsIn(SITUACOES_DE_VENCIMENTO)
  situacao?: SituacaoDeVencimento;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  planoId?: string;

  @ApiPropertyOptional({
    maxLength: 120,
    description: 'Nome (parte), CPF completo ou telefone completo. CPF parcial não é suportado.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busca?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: LIMITE_MAXIMO_DA_LISTA,
    default: LIMITE_PADRAO_DA_LISTA,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO_DA_LISTA)
  limite?: number;

  @ApiPropertyOptional({ description: 'proximoCursor da página anterior.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cursor?: string;
}

export class PlanoResumidoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Mensal' })
  nome!: string;
}

export class ItemDaListaDeAlunosDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Rafael Souza' })
  nome!: string;

  @ApiProperty({ type: PlanoResumidoDto, nullable: true })
  plano!: PlanoResumidoDto | null;

  @ApiProperty({ enum: SITUACOES_DE_VENCIMENTO })
  situacao!: SituacaoDeVencimento;

  @ApiProperty({
    enum: ESTADOS_DO_CONTRATO,
    nullable: true,
    description: 'Estado do contrato hoje.',
  })
  estadoDoContrato!: EstadoDoContrato | null;

  @ApiProperty({ example: 6, description: '"Em atraso, 6 dias".' })
  diasDeAtraso!: number;

  @ApiProperty({ type: Number, nullable: true, example: 3, description: '"Vence em 3 dias".' })
  venceEmDias!: number | null;
}

export class ContadoresDeAlunosDto {
  @ApiProperty({ example: 312 })
  todos!: number;

  @ApiProperty({ example: 289 })
  em_dia!: number;

  @ApiProperty({ example: 11 })
  a_vencer!: number;

  @ApiProperty({ example: 12 })
  em_atraso!: number;
}

export class PaginaDeAlunosDto {
  @ApiProperty({ type: [ItemDaListaDeAlunosDto] })
  itens!: ItemDaListaDeAlunosDto[];

  @ApiProperty({ type: String, nullable: true })
  proximoCursor!: string | null;

  @ApiProperty({
    type: ContadoresDeAlunosDto,
    description: 'Por situação, com plano e busca aplicados.',
  })
  contadores!: ContadoresDeAlunosDto;
}

export class ExcluirAlunoDto {
  @ApiPropertyOptional({ example: 'Cadastro duplicado', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}

export class CodigoDeAcessoDto {
  @ApiProperty({ example: 'K7M2QX9P', description: 'Vale 7 dias e uma vez.' })
  codigo!: string;
}

// ---------- Importação ----------

export class LinhaDaPlanilhaDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ maxLength: 20 })
  @IsString()
  @MaxLength(20)
  cpf!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date' })
  @IsOptional()
  @Matches(DIA, { message: MENSAGEM_DO_DIA })
  dataNascimento?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Nome do plano cadastrado.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  plano?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date' })
  @IsOptional()
  @Matches(DIA, { message: MENSAGEM_DO_DIA })
  inicioDoContrato?: string | null;
}

export class ImportarAlunosDto {
  @ApiProperty({ type: [LinhaDaPlanilhaDto] })
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => LinhaDaPlanilhaDto)
  linhas!: LinhaDaPlanilhaDto[];
}

export class LinhaDoRelatorioDto {
  @ApiProperty({ example: 14 })
  linha!: number;

  @ApiProperty()
  nome!: string;

  @ApiProperty()
  cpf!: string;

  @ApiProperty({ enum: ['pulada', 'para_corrigir'] })
  situacao!: 'pulada' | 'para_corrigir';

  @ApiProperty({ example: 'CPF inválido' })
  motivo!: string;
}

export class RelatorioDaImportacaoDto {
  @ApiProperty({ example: 300 })
  criados!: number;

  @ApiProperty({ example: 297 })
  comContrato!: number;

  @ApiProperty({ example: 3 })
  semContrato!: number;

  @ApiProperty({ type: [LinhaDoRelatorioDto] })
  linhas!: LinhaDoRelatorioDto[];
}

export const comoDia = (valor: string | null | undefined): DataCivil | null =>
  valor ? (valor as DataCivil) : null;
