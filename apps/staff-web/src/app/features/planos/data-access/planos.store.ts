import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import {
  catchError,
  debounce,
  EMPTY,
  finalize,
  map,
  type Observable,
  of,
  Subject,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import type { ConsultaDaPrevia, DadosDoPlano, Plano, PreviaDoPlano } from '../models/plano';
import { dadosDoPlano, mensagemDaApi } from '../utils/apresentacao';

export type EstadoDaLista = 'carregando' | 'pronto' | 'erro' | 'sem-permissao';

const ESPERA_DA_DIGITACAO_MS = 300;

/**
 * Espera a digitação parar. Usa `timer` e não `debounceTime`: este confere `Date.now()` ao disparar e
 * nunca emite com o relógio fixo da regressão visual.
 */
const esperarDigitacao = <T>() => debounce<T>(() => timer(ESPERA_DA_DIGITACAO_MS));

/** Estado da tela Planos: lista com busca, prévia da parcela (calculada pela API) e gravações. */
@Injectable()
export class PlanosStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaLista>('carregando');
  readonly planos = signal<readonly Plano[]>([]);
  readonly busca = signal('');

  readonly previa = signal<PreviaDoPlano | null>(null);
  readonly erroDaPrevia = signal<string | null>(null);

  readonly salvando = signal(false);
  readonly erroAoSalvar = signal<string | null>(null);
  readonly processando = signal(false);

  readonly semPlanos = computed(
    () => this.estado() === 'pronto' && this.planos().length === 0 && this.busca() === '',
  );
  readonly semResultado = computed(
    () => this.estado() === 'pronto' && this.planos().length === 0 && this.busca() !== '',
  );

  private readonly pedidosDeLista = new Subject<string>();
  private readonly digitacoes = new Subject<string>();
  private readonly pedidosDePrevia = new Subject<ConsultaDaPrevia | null>();

  constructor() {
    this.pedidosDeLista
      .pipe(
        switchMap((busca) => this.listar(busca)),
        takeUntilDestroyed(),
      )
      .subscribe();
    this.digitacoes
      .pipe(esperarDigitacao(), takeUntilDestroyed())
      .subscribe((busca) => this.pedidosDeLista.next(busca));
    this.pedidosDePrevia
      .pipe(
        esperarDigitacao(),
        switchMap((consulta) => this.consultarPrevia(consulta)),
        takeUntilDestroyed(),
      )
      .subscribe(({ previa, erro }) => {
        this.previa.set(previa);
        this.erroDaPrevia.set(erro);
      });
  }

  /** Carrega a lista (e a recarrega, com a busca atual). */
  carregar(): void {
    this.estado.set('carregando');
    this.pedidosDeLista.next(this.busca());
  }

  buscar(texto: string): void {
    this.busca.set(texto);
    this.digitacoes.next(texto);
  }

  /** Pede o valor da parcela à API; `null` limpa a prévia (campos incompletos). */
  pedirPrevia(consulta: ConsultaDaPrevia | null): void {
    this.pedidosDePrevia.next(consulta);
  }

  limparPrevia(): void {
    this.previa.set(null);
    this.erroDaPrevia.set(null);
    this.erroAoSalvar.set(null);
  }

  salvar(dados: DadosDoPlano, id: string | null): Observable<Plano> {
    this.salvando.set(true);
    this.erroAoSalvar.set(null);
    const requisicao = id
      ? this.api.put('/api/planos/{id}', dados, { caminho: { id } })
      : this.api.post('/api/planos', dados);
    return requisicao.pipe(
      tap({
        next: () => this.recarregarSemSkeleton(),
        error: (falha: unknown) =>
          this.erroAoSalvar.set(mensagemDaApi(falha, 'Não foi possível salvar o plano.')),
      }),
      finalize(() => this.salvando.set(false)),
    );
  }

  excluir(plano: Plano): Observable<void> {
    this.processando.set(true);
    return this.api.delete('/api/planos/{id}', { caminho: { id: plano.id } }).pipe(
      tap(() => this.recarregarSemSkeleton()),
      finalize(() => this.processando.set(false)),
    );
  }

  inativar(plano: Plano): Observable<Plano> {
    this.processando.set(true);
    return this.api
      .put(
        '/api/planos/{id}',
        { ...dadosDoPlano(plano), ativo: false },
        { caminho: { id: plano.id } },
      )
      .pipe(
        tap(() => this.recarregarSemSkeleton()),
        finalize(() => this.processando.set(false)),
      );
  }

  private recarregarSemSkeleton(): void {
    this.pedidosDeLista.next(this.busca());
  }

  private listar(busca: string): Observable<unknown> {
    return this.api.get('/api/planos', { consulta: busca ? { busca } : {} }).pipe(
      tap((planos) => {
        this.planos.set(planos);
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

  private consultarPrevia(
    consulta: ConsultaDaPrevia | null,
  ): Observable<{ previa: PreviaDoPlano | null; erro: string | null }> {
    if (!consulta) {
      return of({ previa: null, erro: null });
    }
    return this.api.get('/api/planos/previa', { consulta }).pipe(
      map((previa) => ({ previa, erro: null })),
      catchError((falha: unknown) =>
        of({
          previa: null,
          erro: mensagemDaApi(falha, 'Confira o valor, a duração e as parcelas.'),
        }),
      ),
    );
  }
}
