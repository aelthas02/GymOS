import { ApiProperty } from '@nestjs/swagger';
import { validarSenhaForte } from '@gymos/shared-validation';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  registerDecorator,
  ValidateIf,
} from 'class-validator';
import { ACOES, MODULOS_EXTRAS, type ModuloExtra, type Permissao } from '../../domain/permissoes';

/** Ao menos 8 caracteres, com letra e número (a mesma regra do formulário, T08). */
function SenhaForte(): PropertyDecorator {
  return (alvo, propriedade) =>
    registerDecorator({
      name: 'senhaForte',
      target: alvo.constructor,
      propertyName: String(propriedade),
      options: { message: 'senha deve ter ao menos 8 caracteres, com letra e número' },
      validator: {
        validate: (valor: unknown) => typeof valor === 'string' && validarSenhaForte(valor),
      },
    });
}

export class EntrarNoPainelDto {
  @ApiProperty({ example: 'carla@ritmo.com.br', maxLength: 254 })
  @IsString()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ maxLength: 128 })
  @IsString()
  @MaxLength(128)
  senha!: string;
}

export class EntrarNoAppDto {
  @ApiProperty({ description: 'CPF (com ou sem pontuação) ou e-mail.', example: '123.456.789-09' })
  @IsString()
  @MaxLength(254)
  identificador!: string;

  @ApiProperty({ maxLength: 128 })
  @IsString()
  @MaxLength(128)
  senha!: string;
}

export class PrimeiroAcessoDto {
  @ApiProperty({ description: 'CPF (com ou sem pontuação) ou e-mail.', example: '123.456.789-09' })
  @IsString()
  @MaxLength(254)
  identificador!: string;

  @ApiProperty({ description: 'Código entregue pela recepção.', example: 'K7M2QX9P' })
  @IsString()
  @MaxLength(32)
  codigo!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @SenhaForte()
  @MaxLength(128)
  senha!: string;
}

export class SessaoDto {
  @ApiProperty({ description: 'JWT de acesso, válido por 10 minutos (Authorization: Bearer).' })
  accessToken!: string;

  @ApiProperty({ format: 'date-time' })
  expiraEm!: string;
}

export class AceitarConviteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;

  @ApiProperty({ example: 'Diego Martins', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @SenhaForte()
  @MaxLength(128)
  senha!: string;
}

export class EsqueciSenhaDoPainelDto {
  @ApiProperty({ example: 'carla@ritmo.com.br' })
  @IsString()
  @MaxLength(254)
  email!: string;
}

export class EsqueciSenhaDoAppDto {
  @ApiProperty({ description: 'CPF (com ou sem pontuação) ou e-mail.' })
  @IsString()
  @MaxLength(254)
  identificador!: string;
}

export class RedefinirSenhaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @SenhaForte()
  @MaxLength(128)
  senha!: string;
}

export class ConvidarDto {
  @ApiProperty({ example: 'diego@ritmo.com.br' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Diego Martins', maxLength: 120 })
  @ValidateIf((_dto, valor) => valor !== null)
  @IsString()
  @MaxLength(120)
  nome!: string | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tipoDeAcessoId!: string;
}

export class ConviteCriadoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  expiraEm!: string;
}

class TipoDeAcessoResumoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Gerente' })
  nome!: string;
}

export class PerfilDto {
  @ApiProperty({ enum: ['staff', 'aluno'] })
  tipo!: 'staff' | 'aluno';

  @ApiProperty({ format: 'uuid', description: 'Usuário da equipe ou aluno.' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  nome!: string | null;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: TipoDeAcessoResumoDto, nullable: true })
  tipoDeAcesso!: TipoDeAcessoResumoDto | null;

  @ApiProperty({
    type: [String],
    description: `Permissões \`modulo:acao\` (ações: ${ACOES.join(', ')}).`,
    example: ['alunos:ver', 'alunos:criar'],
  })
  permissoes!: Permissao[];

  @ApiProperty({ enum: MODULOS_EXTRAS, enumName: 'ModuloExtra', isArray: true })
  modulos!: ModuloExtra[];
}

export class SobrescreverModuloDto {
  @ApiProperty({ type: Boolean, nullable: true, description: 'null volta ao que o plano dá.' })
  @ValidateIf((_dto, valor) => valor !== null)
  @IsBoolean()
  ativo!: boolean | null;
}
