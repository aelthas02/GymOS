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
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  METODOS_DO_DISPOSITIVO,
  TIPOS_DE_BIOMETRIA,
  TIPOS_DE_DISPOSITIVO,
  type MetodoDoDispositivo,
  type TipoDeBiometria,
  type TipoDeDispositivo,
} from '../../domain/dispositivo';

// ---------- Painel: dispositivos ----------

export class DispositivoEntradaDto {
  @ApiProperty({ maxLength: 80, example: 'Catraca 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nome!: string;

  @ApiProperty({ enum: TIPOS_DE_DISPOSITIVO })
  @IsIn(TIPOS_DE_DISPOSITIVO)
  tipo!: TipoDeDispositivo;

  @ApiProperty({ maxLength: 80, example: 'Entrada principal' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  local!: string;

  @ApiProperty({ enum: METODOS_DO_DISPOSITIVO, isArray: true, minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(METODOS_DO_DISPOSITIVO, { each: true })
  metodos!: MetodoDoDispositivo[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID('4')
  unidadeId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    type: String,
    description: 'Agente local que controla o equipamento; sem ele, o agente o adota no batimento.',
  })
  @IsOptional()
  @IsUUID('4')
  agenteId?: string | null;
}

export class DispositivoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ enum: TIPOS_DE_DISPOSITIVO }) tipo!: string;
  @ApiProperty() local!: string;
  @ApiProperty({ enum: METODOS_DO_DISPOSITIVO, isArray: true }) metodos!: string[];
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) unidadeId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) agenteId!: string | null;
  @ApiProperty({ description: 'Online pelo último batimento: offline após 90 s sem sinal.' })
  online!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  ultimoBatimentoEm!: string | null;
}

export class ListaDeDispositivosDto {
  @ApiProperty({ type: [DispositivoDto] }) itens!: DispositivoDto[];
}

export class AlertaDeDispositivoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) dispositivoId!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ type: String, format: 'date-time', description: 'Último sinal antes de cair.' })
  desde!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) voltouEm!: string | null;
  @ApiProperty({ description: 'Queda ainda em aberto.' }) aberto!: boolean;
  @ApiProperty({ nullable: true, type: Number }) duracaoEmSegundos!: number | null;
  @ApiProperty({ example: 'Catraca 2 ficou 4 minutos sem resposta às 07:12 e já voltou' })
  texto!: string;
}

export class ListaDeAlertasDeDispositivoDto {
  @ApiProperty({ type: [AlertaDeDispositivoDto] }) itens!: AlertaDeDispositivoDto[];
}

// ---------- Painel: agente e pareamento ----------

export class CodigoDePareamentoDto {
  @ApiProperty({ example: '4F792K' }) codigo!: string;
  @ApiProperty({ example: '4F7-92K', description: 'Como o Passo 4 mostra.' })
  codigoFormatado!: string;
  @ApiProperty({ type: String, format: 'date-time', description: 'Vale 30 minutos e uma troca.' })
  expiraEm!: string;
}

export class AgenteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty() online!: boolean;
  @ApiProperty({ nullable: true, type: String }) versaoDoAgente!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  ultimoBatimentoEm!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  ultimaSincronizacaoEm!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) revogadoEm!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) pareadoEm!: string;
}

export class ListaDeAgentesDto {
  @ApiProperty({ type: [AgenteDto] }) itens!: AgenteDto[];
}

export class TesteDeConexaoDto {
  @ApiProperty({ format: 'uuid', description: 'Consulte o resultado por este id.' })
  comandoId!: string;
}

export class ResultadoDoTesteDto {
  @ApiProperty({ enum: ['aguardando', 'ok', 'falhou', 'expirou'] }) estado!: string;
  @ApiPropertyOptional({ type: Number }) latenciaEmMs?: number;
  @ApiPropertyOptional({ nullable: true, type: String }) motivo?: string | null;
}

// ---------- Painel: cadastro biométrico ----------

export class CadastroBiometricoEntradaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  alunoId!: string;

  @ApiProperty({ enum: TIPOS_DE_BIOMETRIA })
  @IsIn(TIPOS_DE_BIOMETRIA)
  tipo!: TipoDeBiometria;

  @ApiProperty({ format: 'uuid', description: 'Equipamento em que o aluno será cadastrado.' })
  @IsUUID('4')
  dispositivoId!: string;
}

export class CadastroBiometricoDto {
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty({ enum: TIPOS_DE_BIOMETRIA }) tipo!: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) dispositivoId!: string | null;
  @ApiProperty({ enum: ['pendente', 'cadastrado', 'falhou'] }) status!: string;
  @ApiProperty({ type: String, format: 'date-time' }) atualizadoEm!: string;
}

export class ListaDeCadastrosBiometricosDto {
  @ApiProperty({ type: [CadastroBiometricoDto] }) itens!: CadastroBiometricoDto[];
}

