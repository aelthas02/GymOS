import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
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
} from 'class-validator';
import {
  CHAVES_DE_PERIODO,
  type ChaveDePeriodo,
  SETORES,
  type Setor,
} from '../../domain/financeiro';
import {
  CATEGORIAS_DE_LANCAMENTO,
  type CategoriaDeLancamento,
  TIPOS_DE_LANCAMENTO,
  type TipoDeLancamento,
} from '../../application/portas';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIAS_DO_FILTRO = [...CATEGORIAS_DE_LANCAMENTO, 'folha'] as const;
const TIPOS_DO_FILTRO = ['todos', 'receitas', 'despesas'] as const;
const FORMATOS = ['brl', 'inteiro', 'percentual', 'texto'] as const;
const TIPOS_DE_COLUNA = ['texto', 'brl', 'inteiro', 'percentual', 'situacao'] as const;
const SITUACOES_DA_LINHA = ['em_dia', 'em_atraso', 'a_vencer'] as const;
const VISOES = [
  'setores',
  'funcionarios',
  'alunos',
  'aulas',
  'planos',
  'formas-de-pagamento',
] as const;

// --- consultas -------------------------------------------------------------------------------

export class ConsultaDoFinanceiroDto {
  @ApiPropertyOptional({ enum: CHAVES_DE_PERIODO, default: 'este-mes' })
  @IsOptional()
  @IsIn(CHAVES_DE_PERIODO)
  periodo?: ChaveDePeriodo;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Início do período personalizado.' })
  @IsOptional()
  @Matches(DIA)
  de?: string;

  @ApiPropertyOptional({ example: '2026-11-30', description: 'Fim do período personalizado.' })
  @IsOptional()
  @Matches(DIA)
  ate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  planoId?: string;

