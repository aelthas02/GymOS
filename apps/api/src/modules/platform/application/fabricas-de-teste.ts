import { Injectable } from '@nestjs/common';

/** Cria um registro de teste a partir do corpo recebido; devolve o que o E2E precisa saber dele. */
export type FabricaDeTeste = (dados: Record<string, unknown>) => Promise<unknown>;

/**
 * Registro das fábricas da API de teste (T35, só dev e teste). Cada domínio registra as suas na
 * inicialização do módulo (`registrar('aluno', ...)`); o E2E chama `POST /api/teste/fabricas/aluno`.
 * Roda no tenant da requisição, dentro da transação, como qualquer rota.
 */
@Injectable()
export class FabricasDeTeste {
  private readonly fabricas = new Map<string, FabricaDeTeste>();

  registrar(nome: string, fabrica: FabricaDeTeste): void {
    if (this.fabricas.has(nome)) {
      throw new Error(`Fábrica de teste "${nome}" já registrada.`);
    }
    this.fabricas.set(nome, fabrica);
  }

  nomes(): string[] {
    return [...this.fabricas.keys()].sort();
  }

  async criar(nome: string, dados: Record<string, unknown>): Promise<unknown> {
    const fabrica = this.fabricas.get(nome);
    if (!fabrica) {
      throw new Error(`Fábrica de teste "${nome}" não registrada.`);
    }
    return fabrica(dados);
  }
}
