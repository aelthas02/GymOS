import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  SITUACOES_DA_NOTA,
  type SituacaoDaNota,
  TIPOS_DE_NOTA,
  type TipoDeNota,
} from '../../domain/nota-fiscal';

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const CANAIS = ['email', 'whatsapp'] as const;
export const ACOES_DA_LINHA = ['ver', 'emitir', 'corrigir'] as const;
const SITUACOES_DO_CERTIFICADO = ['ausente', 'valido', 'vence_em_breve', 'vencido'] as const;

export class NotaFiscalDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: TIPOS_DE_NOTA })
  tipo!: TipoDeNota;

  @ApiProperty({ example: 'NFS-e' })
  tipoExibido!: string;

  @ApiProperty({ enum: SITUACOES_DA_NOTA })
  situacao!: SituacaoDaNota;

  @ApiProperty({ type: String, nullable: true, example: '1287' })
  numero!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '1.287',
    description: '"1.287" na NFS-e e "NFC 0412" na NFC-e.',
  })
  rotulo!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  alunoId!: string | null;

  @ApiProperty({ example: 'Paulo Reis' })
  cliente!: string;

  @ApiProperty({ example: 'Mensalidade de novembro, plano Mensal' })
  descricao!: string;

  @ApiProperty({ example: '06.04 - Academia e ginástica' })
  codigoDoServico!: string;

  @ApiProperty({ example: '2026-11' })
  competencia!: string;

  @ApiProperty({ example: '11/2026' })
  competenciaExibida!: string;

  @ApiProperty({ example: 11900 })
  valorCentavos!: number;

  @ApiProperty({ example: 250 })
  aliquotaIssPontosBase!: number;

  @ApiProperty({ example: 298 })
  issCentavos!: number;

  @ApiProperty({ example: 0 })
  retencoesCentavos!: number;

  @ApiProperty({ example: 11900, description: 'Valor menos as retenções.' })
  totalCentavos!: number;

  @ApiProperty({ type: String, nullable: true, example: 'pix' })
  formaDePagamento!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'CPF não encontrado na Receita Federal' })
  motivoDaRejeicao!: string | null;

  @ApiProperty({ type: String, nullable: true })
  motivoDoCancelamento!: string | null;

  @ApiProperty({
    example: '2026-11-10T13:00:00.000Z',
    description: 'Data da nota: a emissão ou, antes dela, a criação.',
  })
  data!: string;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  emitidaEm!: string | null;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  canceladaEm!: string | null;

  @ApiProperty()
  temPdf!: boolean;

  @ApiProperty()
  temXml!: boolean;

  @ApiProperty()
  registradaNaFicha!: boolean;

  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  enviadaAoAlunoEm!: string | null;

  @ApiProperty({
    enum: ACOES_DA_LINHA,
    description: 'Botão da linha: Ver, Emitir (pendente) ou Corrigir (rejeitada).',
  })
  acao!: (typeof ACOES_DA_LINHA)[number];

  @ApiProperty({
    example: 'CPF não encontrado na Receita Federal',
    description: 'Texto de "Precisa de atenção".',
  })
  atencao!: string;
}

export class NotaFiscalDetalheDto extends NotaFiscalDto {
  @ApiProperty({ type: String, nullable: true, example: '123.456.789-09' })
  cpf!: string | null;
}

export class PaginaDeNotasDto {
  @ApiProperty({ type: [NotaFiscalDto] })
  itens!: NotaFiscalDto[];

  @ApiProperty({ type: String, nullable: true })
  proximoCursor!: string | null;
}

export class EmitidasPorTipoDto {
  @ApiProperty({ example: 212 })
  nfse!: number;

  @ApiProperty({ example: 100 })
  nfce!: number;
}

export class ResumoDasNotasDto {
  @ApiProperty({ example: '2026-11' })
  competencia!: string;

  @ApiProperty({ example: 'Novembro 2026' })
  competenciaPorExtenso!: string;

  @ApiProperty({ example: 312 })
  emitidas!: number;

  @ApiProperty({ example: 5490000 })
  valorFaturadoCentavos!: number;

  @ApiProperty({ example: 4, description: 'Pendentes e em processamento.' })
  pendentes!: number;

  @ApiProperty({ example: 2 })
  rejeitadas!: number;

