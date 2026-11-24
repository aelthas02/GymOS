import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MOTIVOS_DE_NEGACAO } from '@gymos/shared-acesso';
import {
  DESTINATARIOS_DO_ALERTA,
  NIVEIS_DO_ALERTA,
  type DestinatarioDoAlerta,
  type NivelDoAlerta,
} from '../../domain/alerta';

const DIRECOES = ['entrada', 'saida'] as const;
const METODOS = ['facial', 'biometria', 'qr_code', 'manual'] as const;
const RESULTADOS = ['liberado', 'tolerancia', 'negado'] as const;
const MOTIVOS = Object.keys(MOTIVOS_DE_NEGACAO);
const HORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- Entrada ----------

export class CheckInDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  alunoId!: string;

  @ApiPropertyOptional({ enum: DIRECOES, default: 'entrada' })
  @IsOptional()
  @IsIn(DIRECOES)
  direcao?: (typeof DIRECOES)[number];

  @ApiPropertyOptional({
    nullable: true,
    example: 'Lutas',
    description: 'Modalidade do ponto de acesso.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  modalidade?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  unidadeId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Id gerado na origem; reenviar não grava de novo.',
  })
  @IsOptional()
  @IsUUID('4')
  idDeOrigem?: string;
}

export class CheckInPorQrDto {
  @ApiProperty({ maxLength: 700, description: 'Token do QR mostrado no app do aluno.' })
  @IsString()
  @MinLength(1)
  @MaxLength(700)
  token!: string;

  @ApiPropertyOptional({ enum: DIRECOES, default: 'entrada' })
  @IsOptional()
  @IsIn(DIRECOES)
  direcao?: (typeof DIRECOES)[number];

  @ApiPropertyOptional({ nullable: true, example: 'Lutas' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  modalidade?: string | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Dispositivo de leitura (T23b).' })
  @IsOptional()
  @IsUUID('4')
  dispositivoId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  unidadeId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Id gerado na origem; reenviar não grava de novo.',
  })
  @IsOptional()
  @IsUUID('4')
  idDeOrigem?: string;
}

