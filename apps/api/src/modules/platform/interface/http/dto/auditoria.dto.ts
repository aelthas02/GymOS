import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  LIMITE_MAXIMO,
  LIMITE_PADRAO,
  TIPOS_DE_LISTAGEM,
  type TipoDeListagem,
} from '../../../application/auditoria';

/** Filtros de Log.html; `de` e `ate` são instantes ISO-8601 (o front converte "Últimos 7 dias"). */
export class FiltroDoLogDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Usuário que agiu.' })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiPropertyOptional({ example: 'planos', description: 'Chave do módulo (catálogo de módulos).' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  modulo?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Início do período, inclusive.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  de?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Fim do período, exclusivo.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  ate?: string;

  @ApiPropertyOptional({
    enum: TIPOS_DE_LISTAGEM,
    default: 'todos',
    description:
      '`todos`: cronológico; `destaque` ("Todos, com sensíveis em destaque"): sensíveis primeiro; ' +
      '`sensiveis`: só os sensíveis.',
  })
  @IsOptional()
  @IsIn(TIPOS_DE_LISTAGEM)
  tipo?: TipoDeListagem;
}

export class ConsultaDoLogDto extends FiltroDoLogDto {
  @ApiPropertyOptional({ minimum: 1, maximum: LIMITE_MAXIMO, default: LIMITE_PADRAO })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO)
  limite?: number;

  @ApiPropertyOptional({ description: '`proximoCursor` da página anterior.', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;
}

export class AtividadeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  quando!: string;

  @ApiProperty({ example: 'Carla Menezes' })
  quem!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Nulo: o sistema.' })
  quemId!: string | null;

  @ApiProperty({ example: 'Gerente' })
  papel!: string;

  @ApiProperty({ example: 'alterou-valor' })
  acao!: string;

  @ApiProperty({ example: 'Alterou valor' })
  acaoTexto!: string;

  @ApiProperty({ example: 'planos' })
  modulo!: string;

  @ApiProperty({ example: 'Planos' })
  moduloTexto!: string;

  @ApiProperty({ example: 'Plano Mensal: R$ 109,00 para R$ 119,00' })
  detalhe!: string;

  @ApiProperty()
  sensivel!: boolean;

  @ApiProperty({ type: String, nullable: true, example: 'Sensível' })
  etiqueta!: string | null;
}

export class PaginaDoLogDto {
  @ApiProperty({ type: [AtividadeDto] })
  itens!: AtividadeDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Nulo na última página.' })
  proximoCursor!: string | null;
}