  @ApiProperty({ type: EmitidasPorTipoDto })
  emitidasPorTipo!: EmitidasPorTipoDto;
}

export class ConsultaDeNotasDto {
  @ApiPropertyOptional({ example: '2026-11', description: 'Padrão: o mês atual (São Paulo).' })
  @IsOptional()
  @Matches(COMPETENCIA)
  competencia?: string;

  @ApiPropertyOptional({ enum: SITUACOES_DA_NOTA })
  @IsOptional()
  @IsIn(SITUACOES_DA_NOTA)
  situacao?: SituacaoDaNota;

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
  @MaxLength(200)
  cursor?: string;
}

export class CompetenciaDto {
  @ApiPropertyOptional({ example: '2026-11', description: 'Padrão: o mês atual (São Paulo).' })
  @IsOptional()
  @Matches(COMPETENCIA)
  competencia?: string;
}

export class ConsultaDaPreviaDto {
  @ApiProperty({ example: 11900 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  valorCentavos!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  retencoesCentavos?: number;
}

export class PreviaDaNotaDto {
  @ApiProperty({ example: 11900 })
  valorCentavos!: number;

  @ApiProperty({ example: 250 })
  aliquotaIssPontosBase!: number;

  @ApiProperty({ example: 298 })
  issCentavos!: number;

  @ApiProperty({ example: 0 })
  retencoesCentavos!: number;

  @ApiProperty({ example: 11900 })
  totalCentavos!: number;

  @ApiProperty({ example: '06.04 - Academia e ginástica' })
  codigoDoServico!: string;

  @ApiProperty({ description: '"Dados fiscais da academia conferidos".' })
  dadosFiscaisConferidos!: boolean;
}

export class ConsultaDaSugestaoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  alunoId!: string;

  @ApiProperty({ enum: TIPOS_DE_NOTA })
  @IsIn(TIPOS_DE_NOTA)
  tipo!: TipoDeNota;
}

export class ClienteDaSugestaoDto {
  @ApiProperty({ format: 'uuid' })
  alunoId!: string;

  @ApiProperty({ example: 'Juliana Prado' })
  nome!: string;

  @ApiProperty({ example: '123.456.789-09' })
  cpf!: string;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '(11) 98888-1122' })
  telefone!: string | null;
}

export class ServicoDaSugestaoDto {
  @ApiProperty({ example: 'Mensalidade de novembro, plano Mensal' })
  descricao!: string;

  @ApiProperty({ example: '06.04 - Academia e ginástica' })
  codigoDoServico!: string;

  @ApiProperty({ example: 11900 })
  valorCentavos!: number;

  @ApiProperty({ example: '2026-11' })
  competencia!: string;

  @ApiProperty({ example: '11/2026' })
  competenciaExibida!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  parcelaId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'PIX' })
  formaDePagamento!: string | null;
}

export class SugestaoDeNotaDto {
  @ApiProperty({ type: ClienteDaSugestaoDto })
  cliente!: ClienteDaSugestaoDto;

  @ApiProperty({ type: ServicoDaSugestaoDto })
  servico!: ServicoDaSugestaoDto;

  @ApiProperty({ example: '2026-11-19', format: 'date' })
  dataDeEmissao!: string;

  @ApiProperty({ type: PreviaDaNotaDto })
  resumo!: PreviaDaNotaDto;
}

export class EmitirNotaDto {
  @ApiProperty({ enum: TIPOS_DE_NOTA })
  @IsIn(TIPOS_DE_NOTA)
  tipo!: TipoDeNota;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  alunoId!: string;

