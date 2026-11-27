import { Module, type OnModuleInit } from '@nestjs/common';
import { AcessoModule } from '../acesso/acesso.module';
import { RegistroDeAtividade } from '../alunos/application/autoria';
import { CobrancaModule } from '../cobranca/cobranca.module';
import { FuncionariosModule } from '../funcionarios/funcionarios.module';
import { CacheComTenant } from '../platform/application/eventos';
import { Financeiro } from './application/financeiro';
import { Lancamentos } from './application/lancamentos';
import {
  EquipeParaOFinanceiro,
  LeituraFinanceira,
  OcupacaoDasAulas,
  PresencasParaORateio,
  RepositorioDeLancamentos,
} from './application/portas';
import {
  EquipeParaOFinanceiroAdapter,
  OcupacaoDasAulasVazia,
  PresencasParaORateioAdapter,
} from './infra/adapters';
import {
  LeituraFinanceiraPrisma,
  RepositorioDeLancamentosPrisma,
} from './infra/repositorios.prisma';
import { FinanceiroController } from './interface/http/financeiro.controller';

/**
 * Financeiro (T21, ADR-020): visão geral, visões do 'Visualizar por' e lançamentos. Lê pagamentos e
 * parcelas (cobrança), contratos (alunos), presenças (acesso) e o custo da equipe (funcionários); o
 * rateio da receita é calculado na consulta. O resultado vai ao cache do tenant, invalidado por
 * PagamentoConfirmado, PagamentoEstornado, AcessoRegistrado e pelo cadastro de lançamento.
 */
@Module({
  imports: [CobrancaModule, FuncionariosModule, AcessoModule],
  controllers: [FinanceiroController],
  providers: [
    { provide: RepositorioDeLancamentos, useClass: RepositorioDeLancamentosPrisma },
    { provide: LeituraFinanceira, useClass: LeituraFinanceiraPrisma },
    { provide: EquipeParaOFinanceiro, useClass: EquipeParaOFinanceiroAdapter },
    { provide: PresencasParaORateio, useClass: PresencasParaORateioAdapter },
    // O módulo Aulas (T28) troca este adapter pelo que lê a ocupação e as presenças das aulas.
    { provide: OcupacaoDasAulas, useClass: OcupacaoDasAulasVazia },
    RegistroDeAtividade,
    Financeiro,
    Lancamentos,
  ],
  exports: [Financeiro, Lancamentos],
})
export class FinanceiroModule implements OnModuleInit {
  constructor(private readonly cache: CacheComTenant) {}

  onModuleInit(): void {
    // Cada evento troca a geração do cache do tenant do evento; as chaves antigas expiram sozinhas.
    const consumidores = {
      PagamentoConfirmado: 'financeiro.cache-pagamento-confirmado',
      PagamentoEstornado: 'financeiro.cache-pagamento-estornado',
      AcessoRegistrado: 'financeiro.cache-acesso-registrado',
    } as const;
    for (const [evento, nome] of Object.entries(consumidores) as Array<
      [keyof typeof consumidores, string]
    >) {
      this.cache.invalidarAoReceber(evento, nome, () => [['financeiro-geracao']]);
    }
  }
}