export class LiberacaoManualDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  alunoId!: string;

  @ApiProperty({ maxLength: 200, example: 'Esqueceu o celular; pagamento em dia na Recepção.' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  motivo!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Lutas' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  modalidade?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  unidadeId?: string;
}

export class RegistroOfflineDto {
  @ApiProperty({ format: 'uuid', description: 'Gerado no agente; deduplica reenvios.' })
  @IsUUID('4')
  idDeOrigem!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID('4')
  alunoId!: string | null;

  @ApiProperty({ enum: METODOS })
  @IsIn(METODOS)
  metodo!: (typeof METODOS)[number];

  @ApiProperty({ enum: DIRECOES })
  @IsIn(DIRECOES)
  direcao!: (typeof DIRECOES)[number];

  @ApiProperty({ enum: RESULTADOS })
  @IsIn(RESULTADOS)
  resultado!: (typeof RESULTADOS)[number];

  @ApiPropertyOptional({ enum: MOTIVOS, nullable: true, description: 'Obrigatório quando negado.' })
  @IsOptional()
  @IsIn(MOTIVOS)
  motivo?: keyof typeof MOTIVOS_DE_NEGACAO | null;

  @ApiPropertyOptional({ nullable: true, example: 'Lutas' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  modalidade?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID('4')
  dispositivoId?: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Horário de origem (ISO 8601).' })
  @Type(() => Date)
  @IsDate()
  registradoEm!: Date;

  @ApiPropertyOptional({ nullable: true, maxLength: 22, description: 'Nonce do QR usado offline.' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{22}$/)
  qrNonce?: string | null;
}

export class SincronizarAcessosDto {
  @ApiProperty({ type: [RegistroOfflineDto], maxItems: 500 })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => RegistroOfflineDto)
  registros!: RegistroOfflineDto[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  unidadeId?: string;
}

export class ConfiguracaoDeAcessoDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    minimum: 1,
    maximum: 90,
    example: 7,
    description: 'Bloquear após N dias de atraso (ADR-018); nulo não bloqueia.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  bloqueioPorAtrasoDias!: number | null;

  @ApiProperty({ example: '05:00' })
  @Matches(HORARIO)
  abertura!: string;

  @ApiProperty({ example: '23:00' })
  @Matches(HORARIO)
  fechamento!: string;

  @ApiProperty({ nullable: true, type: Number, minimum: 1, maximum: 24, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  limitePorDia!: number | null;

  @ApiProperty()
  @IsBoolean()
  antiPassback!: boolean;
}

export class ConfiguracaoDosAlertasDto {
  @ApiProperty({ minimum: 1, maximum: 365, example: 7 })
  @IsInt()
  @Min(1)
  @Max(365)
  diasSemTreinar!: number;

  @ApiProperty({ minimum: 1, maximum: 365, example: 15 })
  @IsInt()
  @Min(1)
  @Max(365)
  urgenteAposDias!: number;

  @ApiProperty({ minimum: 1, maximum: 100, example: 40 })
  @IsInt()
  @Min(1)
  @Max(100)
  quedaPercentual!: number;

  @ApiProperty()
  @IsBoolean()
  ignorarFeriasETrancados!: boolean;

  @ApiProperty({ example: '08:00' })
  @Matches(HORARIO)
  horaDaVerificacao!: string;

  @ApiProperty({ enum: DESTINATARIOS_DO_ALERTA, isArray: true })
  @IsArray()
  @IsIn(DESTINATARIOS_DO_ALERTA, { each: true })
  destinatarios!: DestinatarioDoAlerta[];

  @ApiProperty({ description: 'Mensagem automática ao aluno; só para quem aceitou marketing.' })
  @IsBoolean()
  mensagemAoAluno!: boolean;
}

export class ConsultaDeMesDto {
  @ApiProperty({ example: '2026-11', description: 'Mês no formato AAAA-MM.' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  mes!: string;
}

export class ConsultaPorAlunoDto extends ConsultaDeMesDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @ApiPropertyOptional({ description: 'Cursor opaco devolvido pela página anterior.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  cursor?: string;
}

export class ConsultaDeRiscoDto {
  @ApiPropertyOptional({ enum: NIVEIS_DO_ALERTA })
  @IsOptional()
  @IsIn(NIVEIS_DO_ALERTA)
  nivel?: NivelDoAlerta;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Só os alunos deste professor (funcionário).',
  })
  @IsOptional()
  @IsUUID('4')
  professorId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;
}

// ---------- Saída ----------

export class AcessoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) idDeOrigem!: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) alunoId!: string | null;
  @ApiProperty({ enum: METODOS }) metodo!: string;
  @ApiProperty({ enum: DIRECOES }) direcao!: string;
  @ApiProperty({ enum: RESULTADOS }) resultado!: string;
  @ApiProperty({ enum: MOTIVOS, nullable: true, type: String }) motivo!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'Mensalidade em atraso' })
  motivoTexto!: string | null;
  @ApiProperty({ nullable: true, type: String }) modalidade!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) registradoEm!: string;
}

export class ResultadoDoAcessoDto {
  @ApiProperty({ type: AcessoDto }) acesso!: AcessoDto;
  @ApiProperty({ description: 'O id de origem já estava gravado: nada mudou.' }) repetido!: boolean;
}

export class ResultadoDaSincronizacaoDto {
  @ApiProperty() gravados!: number;
  @ApiProperty() repetidos!: number;
  @ApiProperty({ description: 'Acessos cujo QR já constava como usado em outro acesso.' })
  qrRepetidos!: number;
}