  @ApiPropertyOptional({ example: 'Musculação' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  modalidade?: string;

  @ApiPropertyOptional({ example: 'pix', description: 'pix, cartao, boleto, dinheiro ou link.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  forma?: string;

  @ApiPropertyOptional({ enum: TIPOS_DO_FILTRO, default: 'todos' })
  @IsOptional()
  @IsIn(TIPOS_DO_FILTRO)
  tipo?: 'todos' | 'receitas' | 'despesas';

  @ApiPropertyOptional({ enum: CATEGORIAS_DO_FILTRO })
  @IsOptional()
  @IsIn(CATEGORIAS_DO_FILTRO)
  categoria?: CategoriaDeLancamento | 'folha';

  @ApiPropertyOptional({ default: true, description: 'Compara com o período anterior.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  comparar?: boolean;
}

export class ConsultaDaVisaoDto extends ConsultaDoFinanceiroDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;
}

export class ConsultaDosLancamentosDto {
  @ApiProperty({ example: '2026-11-01' })
  @Matches(DIA)
  de!: string;

  @ApiProperty({ example: '2026-11-30' })
  @Matches(DIA)
  ate!: string;
}

// --- respostas -------------------------------------------------------------------------------

class PeriodoAnteriorDto {
  @ApiProperty({ example: '2026-10-01' })
  de!: string;

  @ApiProperty({ example: '2026-10-31' })
  ate!: string;

  @ApiProperty({ example: 'Outubro 2026' })
  rotulo!: string;
}

export class PeriodoApuradoDto {
  @ApiProperty({ enum: CHAVES_DE_PERIODO })
  chave!: ChaveDePeriodo;

  @ApiProperty({ example: '2026-11-01' })
  de!: string;

  @ApiProperty({ example: '2026-11-30' })
  ate!: string;

  @ApiProperty({ example: 'Novembro 2026' })
  rotulo!: string;

  @ApiProperty({ type: PeriodoAnteriorDto })
  anterior!: PeriodoAnteriorDto;
}

class ReceitaLiquidaDto {
  @ApiProperty({ description: 'Bruta − taxas − despesas, em centavos.' })
  centavos!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Líquida do período anterior.' })
  anteriorCentavos!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Variação em pontos-base (482 = 4,82%).',
  })
  variacaoPontosBase!: number | null;
}

class InadimplenciaDto {
  @ApiProperty({ example: 12 })
  emAtraso!: number;

  @ApiProperty({ example: 312 })
  ativos!: number;

  @ApiProperty({ example: 385, description: 'Pontos-base: 385 = 3,85%.' })
  pontosBase!: number;
}

class PorFormaDto {
  @ApiProperty({ example: 'pix' })
  forma!: string;

  @ApiProperty()
  centavos!: number;

  @ApiProperty({ example: 54, description: 'Percentual inteiro; todos somam 100.' })
  percentual!: number;
}

class DespesaPorCategoriaDto {
  @ApiProperty({ example: 'folha' })
  categoria!: string;

  @ApiProperty({ example: 'Folha' })
  rotulo!: string;

  @ApiProperty()
  centavos!: number;
}

export class PontoDaSerieDto {
  @ApiProperty({ example: '2026-11' })
  mes!: string;

  @ApiProperty({ example: 'Nov' })
  rotulo!: string;

  @ApiProperty()
  brutaCentavos!: number;

  @ApiProperty()
  taxasCentavos!: number;

  @ApiProperty()
  despesasCentavos!: number;

  @ApiProperty()
  liquidaCentavos!: number;

  @ApiProperty()
  adesoesAtivas!: number;

  @ApiProperty()
  novasAdesoes!: number;
}

export class FinanceiroGeralDto {
  @ApiProperty({ type: PeriodoApuradoDto })
  periodo!: PeriodoApuradoDto;

  @ApiProperty({ type: ReceitaLiquidaDto })
  receitaLiquida!: ReceitaLiquidaDto;

  @ApiProperty()
  brutaCentavos!: number;

  @ApiProperty()
  taxasCentavos!: number;

  @ApiProperty()
  despesasCentavos!: number;

  @ApiProperty()
  adesoesAtivas!: number;

  @ApiProperty()
  novasAdesoes!: number;

  @ApiProperty()
  cancelamentos!: number;

  @ApiProperty({ type: InadimplenciaDto })
  inadimplencia!: InadimplenciaDto;

  @ApiProperty({ type: [PorFormaDto] })
  porForma!: PorFormaDto[];

  @ApiProperty({ type: [DespesaPorCategoriaDto] })
  despesasPorCategoria!: DespesaPorCategoriaDto[];

  @ApiProperty({ type: [PontoDaSerieDto], description: 'Últimos 6 meses até o fim do período.' })
  serieMensal!: PontoDaSerieDto[];
}

export class IndicadorDto {
  @ApiProperty({ example: 'Receita bruta' })
  rotulo!: string;

  @ApiProperty({ enum: FORMATOS })
  formato!: (typeof FORMATOS)[number];

  @ApiProperty({ description: 'Centavos, contagem ou pontos-base, conforme o formato.' })
  valor!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Valor em texto (formato `texto`).' })
  texto!: string | null;

  @ApiProperty({ example: 'Soma dos setores' })
  legenda!: string;

  @ApiProperty()
  positivo!: boolean;
}

export class ColunaDaTabelaDto {
  @ApiProperty({ example: 'receita' })
  chave!: string;

  @ApiProperty({ example: 'Receita bruta' })
  rotulo!: string;

  @ApiProperty({ enum: TIPOS_DE_COLUNA })
  tipo!: (typeof TIPOS_DE_COLUNA)[number];

  @ApiProperty({ type: String, nullable: true, description: 'Texto da célula nula.' })
  vazio!: string | null;
}

export class LinhaDaTabelaDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }], nullable: true },
    description: 'Valor por `chave` de coluna.',
  })
  celulas!: Record<string, string | number | null>;

  @ApiProperty({ enum: SITUACOES_DA_LINHA, nullable: true })
  situacao!: (typeof SITUACOES_DA_LINHA)[number] | null;

  @ApiProperty({ type: String, nullable: true, example: '/alunos/…' })
  link!: string | null;
}

