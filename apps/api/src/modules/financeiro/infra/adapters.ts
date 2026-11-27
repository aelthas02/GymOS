import { Injectable } from '@nestjs/common';
import { Frequencia } from '../../acesso/application/frequencia';
import { Funcionarios } from '../../funcionarios/application/funcionarios';
import {
  type EquipeDoFinanceiro,
  EquipeParaOFinanceiro,
  OcupacaoDasAulas,
  type OcupacaoDeAula,
  PresencasParaORateio,
  type PresencasDoMesParaORateio,
} from '../application/portas';

/** Folha do Financeiro: o custo mensal dos funcionários ativos (T26a). */
@Injectable()
export class EquipeParaOFinanceiroAdapter extends EquipeParaOFinanceiro {
  constructor(private readonly funcionarios: Funcionarios) {
    super();
  }

  async equipe(): Promise<EquipeDoFinanceiro> {
    const { itens, totalCentavos } = await this.funcionarios.custoDaEquipe();
    return { itens, totalCentavos };
  }
}

/**
 * Presenças do rateio: os check-ins do mês vêm do Acesso (T23a); as presenças em aula virão do
 * módulo Aulas (T28) e, até lá, não existem (o rateio fica só com musculação).
 */
@Injectable()
export class PresencasParaORateioAdapter extends PresencasParaORateio {
  constructor(private readonly frequencia: Frequencia) {
    super();
  }

  async doMes(mes: string): Promise<PresencasDoMesParaORateio> {
    const { alunos } = await this.frequencia.presencasDoMes(mes);
    return {
      checkins: new Map(alunos.map(({ alunoId, presencas }) => [alunoId, presencas])),
      emAulas: new Map(),
    };
  }
}

/** Sem o módulo Aulas (T28), nenhuma aula: as visões de aulas e professores mostram o estado vazio. */
@Injectable()
export class OcupacaoDasAulasVazia extends OcupacaoDasAulas {
  async doPeriodo(): Promise<OcupacaoDeAula[]> {
    return [];
  }
}
