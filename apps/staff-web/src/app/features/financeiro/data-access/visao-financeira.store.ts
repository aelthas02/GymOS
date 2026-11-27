import { inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import {
  type ChaveDaVisao,
  type ChaveDePeriodo,
  type EstadoDaTela,
  FILTROS_PADRAO,
  type FiltrosDoFinanceiro,
  type VisaoFinanceira,
} from '../models/financeiro';
import { consultaDosFiltros } from '../utils/financeiro';

const TAMANHO_DA_PAGINA = 20;

/** Store das visões do "Visualizar por" (setores, funcionários, alunos, aulas, planos, formas). */
@Injectable()
export class VisaoFinanceiraStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('carregando');
  readonly visao = signal<VisaoFinanceira | null>(null);
  readonly filtros = signal<FiltrosDoFinanceiro>(FILTROS_PADRAO);
  readonly carregandoMais = signal(false);

  private chave: ChaveDaVisao = 'setores';

  carregar(chave: ChaveDaVisao): void {
    this.chave = chave;
    this.estado.set('carregando');
    this.api
      .get('/api/financeiro/visoes/{visao}', {
        caminho: { visao: chave },
        consulta: { ...consultaDosFiltros(this.filtros()), limite: TAMANHO_DA_PAGINA } as never,
      })
      .subscribe({
        next: (visao) => {
          this.visao.set(visao);
          this.estado.set('pronto');
        },
        error: () => this.estado.set('erro'),
      });
  }

  escolherPeriodo(periodo: ChaveDePeriodo): void {
    this.filtros.update((atual) => ({ ...atual, periodo }));
    this.carregar(this.chave);
  }

  carregarMais(): void {
    const cursor = this.visao()?.tabela.proximoCursor;
    if (!cursor || this.carregandoMais()) {
      return;
    }
    this.carregandoMais.set(true);
    this.api
      .get('/api/financeiro/visoes/{visao}', {
        caminho: { visao: this.chave },
        consulta: {
          ...consultaDosFiltros(this.filtros()),
          limite: TAMANHO_DA_PAGINA,
          cursor,
        } as never,
      })
      .subscribe({
        next: (pagina) => {
          this.visao.update((atual) =>
            atual
              ? {
                  ...pagina,
                  tabela: {
                    ...pagina.tabela,
                    linhas: [...atual.tabela.linhas, ...pagina.tabela.linhas],
                  },
                }
              : pagina,
          );
          this.carregandoMais.set(false);
        },
        error: () => this.carregandoMais.set(false),
      });
  }
}
