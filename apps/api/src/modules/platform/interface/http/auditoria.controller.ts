import { BadRequestException, Controller, Get, Header, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermission } from '../../../autenticacao/interface/http/decoradores';
import { Auditoria, type FiltroDeAtividades } from '../../application/auditoria';
import { CursorInvalidoError } from '../../domain/atividade';
import { FUSO_PADRAO, Relogio } from '../../domain/relogio';
import {
  AtividadeDto,
  ConsultaDoLogDto,
  FiltroDoLogDto,
  PaginaDoLogDto,
} from './dto/auditoria.dto';

const BOM_UTF8 = String.fromCharCode(0xfeff);

function filtroDe(consulta: FiltroDoLogDto): FiltroDeAtividades {
  return {
    usuarioId: consulta.usuarioId,
    modulo: consulta.modulo,
    de: consulta.de ? new Date(consulta.de) : undefined,
    ate: consulta.ate ? new Date(consulta.ate) : undefined,
    tipo: consulta.tipo,
  };
}

/**
 * Log de atividades (tela Permissões, aba "Log de atividades"). Só o Administrador: o catálogo do
 * T12 não tem a ação `log`, então a rota exige `permissoes:ver`, que só o Administrador tem nos
 * tipos padrão.
 */
@ApiTags('auditoria')
@Controller('auditoria/atividades')
export class AuditoriaController {
  constructor(
    private readonly auditoria: Auditoria,
    private readonly relogio: Relogio,
  ) {}

  @Get()
  @RequirePermission('permissoes:ver')
  @ApiOperation({
    operationId: 'listarAtividades',
    summary: 'Log de atividades paginado por cursor, com os filtros de Log.html.',
  })
  @ApiOkResponse({ type: PaginaDoLogDto })
  @ApiBadRequestResponse({ description: 'Filtro ou cursor inválido.' })
  async listar(@Query() consulta: ConsultaDoLogDto): Promise<PaginaDoLogDto> {
    try {
      const pagina = await this.auditoria.consultar(filtroDe(consulta), {
        limite: consulta.limite === undefined ? undefined : Number(consulta.limite),
        cursor: consulta.cursor,
      });
      return {
        itens: pagina.itens.map((item): AtividadeDto => ({
          ...item,
          quando: item.quando.toISOString(),
        })),
        proximoCursor: pagina.proximoCursor,
      };
    } catch (erro) {
      if (erro instanceof CursorInvalidoError) {
        throw new BadRequestException(erro.message);
      }
      throw erro;
    }
  }

  @Get('exportar')
  @RequirePermission('permissoes:ver')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({
    operationId: 'exportarAtividades',
    summary: 'CSV do log com os mesmos filtros (Quando, Quem, Ação, Módulo, Sensível, Detalhe).',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'Arquivo CSV (UTF-8 com BOM, separador `;`).', type: String })
  @ApiBadRequestResponse({ description: 'Filtro inválido.' })
  async exportar(
    @Query() filtro: FiltroDoLogDto,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<string> {
    resposta.setHeader(
      'Content-Disposition',
      `attachment; filename="log-de-atividades-${this.relogio.hojeEm(FUSO_PADRAO)}.csv"`,
    );
    return BOM_UTF8 + (await this.auditoria.exportarCsv(filtroDe(filtro)));
  }
}