export class QrDeCheckinDto {
  @ApiProperty({ description: 'Token assinado; mostre-o como QR Code.' }) token!: string;
  @ApiProperty({ type: String, format: 'date-time' }) expiraEm!: string;
  @ApiProperty({ example: 60 }) validadeSegundos!: number;
}

export class ChavesPublicasDoQrDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      'kid → chave pública Ed25519 (SPKI DER em base64), para o agente conferir o QR offline.',
  })
  chaves!: Record<string, string>;
}

export class ChecksInDeHojeDto {
  @ApiProperty({ example: '2026-11-19' }) dia!: string;
  @ApiProperty() liberados!: number;
  @ApiProperty() negados!: number;
}

export class FaixaDeHorarioDto {
  @ApiProperty({ minimum: 0, maximum: 23 }) hora!: number;
  @ApiProperty() entradas!: number;
  @ApiProperty({ description: 'Média de entradas por dia, uma casa decimal.' })
  mediaPorDia!: number;
}

export class FrequenciaPorHorarioDto {
  @ApiProperty() de!: string;
  @ApiProperty() ate!: string;
  @ApiProperty({ example: 30 }) dias!: number;
  @ApiProperty({ type: [FaixaDeHorarioDto] }) faixas!: FaixaDeHorarioDto[];
  @ApiProperty({ nullable: true, type: Number }) horarioMaisCheio!: number | null;
}

export class FrequenciaDoAlunoDto {
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ nullable: true, type: String }) planoNome!: string | null;
  @ApiProperty() treinos!: number;
  @ApiProperty({ nullable: true, type: String }) ultimoTreino!: string | null;
  @ApiProperty({ nullable: true, type: Number }) diasSemTreinar!: number | null;
  @ApiProperty({ enum: NIVEIS_DO_ALERTA, nullable: true, type: String }) alerta!: string | null;
}

export class PaginaDeFrequenciaPorAlunoDto {
  @ApiProperty() mes!: string;
  @ApiProperty({ type: [FrequenciaDoAlunoDto] }) itens!: FrequenciaDoAlunoDto[];
  @ApiProperty() total!: number;
  @ApiProperty({ nullable: true, type: String }) proximoCursor!: string | null;
}

export class PresencaDoAlunoDto {
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty() presencas!: number;
}

export class PresencasDoMesDto {
  @ApiProperty() mes!: string;
  @ApiProperty({ description: 'Soma das presenças (aluno-dia): base do rateio de receita (T21).' })
  total!: number;
  @ApiProperty({ type: [PresencaDoAlunoDto] }) alunos!: PresencaDoAlunoDto[];
}

export class AlunoEmRiscoDto {
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) professorId!: string | null;
  @ApiProperty({ enum: NIVEIS_DO_ALERTA }) nivel!: string;
  @ApiProperty({ enum: ['sem_treinar', 'queda'] }) tipo!: string;
  @ApiProperty({ nullable: true, type: Number }) diasSemTreinar!: number | null;
  @ApiProperty({ nullable: true, type: Number }) quedaPercentual!: number | null;
  @ApiProperty({ type: String, format: 'date-time' }) desde!: string;
}

export class PaginaDeAlunosEmRiscoDto {
  @ApiProperty({ type: [AlunoEmRiscoDto] }) itens!: AlunoEmRiscoDto[];
  @ApiProperty() total!: number;
  @ApiProperty() urgentes!: number;
  @ApiProperty() comuns!: number;
  @ApiProperty({ nullable: true, type: String }) proximoCursor!: string | null;
  @ApiProperty({ enum: DESTINATARIOS_DO_ALERTA, isArray: true })
  destinatarios!: string[];
}

export class PreviaDosAlertasDto {
  @ApiProperty({ description: 'Alunos que seriam alertados hoje com a regra atual.' })
  total!: number;
  @ApiProperty({ description: 'Em nível urgente.' }) urgentes!: number;
  @ApiProperty({ description: 'Em nível comum.' }) comuns!: number;
}