// ---------- Agente ----------

export class TrocaDeCodigoDto {
  @ApiProperty({ example: '4F7-92K', description: 'Aceita minúsculas, espaço e hífen.' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  codigo!: string;

  @ApiPropertyOptional({ maxLength: 80, example: 'PC da recepção' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nome?: string;

  @ApiPropertyOptional({ maxLength: 40, example: '1.0.0' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  versao?: string;
}

export class CredencialDoAgenteDto {
  @ApiProperty({ format: 'uuid', required: false }) agenteId?: string;
  @ApiProperty({ description: 'Mostrada uma vez: guarde de forma protegida pelo sistema.' })
  credencial!: string;
}

export class DispositivoVistoDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id!: string;

  @ApiProperty()
  @IsBoolean()
  online!: boolean;
}

export class BatimentoDto {
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  versao?: string;

  @ApiPropertyOptional({
    type: [DispositivoVistoDto],
    description: 'Sem a lista, todos os dispositivos do agente contam como vivos.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DispositivoVistoDto)
  dispositivos?: DispositivoVistoDto[];
}

export class ComandoParaOAgenteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['ping', 'cadastrar_biometria', 'remover_biometria'] }) tipo!: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) dispositivoId!: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) dados!: Record<string, unknown>;
}

export class ResultadoDoBatimentoDto {
  @ApiProperty({ type: String, format: 'date-time' }) recebidoEm!: string;
  @ApiProperty({
    description: 'Versão atual do cache de autorização: maior que a do agente, sincronize.',
  })
  versaoDoCache!: number;
  @ApiProperty({ type: [ComandoParaOAgenteDto] }) comandos!: ComandoParaOAgenteDto[];
}

export class RespostaDeComandoDto {
  @ApiProperty()
  @IsBoolean()
  ok!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  erro?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    maxLength: 200,
    description: 'Referência do cadastro no equipamento; nunca o template biométrico.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  referencia?: string | null;
}

export class ConsultaDoCacheDto {
  @ApiPropertyOptional({
    minimum: 0,
    description: 'Versão que o agente já tem; sem ela (ou 0) é a carga completa.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  desde?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limite?: number;
}

export class AlunoAutorizadoDto {
  @ApiProperty({ format: 'uuid' }) alunoId!: string;
  @ApiProperty({ description: 'O aluno deixou de existir: apague-o do cache.' }) removido!: boolean;
  @ApiProperty({ nullable: true, type: String }) nome!: string | null;
  @ApiProperty({
    enum: ['ativo', 'tolerancia', 'encerrado', 'trancado'],
    nullable: true,
    type: String,
  })
  contrato!: string | null;
  @ApiProperty() diasDeAtraso!: number;
  @ApiProperty({ nullable: true, type: String }) planoNome!: string | null;
  @ApiProperty({ type: [String] }) modalidadesDoPlano!: readonly string[];
  @ApiProperty({ nullable: true, type: Number }) acessosPorSemana!: number | null;
  @ApiProperty({
    type: 'object',
    properties: {
      resultado: { type: 'string', enum: ['liberado', 'tolerancia', 'negado'] },
      motivo: { type: 'string', nullable: true },
    },
    description: 'Decisão pelas regras de contrato e atraso; "negado" é o aluno bloqueado.',
  })
  situacao!: { resultado: string; motivo: string | null };
}

export class RegrasParaOAgenteDto {
  @ApiProperty({ nullable: true, type: Number }) bloqueioPorAtrasoDias!: number | null;
  @ApiProperty({ example: '05:00' }) abertura!: string;
  @ApiProperty({ example: '23:00' }) fechamento!: string;
  @ApiProperty({ nullable: true, type: Number }) limitePorDia!: number | null;
  @ApiProperty() antiPassback!: boolean;
}

export class PaginaDoCacheDto {
  @ApiProperty({ description: 'Guarde e envie como `desde` na próxima chamada.' }) versao!: number;
  @ApiProperty({ description: 'Há mais alunos além deste lote: chame de novo com a `versao`.' })
  maisPaginas!: boolean;
  @ApiProperty({ type: RegrasParaOAgenteDto }) regras!: RegrasParaOAgenteDto;
  @ApiProperty({ type: [AlunoAutorizadoDto] }) alunos!: AlunoAutorizadoDto[];
}

export class DispositivoDoAgenteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nome!: string;
  @ApiProperty({ enum: TIPOS_DE_DISPOSITIVO }) tipo!: string;
  @ApiProperty() local!: string;
  @ApiProperty({ enum: METODOS_DO_DISPOSITIVO, isArray: true }) metodos!: string[];
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) unidadeId!: string | null;
}

export class ListaDeDispositivosDoAgenteDto {
  @ApiProperty({ type: [DispositivoDoAgenteDto] }) itens!: DispositivoDoAgenteDto[];
}
