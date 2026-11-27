import { computed, inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { forkJoin, type Observable } from 'rxjs';
import {
  type ChaveDePeriodo,
  type EstadoDaTela,
  FILTROS_PADRAO,
  type FiltrosDoFinanceiro,
  type FinanceiroGeral,
  type Lancamento,
  type NovoLancamento,
  type OpcoesDosFiltros,
} from '../models/financeiro';
import { consultaDosFiltros } from '../utils/financeiro';

/** Store de `/financeiro` (visão geral): filtros em rascunho, filtros aplicados e os números do período. */
@Injectable()
export class FinanceiroGeralStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('carregando');
  readonly geral = signal<FinanceiroGeral | null>(null);
  readonly opcoes = signal<OpcoesDosFiltros | null>(null);
  /** O que o usuário está editando; só vale depois de "Aplicar filtros". */
  readonly rascunho = signal<FiltrosDoFinanceiro>(FILTROS_PADRAO);
  readonly aplicados = signal<FiltrosDoFinanceiro>(FILTROS_PADRAO);

  readonly periodoPersonalizadoValido = computed(() => {
    const { periodo, de, ate } = this.rascunho();
    return periodo !== 'personalizado' || (Boolean(de) && Boolean(ate) && de <= ate);
  });

  carregar(): void {
    this.estado.set('carregando');
    forkJoin({
      geral: this.api.get('/api/financeiro/geral', {
        consulta: consultaDosFiltros(this.aplicados()) as never,
      }),
      opcoes: this.api.get('/api/financeiro/filtros'),
    }).subscribe({
      next: ({ geral, opcoes }) => {
        this.geral.set(geral);
        this.opcoes.set(opcoes);
        this.preencherUnidadeUnica(opcoes);
        this.estado.set('pronto');
      },
      error: () => this.estado.set('erro'),
    });
  }

  /** Academia de uma unidade só: o filtro já mostra a unidade (sem opção "Todas"). */
  private preencherUnidadeUnica(opcoes: OpcoesDosFiltros): void {
    const [unica] = opcoes.unidades;
    if (opcoes.unidades.length === 1 && unica && !this.rascunho().unidadeId) {
      this.rascunho.update((atual) => ({ ...atual, unidadeId: unica.id }));
    }
  }

  alterar(campos: Partial<FiltrosDoFinanceiro>): void {
    this.rascunho.update((atual) => ({ ...atual, ...campos }));
  }

  /** Os chips de período valem na hora; os demais filtros esperam "Aplicar filtros". */
  escolherPeriodo(periodo: ChaveDePeriodo): void {
    this.alterar({ periodo });
    if (periodo !== 'personalizado') {
      this.aplicar();
    }
  }

  aplicar(): void {
    if (!this.periodoPersonalizadoValido()) {
      return;
    }
    this.aplicados.set(this.rascunho());
    this.carregar();
  }

  limpar(): void {
    this.rascunho.set(FILTROS_PADRAO);
    this.aplicar();
  }

  registrarLancamento(lancamento: NovoLancamento): Observable<Lancamento> {
    return this.api.post('/api/financeiro/lancamentos', lancamento);
  }
}