class BarraDoGraficoDto {
  @ApiProperty({ example: 'Planos de musculação' })
  rotulo!: string;

  @ApiProperty()
  valorCentavos!: number;
}

class GraficoDaVisaoDto {
  @ApiProperty()
  titulo!: string;

  @ApiProperty()
  subtitulo!: string;

  @ApiProperty({ type: [BarraDoGraficoDto] })
  barras!: BarraDoGraficoDto[];
}

class TabelaDaVisaoDto {
  @ApiProperty()
  titulo!: string;

  @ApiProperty()
  subtitulo!: string;

  @ApiProperty({ type: [ColunaDaTabelaDto] })
  colunas!: ColunaDaTabelaDto[];

  @ApiProperty({ type: [LinhaDaTabelaDto] })
  linhas!: LinhaDaTabelaDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: String, nullable: true })
  proximoCursor!: string | null;
}

export class VisaoFinanceiraDto {
  @ApiProperty({ enum: VISOES })
  visao!: (typeof VISOES)[number];

  @ApiProperty({ type: PeriodoApuradoDto })
  periodo!: PeriodoApuradoDto;

  @ApiProperty({ type: [IndicadorDto] })
  indicadores!: IndicadorDto[];

  @ApiProperty({ type: GraficoDaVisaoDto })
  grafico!: GraficoDaVisaoDto;

  @ApiProperty({ type: TabelaDaVisaoDto })
  tabela!: TabelaDaVisaoDto;
}

class OpcaoDeFiltroDto {
  @ApiProperty()
  chave!: string;

  @ApiProperty()
  rotulo!: string;
}

class UnidadeOuPlanoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nome!: string;
}

export class OpcoesDosFiltrosDto {
  @ApiProperty({ type: [UnidadeOuPlanoDto] })
  unidades!: UnidadeOuPlanoDto[];

  @ApiProperty({ type: [UnidadeOuPlanoDto] })
  planos!: UnidadeOuPlanoDto[];

  @ApiProperty({ type: [String] })
  modalidades!: string[];

  @ApiProperty({ type: [OpcaoDeFiltroDto] })
  formas!: OpcaoDeFiltroDto[];

  @ApiProperty({ type: [OpcaoDeFiltroDto] })
  categorias!: OpcaoDeFiltroDto[];
}

// --- lançamentos -----------------------------------------------------------------------------

export class NovoLancamentoDto {
  @ApiProperty({ enum: TIPOS_DE_LANCAMENTO })
  @IsIn(TIPOS_DE_LANCAMENTO)
  tipo!: TipoDeLancamento;

  @ApiProperty({ enum: CATEGORIAS_DE_LANCAMENTO })
  @IsIn(CATEGORIAS_DE_LANCAMENTO)
  categoria!: CategoriaDeLancamento;

  @ApiPropertyOptional({
    enum: SETORES,
    nullable: true,
    description: 'Obrigatório na receita; a despesa sem setor é geral.',
  })
  @IsOptional()
  @IsIn(SETORES)
  setor?: Setor | null;

  @ApiProperty({ example: 120000, description: 'Em centavos; maior que zero.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  valorCentavos!: number;

  @ApiProperty({ example: '2026-11-05' })
  @Matches(DIA)
  data!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Padrão: a primeira unidade.' })
  @IsOptional()
  @IsUUID()
  unidadeId?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  descricao?: string | null;
}

export class LancamentoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: TIPOS_DE_LANCAMENTO })
  tipo!: TipoDeLancamento;

  @ApiProperty({ enum: CATEGORIAS_DE_LANCAMENTO })
  categoria!: CategoriaDeLancamento;

  @ApiProperty({ enum: SETORES, nullable: true })
  setor!: Setor | null;

  @ApiProperty()
  valorCentavos!: number;

  @ApiProperty({ example: '2026-11-05' })
  data!: string;

  @ApiProperty({ format: 'uuid' })
  unidadeId!: string;

  @ApiProperty({ type: String, nullable: true })
  descricao!: string | null;
}
