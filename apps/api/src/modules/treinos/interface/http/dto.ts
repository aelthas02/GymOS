import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DIVISOES,
  type Divisao,
  GRUPOS_MUSCULARES,
  NIVEIS,
  type Nivel,
  type OrigemDaFicha,
  ORIGENS_DA_FICHA,
  type SituacaoDaFicha,
  SITUACOES_GUARDADAS,
} from '../../domain/ficha';
import { LIMITE_MAXIMO_DAS_FICHAS, LIMITE_PADRAO_DAS_FICHAS } from '../../application/treinos';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const SITUACOES_DA_TELA = [...SITUACOES_GUARDADAS, 'vencida'] as const;

// ---------- Treinos e exercícios da ficha ----------

export class ExercicioDaFichaDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Exercício da biblioteca.',
  })
  @IsOptional()
  @IsUUID()
  exercicioId!: string | null;

  @ApiProperty({ example: 'Supino reto', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  series!: number;

  @ApiProperty({ example: 10, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  repeticoes!: number;

  @ApiProperty({ type: Number, nullable: true, example: 40, description: 'Nulo é peso do corpo.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  cargaKg!: number | null;

  @ApiProperty({ example: 60, minimum: 0, maximum: 600 })
  @IsInt()
  @Min(0)
  @Max(600)
  descansoSegundos!: number;

  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  videoUrl!: string | null;
}

export class TreinoDaFichaDto {
  @ApiProperty({ example: 'A', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  nome!: string;

  @ApiProperty({ example: 'Peito e tríceps', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  foco!: string;

  @ApiProperty({ type: [ExercicioDaFichaDto] })
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ExercicioDaFichaDto)
  exercicios!: ExercicioDaFichaDto[];
}

// ---------- Biblioteca ----------

export class DadosDoExercicioDto {
  @ApiProperty({ example: 'Supino reto', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ enum: GRUPOS_MUSCULARES, example: 'Peito' })
  @IsIn(GRUPOS_MUSCULARES)
  grupoMuscular!: string;

  @ApiProperty({ example: 'Barra', maxLength: 60 })
  @IsString()
  @MaxLength(60)
  equipamento!: string;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Link do YouTube.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  videoUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instrucoes?: string | null;
}

export class ExercicioDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  nome!: string;
  @ApiProperty({ enum: GRUPOS_MUSCULARES })
  grupoMuscular!: string;
  @ApiProperty()
  equipamento!: string;
  @ApiProperty({ type: String, nullable: true })
  videoUrl!: string | null;
  @ApiProperty({ type: String, nullable: true })
  instrucoes!: string | null;
}

export class ConsultaDeExerciciosDto {
  @ApiPropertyOptional({ enum: GRUPOS_MUSCULARES, description: 'Filtro por grupo muscular.' })
  @IsOptional()
  @IsIn(GRUPOS_MUSCULARES)
  grupo?: string;
}

// ---------- Modelos ----------

export class DadosDoModeloDto {
  @ApiProperty({ example: 'Hipertrofia A/B/C', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  nome!: string;

  @ApiProperty({ enum: DIVISOES })
  @IsIn(DIVISOES)
  divisao!: Divisao;

  @ApiProperty({ example: 5, minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  diasPorSemana!: number;

  @ApiProperty({ type: [TreinoDaFichaDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => TreinoDaFichaDto)
  treinos!: TreinoDaFichaDto[];
}

export class ModeloDto extends DadosDoModeloDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 18,
    description: 'Total de exercícios dos treinos (calculado pela API).',
  })
  totalDeExercicios!: number;
}

export class UsarModeloDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  alunoId!: string;
}

// ---------- Fichas ----------

export class DadosDaFichaDto {
  @ApiPropertyOptional({
    example: 'Hipertrofia A/B/C',
    maxLength: 80,
    description: 'Vazio: objetivo + divisão.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nome?: string;

  @ApiProperty({ example: 'Hipertrofia', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  objetivo!: string;

  @ApiProperty({ enum: NIVEIS })
  @IsIn(NIVEIS)
  nivel!: Nivel;

  @ApiProperty({ example: 4, minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  frequenciaSemanal!: number;

  @ApiProperty({ enum: DIVISOES })
  @IsIn(DIVISOES)
  divisao!: Divisao;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @Matches(DATA)
  validaAte?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  restricoes?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Professor responsável (funcionário).',
  })
  @IsOptional()
  @IsUUID()
  professorId?: string | null;

  @ApiProperty({ type: [TreinoDaFichaDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => TreinoDaFichaDto)
  treinos!: TreinoDaFichaDto[];
}

export class SalvarFichaDto extends DadosDaFichaDto {
  @ApiProperty({
    description: '`true`: "Salvar e enviar ao aluno" (aprova e ativa). `false`: salva rascunho.',
  })
  @IsBoolean()
  enviar!: boolean;
}

export class GerarFichaDto {
  @ApiProperty({ example: 'Hipertrofia', maxLength: 80 })
  @IsString()
  @MaxLength(80)
  objetivo!: string;

  @ApiProperty({ enum: NIVEIS })
  @IsIn(NIVEIS)
  nivel!: Nivel;

  @ApiProperty({ example: 4, minimum: 1, maximum: 7 })
  @IsInt()
  @Min(1)
  @Max(7)
  frequenciaSemanal!: number;

  @ApiProperty({ enum: DIVISOES })
  @IsIn(DIVISOES)
  divisao!: Divisao;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  restricoes?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  @IsOptional()
  @Matches(DATA)
  validaAte?: string | null;
}

export class FichaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  alunoId!: string;
  @ApiProperty()
  alunoNome!: string;
  @ApiProperty()
  nome!: string;
  @ApiProperty()
  objetivo!: string;
  @ApiProperty({ enum: NIVEIS })
  nivel!: Nivel;
  @ApiProperty()
  frequenciaSemanal!: number;
  @ApiProperty({ enum: DIVISOES })
  divisao!: Divisao;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  validaAte!: string | null;
  @ApiProperty({ type: String, nullable: true })
  restricoes!: string | null;
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  professorId!: string | null;
  @ApiProperty({ type: String, nullable: true })
  professorNome!: string | null;
  @ApiProperty({ enum: SITUACOES_DA_TELA })
  situacao!: SituacaoDaFicha;
  @ApiProperty({ enum: ORIGENS_DA_FICHA })
  origem!: OrigemDaFicha;
  @ApiProperty({ type: String, nullable: true, description: 'Quem aprovou (nome atual).' })
  aprovadaPor!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  aprovadaEm!: string | null;
  @ApiProperty({ type: [TreinoDaFichaDto] })
  treinos!: TreinoDaFichaDto[];
}

export class ConsultaDeFichasDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: LIMITE_MAXIMO_DAS_FICHAS,
    default: LIMITE_PADRAO_DAS_FICHAS,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO_DAS_FICHAS)
  limite?: number;
}

export class KpisDeFichasDto {
  @ApiProperty({ example: 310 })
  ativas!: number;
  @ApiProperty({ example: 2 })
  aguardandoAprovacao!: number;
  @ApiProperty({ example: 14 })
  vencemEm30Dias!: number;
  @ApiProperty({ example: 2 })
  semFicha!: number;
}

export class LinhaDeFichaDto {
  @ApiProperty({ format: 'uuid' })
  fichaId!: string;
  @ApiProperty({ format: 'uuid' })
  alunoId!: string;
  @ApiProperty()
  alunoNome!: string;
  @ApiProperty({ example: 'Hipertrofia A/B/C' })
  nome!: string;
  @ApiProperty({ type: String, nullable: true })
  professorNome!: string | null;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  validaAte!: string | null;
  @ApiProperty({ enum: SITUACOES_DA_TELA })
  situacao!: SituacaoDaFicha;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Dias para o chip "Vence em N dias" (até 31); nulo fora da janela.',
  })
  venceEmDias!: number | null;
}

export class FichaSugeridaDto {
  @ApiProperty({ format: 'uuid' })
  fichaId!: string;
  @ApiProperty({ format: 'uuid' })
  alunoId!: string;
  @ApiProperty()
  alunoNome!: string;
  @ApiProperty({ example: 'Força A/B, 4 dias, sem restrição' })
  resumo!: string;
}

export class PainelDeFichasDto {
  @ApiProperty({ type: KpisDeFichasDto })
  kpis!: KpisDeFichasDto;
  @ApiProperty({ type: [LinhaDeFichaDto] })
  itens!: LinhaDeFichaDto[];
  @ApiProperty({ description: 'Fichas que a tabela lista, em todas as páginas.' })
  total!: number;
  @ApiProperty()
  pagina!: number;
  @ApiProperty()
  limite!: number;
  @ApiProperty({ example: 312 })
  alunosComFicha!: number;
  @ApiProperty({ type: [FichaSugeridaDto] })
  sugeridas!: FichaSugeridaDto[];
}

export class AvisoDeVencimentoDto {
  @ApiProperty({ example: 14 })
  avisados!: number;
}

export class PendenciaDeFichaDto {
  @ApiProperty({ example: 'Ficha de treino para aprovar' })
  titulo!: string;
  @ApiProperty({ format: 'uuid' })
  fichaId!: string;
  @ApiProperty({ format: 'uuid' })
  alunoId!: string;
  @ApiProperty()
  alunoNome!: string;
  @ApiProperty()
  resumo!: string;
}

// ---------- Execução, evolução e acompanhamento ----------

export class RegistrarExecucaoDto {
  @ApiProperty({ example: 'Supino reto', maxLength: 120 })
  @IsString()
  @MaxLength(120)
  exercicio!: string;

  @ApiProperty({ type: Number, nullable: true, example: 40, description: 'Nulo é peso do corpo.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  cargaKg!: number | null;

  @ApiProperty({ minimum: 0, maximum: 10, example: 7 })
  @IsInt()
  @Min(0)
  @Max(10)
  esforco!: number;
}

export class ExecucaoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  exercicio!: string;
  @ApiProperty({ type: Number, nullable: true })
  cargaKg!: number | null;
  @ApiProperty()
  esforco!: number;
  @ApiProperty({ type: String, format: 'date-time' })
  realizadoEm!: string;
}

export class PontoDeCargaDto {
  @ApiProperty({ type: String, format: 'date' })
  dia!: string;
  @ApiProperty()
  cargaKg!: number;
}

export class EvolucaoDeCargaDto {
  @ApiProperty({ example: 'Supino reto' })
  exercicio!: string;
  @ApiProperty({ type: [PontoDeCargaDto] })
  pontos!: PontoDeCargaDto[];
  @ApiProperty({ example: 8 })
  variacaoKg!: number;
  @ApiProperty({ example: 6 })
  semanas!: number;
  @ApiProperty({ example: '+8 kg em 6 semanas' })
  texto!: string;
}

export class EsforcoDoDiaDto {
  @ApiProperty({ type: String, format: 'date' })
  dia!: string;
  @ApiProperty()
  esforco!: number;
}

export class ResumoDaFichaDto {
  @ApiProperty()
  nome!: string;
  @ApiProperty({ enum: SITUACOES_DA_TELA })
  situacao!: SituacaoDaFicha;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  validaAte!: string | null;
  @ApiProperty()
  exercicios!: number;
}

export class AcompanhamentoDeTreinoDto {
  @ApiProperty({ type: ResumoDaFichaDto, nullable: true })
  ficha!: ResumoDaFichaDto | null;
  @ApiProperty({ type: [EvolucaoDeCargaDto] })
  cargas!: EvolucaoDeCargaDto[];
  @ApiProperty({ type: Number, nullable: true })
  esforcoMedio!: number | null;
  @ApiProperty({ type: [EsforcoDoDiaDto] })
  esforcoPorTreino!: EsforcoDoDiaDto[];
}

export class FichaDoAppDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  nome!: string;
  @ApiProperty()
  objetivo!: string;
  @ApiProperty({ enum: NIVEIS })
  nivel!: Nivel;
  @ApiProperty()
  frequenciaSemanal!: number;
  @ApiProperty({ enum: DIVISOES })
  divisao!: Divisao;
  @ApiProperty({ type: String, format: 'date', nullable: true })
  validaAte!: string | null;
  @ApiProperty({ type: [TreinoDaFichaDto] })
  treinos!: TreinoDaFichaDto[];
}
