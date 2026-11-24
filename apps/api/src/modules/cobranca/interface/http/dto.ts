import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CANAIS,
  type Canal,
  FORMAS_DE_COBRANCA,
  FORMAS_DO_BALCAO,
  FORMAS_PREFERIDAS,
  type FormaDeCobranca,
  type FormaDoBalcao,
  type FormaPreferida,
  ORIGENS,
  type Origem,
  SETORES,
  type Setor,
  SITUACOES_DO_PAGAMENTO,
  type SituacaoDoPagamento,
} from '../../domain/pagamento';
import { SITUACOES_DA_PARCELA, type SituacaoDaParcela } from '../../domain/parcela';

const DIA = /^\d{4}-\d{2}-\d{2}$/;

export class ParcelaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  contratoId!: string;

  @ApiProperty({ example: 3 })
  numero!: number;

  @ApiProperty({ example: 9 })
  totalDeParcelas!: number;

  @ApiProperty({ example: 10533, description: 'Valor da parcela em centavos.' })
  valorCentavos!: number;

  @ApiProperty({ example: 0, description: 'Já pago, menos os estornos (centavos).' })
  pagoCentavos!: number;

  @ApiProperty({ example: 10533, description: 'Saldo a receber (centavos).' })
  saldoCentavos!: number;

  @ApiProperty({ example: '2026-11-13', format: 'date' })
  vencimento!: string;

  @ApiProperty({ example: '2026-11-13', format: 'date' })
  vencimentoOriginal!: string;

  @ApiProperty({ enum: SITUACOES_DA_PARCELA })
  situacao!: SituacaoDaParcela;

  @ApiProperty({ description: 'Pagou parte: a parcela continua a receber pelo saldo.' })
  pagoParcial!: boolean;

  @ApiProperty({ example: 6, description: 'diasDeAtraso (ADR-018); 0 se não está a receber.' })
  diasDeAtraso!: number;
}

export class PagamentoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parcelaId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  cobrancaId!: string | null;

  @ApiProperty({ example: 11900 })
  valorCentavos!: number;

  @ApiProperty({ example: 118, description: 'Taxa da transação (centavos).' })
  taxaCentavos!: number;

  @ApiProperty({ example: 0 })
  estornadoCentavos!: number;

  @ApiProperty({ example: 'pix' })
  forma!: string;

  @ApiProperty({ enum: CANAIS })
  canal!: Canal;

  @ApiProperty({ enum: ORIGENS })
  origem!: Origem;

  @ApiProperty({ enum: SETORES })
  setor!: Setor;

  @ApiProperty({ enum: SITUACOES_DO_PAGAMENTO })
  situacao!: SituacaoDoPagamento;

  @ApiProperty({ description: 'Pagamento de parcela já quitada, a estornar.' })
  emDuplicidade!: boolean;

  @ApiProperty({ format: 'date-time' })
  confirmadoEm!: string;
}

export class CobrancaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parcelaId!: string | null;

  @ApiProperty({ enum: FORMAS_DE_COBRANCA })
  forma!: FormaDeCobranca;

  @ApiProperty({ example: 11900 })
  valorCentavos!: number;

  @ApiProperty({ example: '2026-11-19', format: 'date' })
  vencimento!: string;

  @ApiProperty({ enum: ['pendente', 'paga', 'cancelada'] })
  situacao!: 'pendente' | 'paga' | 'cancelada';

  @ApiPropertyOptional({ description: 'PIX copia e cola.' })
  pixCopiaECola?: string;

  @ApiPropertyOptional({ description: 'Conteúdo do QR Code do PIX.' })
  pixQrCode?: string;

  @ApiPropertyOptional()
  linhaDigitavel?: string;

  @ApiPropertyOptional({ description: 'Página de pagamento (link, boleto ou cartão).' })
  url?: string;
}

export class EnviarCobrancaDto {
  @ApiPropertyOptional({ enum: FORMAS_DE_COBRANCA, default: 'link' })
  @IsOptional()
  @IsIn(FORMAS_DE_COBRANCA)
  forma?: FormaDeCobranca;
}

