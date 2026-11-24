import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import {
  CANAIS_META,
  ESTADOS_DA_CONEXAO,
  type CanalMeta,
  type EstadoDaConexao,
} from '../../domain/meta';

export class ConexaoMetaDto {
  @ApiProperty({ enum: CANAIS_META })
  canal!: CanalMeta;

  @ApiProperty({
    enum: ESTADOS_DA_CONEXAO,
    description: '"verificacao_pendente" mostra a ação "Concluir conexão".',
  })
  estado!: EstadoDaConexao;

  @ApiProperty({ nullable: true, type: String, example: 'Ritmo Academia' })
  contaNome!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  expiraEm!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  conectadoEm!: string | null;
}

export class IniciarConexaoDto {
  @ApiPropertyOptional({
    example: 'https://ritmo.gymos.app/configuracoes',
    description: 'Para onde a Meta devolve o usuário no fim do fluxo (padrão: o painel).',
  })
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  @MaxLength(500)
  redirecionarPara?: string;
}

export class InicioDaConexaoDto {
  @ApiProperty({ type: ConexaoMetaDto })
  conexao!: ConexaoMetaDto;

  @ApiProperty({ description: 'Endereço do fluxo oficial da Meta, para o usuário abrir.' })
  urlDoFluxo!: string;
}

export class RetornoDaMetaDto {
  @ApiProperty({ description: 'Código devolvido pela Meta no fim do fluxo.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  codigo!: string;

  @ApiProperty({ description: '`state` devolvido junto do código, sem alteração.' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  state!: string;
}

export class ArquivoEnviadoDto {
  @ApiProperty({ example: 'tenant/6b1f…/treinos/0c9d….png' })
  chave!: string;

  @ApiProperty({ example: 'image/png' })
  tipo!: string;

  @ApiProperty({ example: 20480 })
  tamanhoEmBytes!: number;
}

export class UrlAssinadaDto {
  @ApiProperty()
  url!: string;

  @ApiProperty({ format: 'date-time' })
  expiraEm!: string;
}

export class MensagemDeDevDto {
  @ApiProperty()
  idExterno!: string;

  @ApiProperty({ description: 'Telefone com DDI; só existe no adapter fake, nunca é gravado.' })
  telefone!: string;

  @ApiProperty()
  texto!: string;
}
