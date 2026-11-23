import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl, Matches, MaxLength, ValidateIf } from 'class-validator';
import { FORMATO_DA_COR, type IdentidadeDoTenant } from '../../../domain/tenant';

export class IdentidadeDoTenantDto implements IdentidadeDoTenant {
  @ApiProperty({ example: 'Academia Ritmo', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nome!: string;

  @ApiProperty({ example: '#22C98A', pattern: FORMATO_DA_COR.source })
  @Matches(FORMATO_DA_COR, { message: 'corDestaque deve estar no formato #RRGGBB' })
  corDestaque!: string;

  @ApiProperty({ type: String, nullable: true, example: null, format: 'uri', maxLength: 2048 })
  @ValidateIf((_dto, valor) => valor !== null)
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(2048)
  logotipoUrl!: string | null;
}
