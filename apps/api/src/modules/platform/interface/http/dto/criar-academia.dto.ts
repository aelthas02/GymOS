import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { FORMATO_DA_COR, FORMATO_DO_SLUG } from '../../../domain/tenant';

/** Endpoint interno de operação: fora do contrato OpenAPI dos fronts. */
export class CriarAcademiaDto {
  @Matches(FORMATO_DO_SLUG, { message: 'slug: letras minúsculas, números e hífen' })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome!: string;

  @IsEmail()
  adminEmail!: string;

  @IsOptional()
  @Matches(FORMATO_DA_COR, { message: 'corDestaque deve estar no formato #RRGGBB' })
  corDestaque?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nomeDaUnidade?: string;
}
