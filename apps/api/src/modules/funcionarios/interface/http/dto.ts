import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
import { LIMITE_MAXIMO_DA_LISTA, LIMITE_PADRAO_DA_LISTA } from '../../application/funcionarios';
import {
  CARGOS,
  type ChaveDoCargo,
  FILTROS_DA_EQUIPE,
  type FiltroDeCargo,
} from '../../domain/funcionario';

const CHAVES_DOS_CARGOS = CARGOS.map((cargo) => cargo.chave);

// ---------- Entrada ----------

export class DadosDoFuncionarioDto {
  @ApiProperty({ example: 'Diego Martins', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ enum: CHAVES_DOS_CARGOS, example: 'professor' })
  @IsIn(CHAVES_DOS_CARGOS)
  cargo!: ChaveDoCargo;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 80,
    description: 'Obrigatório no cargo "outro".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cargoDescricao?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '11987654321', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefone?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 160,
    description: 'E-mail de login: obrigatório com tipo de acesso, opcional sem acesso.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Tipo de acesso ao painel. Nulo ou o tipo "Sem acesso": só cadastro.',
  })
  @IsOptional()
  @IsUUID()
  tipoDeAcessoId?: string | null;

  @ApiPropertyOptional({ example: 45000, minimum: 0, description: 'Custo mensal em centavos.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  custoMensalCentavos?: number;
}

export class ConvidarEquipeDto {
  @ApiProperty({
    type: [DadosDoFuncionarioDto],
    description: 'Pessoas do Passo 3, uma linha cada.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DadosDoFuncionarioDto)
  pessoas!: DadosDoFuncionarioDto[];
}

export class ConsultaDeFuncionariosDto {
  @ApiPropertyOptional({ enum: FILTROS_DA_EQUIPE, description: 'Chip da tela Equipe.' })
  @IsOptional()
  @IsIn(FILTROS_DA_EQUIPE)
  cargo?: FiltroDeCargo;

  @ApiPropertyOptional({ maxLength: 120, description: 'Parte do nome.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  busca?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

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
}

export class ConsultaDeProfissionaisDto {
  @ApiPropertyOptional({
    enum: CHAVES_DOS_CARGOS,
    description: 'Um cargo só. Sem ele, professores e nutricionistas ativos.',
  })
  @IsOptional()
  @IsIn(CHAVES_DOS_CARGOS)
  cargo?: ChaveDoCargo;
}

// ---------- Saída ----------

export class TipoDeAcessoResumidoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Professor' })
  nome!: string;
}

export class FuncionarioDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty({ enum: CHAVES_DOS_CARGOS })
  cargo!: string;

  @ApiProperty({
    example: 'Professor',
    description: 'Texto do cargo (a descrição, no cargo "outro").',
  })
  cargoNome!: string;

  @ApiProperty({ nullable: true })
  cargoDescricao!: string | null;

  @ApiProperty({ nullable: true, description: 'Só dígitos.' })
  telefone!: string | null;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({
    type: TipoDeAcessoResumidoDto,
    nullable: true,
    description: 'Nulo é "Sem acesso".',
  })
  tipoDeAcesso!: TipoDeAcessoResumidoDto | null;

  @ApiProperty()
  ativo!: boolean;

  @ApiProperty({ description: 'Centavos.' })
  custoMensalCentavos!: number;
}

export class ContadoresDaEquipeDto {
  @ApiProperty() todos!: number;
  @ApiProperty() professor!: number;
  @ApiProperty() recepcao!: number;
  @ApiProperty() nutricao!: number;
  @ApiProperty() limpeza!: number;
  @ApiProperty() manutencao!: number;
  @ApiProperty() administrativo!: number;
}

export class PaginaDeFuncionariosDto {
  @ApiProperty({ type: [FuncionarioDto] })
  itens!: FuncionarioDto[];

  @ApiProperty({ description: 'Funcionários que passam pelo filtro, em todas as páginas.' })
  total!: number;

  @ApiProperty()
  pagina!: number;

  @ApiProperty()
  limite!: number;

  @ApiProperty({
    type: ContadoresDaEquipeDto,
    description: 'Chips: respeitam a busca, não o cargo.',
  })
  contadores!: ContadoresDaEquipeDto;
}

export class FuncionarioCriadoDto {
  @ApiProperty({ type: FuncionarioDto })
  funcionario!: FuncionarioDto;

  @ApiProperty({
    description: 'Falso quando o e-mail já era de um funcionário (nada foi enviado).',
  })
  criado!: boolean;
}

export class ConviteEmLoteDto {
  @ApiProperty({ type: [FuncionarioCriadoDto] })
  itens!: FuncionarioCriadoDto[];
}

export class CustoDeFuncionarioDto {
  @ApiProperty({ format: 'uuid' })
  funcionarioId!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty({ enum: CHAVES_DOS_CARGOS })
  cargo!: string;

  @ApiProperty({ nullable: true })
  cargoDescricao!: string | null;

  @ApiProperty({ description: 'Centavos.' })
  custoMensalCentavos!: number;
}

export class CustoDaEquipeDto {
  @ApiProperty({ type: [CustoDeFuncionarioDto], description: 'Só funcionários ativos.' })
  itens!: CustoDeFuncionarioDto[];

  @ApiProperty({ description: 'Funcionários ativos.' })
  quantidade!: number;

  @ApiProperty({ description: 'Folha do mês, em centavos.' })
  totalCentavos!: number;

  @ApiProperty({ description: 'Custo médio por funcionário, em centavos (0 sem equipe).' })
  mediaCentavos!: number;
}

export class ProfissionalDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nome!: string;

  @ApiProperty({ enum: CHAVES_DOS_CARGOS })
  cargo!: string;

  @ApiProperty({ nullable: true })
  cargoDescricao!: string | null;
}