  @ApiPropertyOptional({ example: '123.456.789-09', description: 'Sem ele, o CPF do cadastro.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string;

  @ApiProperty({ example: 'Mensalidade de novembro, plano Mensal' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  descricao!: string;

  @ApiProperty({ example: 11900 })
  @IsInt()
  @Min(1)
  valorCentavos!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  retencoesCentavos?: number;

  @ApiProperty({ example: '2026-11' })
  @Matches(COMPETENCIA)
  competencia!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Mensalidade em aberto que a nota cobre.' })
  @IsOptional()
  @IsUUID()
  parcelaId?: string;

  @ApiPropertyOptional({ example: 'pix' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  formaDePagamento?: string;

  @ApiProperty({ description: 'Enviar ao aluno por e-mail e WhatsApp.' })
  @IsBoolean()
  enviarAoAluno!: boolean;

  @ApiProperty({ description: 'Anexar PDF e XML (links) junto com a mensagem.' })
  @IsBoolean()
  anexarArquivos!: boolean;

  @ApiProperty({ description: 'Registrar na ficha do aluno.' })
  @IsBoolean()
  registrarNaFicha!: boolean;
}

export class CorrecaoDaNotaDto {
  @ApiPropertyOptional({ example: '123.456.789-09' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  descricao?: string;

  @ApiPropertyOptional({ example: 11900 })
  @IsOptional()
  @IsInt()
  @Min(1)
  valorCentavos?: number;
}

export class CancelamentoDaNotaDto {
  @ApiProperty({ example: 'Emitida em duplicidade' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  motivo!: string;
}

export class EnvioDaNotaDto {
  @ApiPropertyOptional({ enum: CANAIS, isArray: true, default: ['email', 'whatsapp'] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsIn(CANAIS, { each: true })
  canais?: Array<(typeof CANAIS)[number]>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  anexarArquivos?: boolean;
}

export class ResultadoDoEnvioDto {
  @ApiProperty({ enum: CANAIS, isArray: true })
  enviadaPor!: Array<(typeof CANAIS)[number]>;
}

export class ArquivoDaNotaDto {
  @ApiProperty({ description: 'URL assinada de leitura (5 minutos).' })
  url!: string;

  @ApiProperty({ format: 'date-time' })
  expiraEm!: string;
}

// ---------- Dados fiscais da academia ----------

export class CertificadoDto {
  @ApiProperty({ type: String, nullable: true, format: 'date', example: '2027-08-14' })
  validade!: string | null;

  @ApiProperty({ enum: SITUACOES_DO_CERTIFICADO })
  situacao!: (typeof SITUACOES_DO_CERTIFICADO)[number];
}

export class EmissorDto {
  @ApiProperty({ example: 'fiscal-fake' })
  provedor!: string;

  @ApiProperty()
  conectado!: boolean;
}

export class SalvarDadosFiscaisDto {
  @ApiProperty({ example: 'Academia Ritmo Ltda' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  razaoSocial!: string;

  @ApiProperty({ example: '12.345.678/0001-95' })
  @IsString()
  @MaxLength(20)
  cnpj!: string;

  @ApiProperty({ example: 'Simples Nacional' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  regime!: string;

  @ApiProperty({ example: 'São Paulo - SP' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  municipio!: string;

  @ApiProperty({ example: '06.04 - Academia e ginástica' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  codigoDoServico!: string;

  @ApiProperty({ example: 250, description: 'Alíquota do ISS em pontos-base (2,5% = 250).' })
  @IsInt()
  @Min(0)
  @Max(10_000)
  aliquotaIssPontosBase!: number;

  @ApiProperty({ description: 'Mensalidades (NFS-e): ao confirmar o pagamento.' })
  @IsBoolean()
  emitirNfseAoConfirmar!: boolean;

  @ApiProperty({ description: 'Vendas da Loja (NFC-e): no momento da venda.' })
  @IsBoolean()
  emitirNfceNaVenda!: boolean;

  @ApiProperty({ description: 'Enviar nota ao aluno por e-mail e WhatsApp.' })
  @IsBoolean()
  enviarAoAluno!: boolean;

  @ApiProperty({ description: 'Emitir em lote no fim do mês (22:00 do último dia, NFS-e).' })
  @IsBoolean()
  emitirEmLote!: boolean;
}

export class DadosFiscaisDto extends SalvarDadosFiscaisDto {
  @ApiProperty({ type: CertificadoDto })
  certificado!: CertificadoDto;

  @ApiProperty({ type: EmissorDto })
  emissor!: EmissorDto;

  @ApiProperty({ description: 'Falso enquanto a academia não salvou os dados.' })
  preenchido!: boolean;
}

export class CertificadoA1Dto {
  @ApiProperty({ description: 'Arquivo .pfx em base64; vai ao emissor e não fica guardado aqui.' })
  @IsString()
  @MinLength(4)
  @MaxLength(200_000)
  arquivoBase64!: string;

  @ApiProperty({ description: 'Senha do certificado; não fica guardada.' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  senha!: string;
}