export class SegundaViaDto {
  @ApiProperty({ enum: FORMAS_DE_COBRANCA, example: 'pix' })
  @IsIn(FORMAS_DE_COBRANCA)
  forma!: FormaDeCobranca;

  @ApiPropertyOptional({ default: true, description: 'Envia ao aluno pela Mensageria.' })
  @IsOptional()
  @IsBoolean()
  enviar?: boolean;
}

export class SegundaViaDoAppDto {
  @ApiProperty({ enum: FORMAS_DE_COBRANCA, example: 'pix' })
  @IsIn(FORMAS_DE_COBRANCA)
  forma!: FormaDeCobranca;
}

export class NovaDataDto {
  @ApiProperty({ example: '2026-11-25', format: 'date' })
  @Matches(DIA, { message: 'vencimento: use o formato AAAA-MM-DD' })
  vencimento!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}

export class PagamentoNoBalcaoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  alunoId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Sem parcela, é pagamento avulso.' })
  @IsOptional()
  @IsUUID()
  parcelaId?: string;

  @ApiProperty({ example: 11900 })
  @IsInt()
  @Min(1)
  valorCentavos!: number;

  @ApiProperty({ enum: FORMAS_DO_BALCAO })
  @IsIn(FORMAS_DO_BALCAO)
  forma!: FormaDoBalcao;

  @ApiPropertyOptional({ example: 0, description: 'Taxa da maquininha (centavos).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  taxaCentavos?: number;

  @ApiPropertyOptional({ enum: ORIGENS, description: 'Obrigatória no pagamento avulso.' })
  @IsOptional()
  @IsIn(ORIGENS)
  origem?: Origem;
}

export class EstornoDto {
  @ApiPropertyOptional({ example: 5000, description: 'Sem valor, estorna tudo o que resta.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  valorCentavos?: number;

  @ApiProperty({ example: 'Pagamento em duplicidade', maxLength: 200 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  motivo!: string;
}

export class CobrancaEmLoteDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  alunoIds!: string[];
}

export class ResultadoDoLoteDto {
  @ApiProperty({ example: 12 })
  enviadas!: number;

  @ApiProperty({ type: [String], description: 'Alunos sem parcela vencida.' })
  semPendencia!: string[];
}

export class FormaDePagamentoDto {
  @ApiProperty({ enum: FORMAS_PREFERIDAS })
  @IsIn(FORMAS_PREFERIDAS)
  forma!: FormaPreferida;

  @ApiPropertyOptional({ description: 'Token do cartão gerado pelo SDK do provedor (só cartão).' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tokenDoCartao?: string;

  @ApiPropertyOptional({ example: '4242' })
  @IsOptional()
  @Matches(/^\d{4}$/)
  finalDoCartao?: string;
}

export class FormaDePagamentoDoAlunoDto {
  @ApiProperty({ enum: FORMAS_PREFERIDAS })
  forma!: FormaPreferida;

  @ApiProperty({ type: String, nullable: true, example: '4242' })
  finalDoCartao!: string | null;

  @ApiProperty({ format: 'date-time' })
  atualizadoEm!: string;
}

export class PendenciaDto {
  @ApiProperty({ enum: ['mensalidade_em_atraso', 'pagamento_em_duplicidade'] })
  tipo!: 'mensalidade_em_atraso' | 'pagamento_em_duplicidade';

  @ApiProperty({ example: 'Mensalidade em atraso' })
  titulo!: string;

  @ApiProperty({ format: 'uuid' })
  alunoId!: string;

  @ApiProperty({ example: 'Rafael Souza' })
  alunoNome!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parcelaId!: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  pagamentoId?: string;

  @ApiPropertyOptional({ format: 'date' })
  vencimento?: string;

  @ApiProperty({ example: 11900, description: 'Saldo em atraso ou valor em duplicidade.' })
  valorCentavos!: number;

  @ApiPropertyOptional({ example: 6 })
  diasDeAtraso?: number;
}
