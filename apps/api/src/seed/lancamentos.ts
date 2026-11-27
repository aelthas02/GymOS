import { RepositorioDeLancamentos } from '../modules/financeiro/application/portas';
import type { NovoLancamento } from '../modules/financeiro/application/portas';
import type { DataCivil } from '../modules/platform/domain/relogio';
import type { ModuloDeSeed } from './modulo-de-seed';

/**
 * Despesas avulsas de outubro e novembro de 2026 (Financeiro.html: aluguel, contas e outros; a folha
 * vem do custo dos funcionários). Coerente com as regras: a folha não é lançamento. Idempotente: só
 * grava se o período do seed ainda não tem lançamento.
 */
export const LANCAMENTOS_DO_SEED: ReadonlyArray<Omit<NovoLancamento, 'unidadeId' | 'criadoPor'>> = [
  {
    tipo: 'despesa',
    categoria: 'aluguel',
    setor: null,
    valorCentavos: 120000,
    data: '2026-10-05' as DataCivil,
    descricao: 'Aluguel de outubro',
  },
  {
    tipo: 'despesa',
    categoria: 'contas',
    setor: null,
    valorCentavos: 58000,
    data: '2026-10-10' as DataCivil,
    descricao: 'Água, luz e internet',
  },
  {
    tipo: 'despesa',
    categoria: 'outros',
    setor: 'musculacao',
    valorCentavos: 36000,
    data: '2026-10-18' as DataCivil,
    descricao: 'Manutenção de equipamentos',
  },
  {
    tipo: 'despesa',
    categoria: 'aluguel',
    setor: null,
    valorCentavos: 120000,
    data: '2026-11-05' as DataCivil,
    descricao: 'Aluguel de novembro',
  },
  {
    tipo: 'despesa',
    categoria: 'contas',
    setor: null,
    valorCentavos: 60000,
    data: '2026-11-10' as DataCivil,
    descricao: 'Água, luz e internet',
  },
  {
    tipo: 'despesa',
    categoria: 'outros',
    setor: 'musculacao',
    valorCentavos: 40000,
    data: '2026-11-12' as DataCivil,
    descricao: 'Manutenção de equipamentos',
  },
];

export const seedDosLancamentos: ModuloDeSeed = {
  nome: 'lancamentos',
  dependeDe: ['plataforma'],
  async executar(app, contexto) {
    const lancamentos = app.get(RepositorioDeLancamentos);
    await contexto.noTenant(async () => {
      const existentes = await lancamentos.doPeriodo(
        '2026-10-01' as DataCivil,
        '2026-11-30' as DataCivil,
        {},
      );
      if (existentes.length > 0) {
        return;
      }
      const unidadeId = await lancamentos.unidadePadrao();
      for (const lancamento of LANCAMENTOS_DO_SEED) {
        await lancamentos.criar({ ...lancamento, unidadeId, criadoPor: null });
      }
    });
  },
};
