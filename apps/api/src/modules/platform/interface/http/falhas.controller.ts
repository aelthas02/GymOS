import { Controller, HttpCode, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { FalhaNaoEncontradaError, FilasBullMQ } from '../../infra/filas/filas.bullmq';
import { Publica } from './acesso-publico';
import { ChaveDeOperacaoGuard } from './interno.controller';

/**
 * Reprocessamento manual de um job da fila de falhas (DLQ), pela operação. Sem sessão de usuário,
 * como o InternoController: a proteção é a chave de operação.
 */
@ApiExcludeController()
@Publica()
@UseGuards(ChaveDeOperacaoGuard)
@Controller('interno/falhas')
export class FalhasController {
  constructor(private readonly filas: FilasBullMQ) {}

  @Post(':id/reprocessar')
  @HttpCode(204)
  async reprocessar(@Param('id') id: string): Promise<void> {
    try {
      await this.filas.reprocessarFalha(id);
    } catch (error) {
      if (error instanceof FalhaNaoEncontradaError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
