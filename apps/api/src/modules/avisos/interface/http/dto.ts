import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LIMITE_MAXIMO_DE_AVISOS, LIMITE_PADRAO_DE_AVISOS } from '../../application/caixa';
import {
  LIMITE_DO_LINK,
  LIMITE_DO_TEXTO,
  LIMITE_DO_TITULO,
  TIPOS_DE_AVISO,
  type TipoDeAviso,
} from '../../domain/aviso';

// ---------- Entrada ----------

export class ConsultaDeAvisosDto {
  @ApiPropertyOptional({ description: 'Só os avisos ainda não lidos (aba "Não lidos").' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  naoLidos?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: LIMITE_MAXIMO_DE_AVISOS,
    default: LIMITE_PADRAO_DE_AVISOS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO_DE_AVISOS)
  limite?: number;

  @ApiPropertyOptional({ description: 'Cursor opaco devolvido pela página anterior.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}

export class ChavesDaInscricaoDto {
  @ApiProperty({ maxLength: 200, description: 'Chave pública do navegador (base64url).' })
  @IsString()
  @MaxLength(200)
  p256dh!: string;

  @ApiProperty({ maxLength: 100, description: 'Segredo de autenticação do navegador (base64url).' })
  @IsString()
  @MaxLength(100)
  auth!: string;
}

/** O que `PushSubscription.toJSON()` entrega no navegador (T32), mais o nome do aparelho. */
export class InscreverPushDto {
  @ApiProperty({ maxLength: 2048, description: 'Endereço https do provedor de push do navegador.' })
  @IsString()
  @MaxLength(2048)
  endpoint!: string;

  @ApiProperty({ type: ChavesDaInscricaoDto })
  @ValidateNested()
  @Type(() => ChavesDaInscricaoDto)
  keys!: ChavesDaInscricaoDto;

  @ApiPropertyOptional({ nullable: true, type: Number, description: 'Ignorado.' })
  @IsOptional()
  expirationTime?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 120, example: 'Chrome no Android' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  dispositivo?: string | null;
}

export class CancelarInscricaoDto {
  @ApiProperty({ maxLength: 2048 })
  @IsString()
  @MaxLength(2048)
  endpoint!: string;
}

export class DefinirPreferenciaDto {
  @ApiProperty({ enum: TIPOS_DE_AVISO, example: 'aula' })
  @IsIn(TIPOS_DE_AVISO)
  tipo!: TipoDeAviso;

  @ApiProperty({ description: 'Receber push desse tipo de aviso.' })
  @IsBoolean()
  push!: boolean;
}

export class ComunicadoDto {
  @ApiProperty({ maxLength: LIMITE_DO_TITULO, example: 'Manutenção da piscina' })
  @IsString()
  @MaxLength(LIMITE_DO_TITULO)
  titulo!: string;

  @ApiProperty({ maxLength: LIMITE_DO_TEXTO, example: 'Fechada no domingo, das 8h às 12h.' })
  @IsString()
  @MaxLength(LIMITE_DO_TEXTO)
  texto!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: LIMITE_DO_LINK, example: '/aulas' })
  @IsOptional()
  @IsString()
  @MaxLength(LIMITE_DO_LINK)
  link?: string | null;

  @ApiPropertyOptional({ default: false, description: 'Também envia Web Push.' })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Só estes alunos; sem a lista, todos os alunos da academia.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('4', { each: true })
  alunoIds?: string[];
}

// ---------- Saída ----------

export class AvisoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: TIPOS_DE_AVISO })
  tipo!: TipoDeAviso;

  @ApiProperty()
  titulo!: string;

  @ApiProperty()
  texto!: string;

  @ApiProperty({ nullable: true, type: String, description: 'Caminho interno do app.' })
  link!: string | null;

  @ApiProperty()
  lido!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  criadoEm!: string;
}

export class PaginaDeAvisosDto {
  @ApiProperty({ type: [AvisoDto] })
  itens!: AvisoDto[];

  @ApiProperty({ nullable: true, type: String, description: 'Nulo na última página.' })
  proximoCursor!: string | null;

  @ApiProperty({ description: 'Quantos avisos não lidos há no total (selo da aba).' })
  naoLidos!: number;
}

export class ContadorDeAvisosDto {
  @ApiProperty()
  naoLidos!: number;
}

export class ChavePublicaDoPushDto {
  @ApiProperty({ description: 'Valor de `applicationServerKey` na inscrição do navegador.' })
  chave!: string;
}

export class PreferenciaDeAvisoDto {
  @ApiProperty({ enum: TIPOS_DE_AVISO })
  tipo!: TipoDeAviso;

  @ApiProperty()
  push!: boolean;
}

export class ResultadoDoComunicadoDto {
  @ApiProperty({ description: 'Quantos alunos receberam o aviso.' })
  destinatarios!: number;
}
