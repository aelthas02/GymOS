import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import {
  catchError,
  debounce,
  EMPTY,
  finalize,
  type Observable,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import type {
  ContadoresDeAlunos,
  EstadoDaTela,
  FiltroDeSituacao,
  ItemDaLista,
  Plano,
} from '../models/aluno';

/** Linhas por página (`Alunos.html` mostra "1 a 8"). */
export const ALUNOS_POR_PAGINA = 8;

const ESPERA_DA_DIGITACAO_MS = 300;

/**
 * Espera a digitação parar. Usa `timer` e não `debounceTime`: este confere `Date.now()` ao disparar e
 * nunca emite com o relógio fixo da regressão visual.
 */
const esperarDigitacao = <T>() => debounce<T>(() => timer(ESPERA_DA_DIGITACAO_MS));

/**
 * Estado da lista de alunos: filtros, busca e paginação por cursor, tudo no servidor. Os contadores
 * dos chips e o total do rodapé vêm da API, já com plano e busca aplicados.
 */
@Injectable()
export class AlunosStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('carregando');
  readonly itens = signal<readonly ItemDaLista[]>([]);
  readonly contadores = signal<ContadoresDeAlunos | null>(null);
  readonly planos = signal<readonly Plano[]>([]);

  readonly situacao = signal<FiltroDeSituacao>('todos');
  readonly planoId = signal('');
  readonly busca = signal('');

  readonly pagina = signal(1);
  readonly proximoCursor = signal<string | null>(null);
  readonly processando = signal(false);

  /** Total que o chip ativo mostra: é o total filtrado do rodapé. */
  readonly total = computed(() => this.contadores()?.[this.situacao()] ?? 0);
  readonly filtrado = computed(
    () => this.situacao() !== 'todos' || this.planoId() !== '' || this.busca().trim() !== '',
  );
  readonly semAlunos = computed(
    () => this.estado() === 'pronto' && this.itens().length === 0 && !this.filtrado(),
  );
  readonly semResultado = computed(
    () => this.estado() === 'pronto' && this.itens().length === 0 && this.filtrado(),
  );

  /** O cursor que abre cada página: o índice é o número da página menos um. */
  private cursores: (string | undefined)[] = [undefined];
  private readonly pedidosDeLista = new Subject<void>();
  private readonly digitacoes = new Subject<string>();

  constructor() {
    this.pedidosDeLista
      .pipe(
        switchMap(() => this.listar()),
        takeUntilDestroyed(),
      )
      .subscribe();
    this.digitacoes
      .pipe(esperarDigitacao(), takeUntilDestroyed())
      .subscribe(() => this.recomecar());
    this.api
      .get('/api/planos')
      .pipe(
        tap((planos) => this.planos.set(planos)),
        // Sem `planos:ver` o filtro fica só com "todos".
        catchError(() => EMPTY),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  carregar(): void {
    if (this.estado() !== 'pronto') {
      this.estado.set('carregando');
    }
    this.pedidosDeLista.next();
  }

  escolherSituacao(situacao: FiltroDeSituacao): void {
    this.situacao.set(situacao);
    this.recomecar();
  }

  escolherPlano(planoId: string): void {
    this.planoId.set(planoId);
    this.recomecar();
  }

  buscar(texto: string): void {
    this.busca.set(texto);
    this.digitacoes.next(texto);
  }

  proximaPagina(): void {
    const cursor = this.proximoCursor();
    if (!cursor) {
      return;
    }
    this.cursores[this.pagina()] = cursor;
    this.pagina.update((pagina) => pagina + 1);
    this.carregar();
  }

  paginaAnterior(): void {
    if (this.pagina() <= 1) {
      return;
    }
    this.pagina.update((pagina) => pagina - 1);
    this.carregar();
  }

  excluir(aluno: Pick<ItemDaLista, 'id'>): Observable<void> {
    this.processando.set(true);
    return this.api.delete('/api/alunos/{id}', { caminho: { id: aluno.id } }).pipe(
      tap(() => {
        // Apagou o último da página: volta uma antes de recarregar.
        if (this.itens().length === 1 && this.pagina() > 1) {
          this.pagina.update((pagina) => pagina - 1);
        }
        this.pedidosDeLista.next();
      }),
      finalize(() => this.processando.set(false)),
    );
  }

  /** Mudou filtro ou busca: volta à primeira página. */
  private recomecar(): void {
    this.cursores = [undefined];
    this.pagina.set(1);
    this.carregar();
  }

  private listar(): Observable<unknown> {
    const situacao = this.situacao();
    const busca = this.busca().trim();
    const planoId = this.planoId();
    const cursor = this.cursores[this.pagina() - 1];
    return this.api
      .get('/api/alunos', {
        consulta: {
          limite: ALUNOS_POR_PAGINA,
          ...(situacao === 'todos' ? {} : { situacao }),
          ...(planoId ? { planoId } : {}),
          ...(busca ? { busca } : {}),
          ...(cursor ? { cursor } : {}),
        },
      })
      .pipe(
        tap((pagina) => {
          this.itens.set(pagina.itens);
          this.contadores.set(pagina.contadores);
          this.proximoCursor.set(pagina.proximoCursor);
          this.estado.set('pronto');
        }),
        catchError((falha: unknown) => {
          this.estado.set(
            falha instanceof HttpErrorResponse && falha.status === 403 ? 'sem-permissao' : 'erro',
          );
          return EMPTY;
        }),
      );
  }
}
