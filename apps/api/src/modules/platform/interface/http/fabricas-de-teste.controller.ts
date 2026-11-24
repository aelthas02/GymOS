import { Body, Controller, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { FabricasDeTeste } from '../../application/fabricas-de-teste';
import { Publica } from './acesso-publico';
import { ChaveDeOperacaoGuard } from './interno.controller';

/**
 * API de teste do E2E (T35). Só existe em dev e teste (o módulo nem é carregado em produção) e
 * exige a chave de operação; o tenant vem do Host ou do x-tenant, como nas outras rotas.
 */
@ApiExcludeController()
@Publica()
@UseGuards(ChaveDeOperacaoGuard)
@Controller('teste/fabricas')
export class FabricasDeTesteController {
  constructor(private readonly fabricas: FabricasDeTeste) {}

  @Post(':nome')
  async criar(
    @Param('nome') nome: string,
    @Body() dados: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.fabricas.nomes().includes(nome)) {
      throw new NotFoundException(`Fábrica de teste "${nome}" não registrada.`);
    }
    return this.fabricas.criar(nome, dados ?? {});
  }
}
