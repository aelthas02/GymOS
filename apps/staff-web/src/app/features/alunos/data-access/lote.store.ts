import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { catchError, expand, finalize, map, type Observable, of, reduce, switchMap } from 'rxjs';
import type {
  ContadoresDeAlunos,
  EstadoDaTela,
  ItemDaLista,
  PaginaDeAlunos,
} from '../models/aluno';

export type ModoDoLote = 'atencao' | 'todos';

/** O máximo que a API aceita por página (`LIMITE_MAXIMO_DA_LISTA`). */
const POR_PAGINA = 100;
/** Trava de segurança ao varrer as páginas de "Em atraso e a vencer". */
const PAGINAS_NO_MAXIMO = 10;

/** Estado de `/alunos/lote`: a lista escolhida, a seleção e o envio de cobrança. */
@Injectable()
export class LoteStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('carregando');
  readonly modo = signal<ModoDoLote>('atencao');
  readonly itens = signal<readonly ItemDaLista[]>([]);
  readonly contadores = signal<ContadoresDeAlunos | null>(null);
  readonly selecionados = signal<ReadonlySet<string>>(new Set());
  readonly proximoCursor = signal<string | null>(null);
  readonly enviando = signal(false);

  readonly totalDeAtencao = computed(() => {
    const contadores = this.contadores();
    return contadores ? contadores.em_atraso + contadores.a_vencer : 0;
  });
  readonly alunosSelecionados = computed(() =>
    this.itens().filter((item) => this.selecionados().has(item.id)),
  );

  carregar(): void {
    this.estado.set('carregando');
    this.proximoCursor.set(null);
    const lista$ = this.modo() === 'atencao' ? this.listarAtencao() : this.listarPagina(undefined);
    lista$
      .pipe(
        catchError((falha: unknown) => {
          this.estado.set(
            falha instanceof HttpErrorResponse && falha.status === 403 ? 'sem-permissao' : 'erro',
          );
          return of(null);
        }),
      )
      .subscribe((resultado) => {
        if (!resultado) {
          return;
        }
        this.itens.set(resultado.itens);
        this.contadores.set(resultado.contadores);
        this.proximoCursor.set(resultado.proximoCursor);
        this.estado.set('pronto');
      });
  }

  escolherModo(modo: ModoDoLote): void {
    if (modo === this.modo()) {
      return;
    }
    this.modo.set(modo);
    this.carregar();
  }

  /** Só no modo "Todos": acrescenta a próxima página à lista. */
  carregarMais(): void {
    const cursor = this.proximoCursor();
    if (!cursor) {
      return;
    }
    this.listarPagina(cursor).subscribe({
      next: (pagina) => {
        this.itens.update((itens) => [...itens, ...pagina.itens]);
        this.proximoCursor.set(pagina.proximoCursor);
      },
      error: () => undefined,
    });
  }

  alternar(id: string, marcado: boolean): void {
    const novo = new Set(this.selecionados());
    if (marcado) {
      novo.add(id);
    } else {
      novo.delete(id);
    }
    this.selecionados.set(novo);
  }

  limparSelecao(): void {
    this.selecionados.set(new Set());
  }

  /** Cobrança em lote (T19): o servidor escolhe a parcela vencida mais antiga de cada aluno. */
  enviarCobranca(): Observable<{ enviadas: number; semPendencia: number }> {
    this.enviando.set(true);
    return this.api.post('/api/cobranca/lote', { alunoIds: [...this.selecionados()] }).pipe(
      map((resultado) => ({
        enviadas: resultado.enviadas,
        semPendencia: resultado.semPendencia.length,
      })),
      finalize(() => this.enviando.set(false)),
    );
  }

  private listarPagina(cursor: string | undefined): Observable<PaginaDeAlunos> {
    return this.api.get('/api/alunos', {
      consulta: { limite: POR_PAGINA, ...(cursor ? { cursor } : {}) },
    });
  }

  /** "Em atraso e a vencer": a API filtra uma situação por vez, então juntamos as duas listas. */
  private listarAtencao(): Observable<PaginaDeAlunos> {
    const varrer = (situacao: 'em_atraso' | 'a_vencer'): Observable<PaginaDeAlunos> =>
      this.api.get('/api/alunos', { consulta: { situacao, limite: POR_PAGINA } }).pipe(
        expand((pagina, indice) =>
          pagina.proximoCursor && indice + 1 < PAGINAS_NO_MAXIMO
            ? this.api.get('/api/alunos', {
                consulta: { situacao, limite: POR_PAGINA, cursor: pagina.proximoCursor },
              })
            : of(),
        ),
        reduce<PaginaDeAlunos, PaginaDeAlunos | null>(
          (todos, pagina) =>
            todos ? { ...todos, itens: [...todos.itens, ...pagina.itens] } : pagina,
          null,
        ),
        map((pagina) => pagina as PaginaDeAlunos),
      );
    return varrer('em_atraso').pipe(
      switchMap((atrasados) =>
        varrer('a_vencer').pipe(
          map((aVencer) => {
            const ids = new Set(atrasados.itens.map((item) => item.id));
            return {
              contadores: atrasados.contadores,
              proximoCursor: null,
              itens: [...atrasados.itens, ...aVencer.itens.filter((item) => !ids.has(item.id))],
            };
          }),
        ),
      ),
    );
  }
}
