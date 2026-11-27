import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { catchError, EMPTY, finalize, type Observable, tap } from 'rxjs';
import type {
  DadosDoExercicio,
  EstadoDaTela,
  Exercicio,
  Ficha,
  Modelo,
  PainelDeFichas,
} from '../models/treinos';

export const FICHAS_POR_PAGINA = 20;

const estadoDoErro = (falha: unknown): EstadoDaTela =>
  falha instanceof HttpErrorResponse && falha.status === 403 ? 'sem-permissao' : 'erro';

/** Tela de fichas: KPIs, tabela paginada no servidor e fichas sugeridas pela IA. */
@Injectable()
export class FichasStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('carregando');
  readonly painel = signal<PainelDeFichas | null>(null);
  readonly pagina = signal(1);
  readonly processando = signal(false);

  carregar(pagina = this.pagina(), comEspera = true): void {
    this.pagina.set(pagina);
    if (comEspera) {
      this.estado.set('carregando');
    }
    this.api
      .get('/api/treinos/fichas', { consulta: { pagina, limite: FICHAS_POR_PAGINA } })
      .pipe(
        tap((painel) => {
          this.painel.set(painel);
          this.estado.set('pronto');
        }),
        catchError((falha: unknown) => {
          this.estado.set(estadoDoErro(falha));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  aprovar(fichaId: string): Observable<Ficha> {
    this.processando.set(true);
    return this.api
      .post('/api/treinos/fichas/{id}/aprovar', undefined as never, { caminho: { id: fichaId } })
      .pipe(
        tap(() => this.carregar(this.pagina(), false)),
        finalize(() => this.processando.set(false)),
      );
  }

  recusar(fichaId: string): Observable<void> {
    this.processando.set(true);
    return this.api
      .post('/api/treinos/fichas/{id}/recusar', undefined as never, { caminho: { id: fichaId } })
      .pipe(
        tap(() => this.carregar(this.pagina(), false)),
        finalize(() => this.processando.set(false)),
      );
  }

  avisarVencimentos(): Observable<{ avisados: number }> {
    this.processando.set(true);
    return this.api
      .post('/api/treinos/fichas/avisar-vencimentos', undefined as never)
      .pipe(finalize(() => this.processando.set(false)));
  }
}

/** Tela de modelos: cartões, "Usar modelo" (cria a ficha do aluno) e o editor do modelo. */
@Injectable()
export class ModelosStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('carregando');
  readonly modelos = signal<readonly Modelo[]>([]);
  readonly processando = signal(false);

  carregar(): void {
    this.estado.set('carregando');
    this.api
      .get('/api/treinos/modelos')
      .pipe(
        tap((modelos) => {
          this.modelos.set(modelos);
          this.estado.set('pronto');
        }),
        catchError((falha: unknown) => {
          this.estado.set(estadoDoErro(falha));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  usar(modeloId: string, alunoId: string): Observable<Ficha> {
    this.processando.set(true);
    return this.api
      .post('/api/treinos/modelos/{id}/usar', { alunoId }, { caminho: { id: modeloId } })
      .pipe(finalize(() => this.processando.set(false)));
  }

  salvar(dados: Omit<Modelo, 'id' | 'totalDeExercicios'>, id: string | null): Observable<Modelo> {
    this.processando.set(true);
    const requisicao = id
      ? this.api.put('/api/treinos/modelos/{id}', dados, { caminho: { id } })
      : this.api.post('/api/treinos/modelos', dados);
    return requisicao.pipe(
      tap(() => this.carregarSemEspera()),
      finalize(() => this.processando.set(false)),
    );
  }

  private carregarSemEspera(): void {
    this.api
      .get('/api/treinos/modelos')
      .pipe(tap((modelos) => this.modelos.set(modelos)))
      .subscribe();
  }
}

/** Tela da biblioteca: filtro por grupo (no servidor) e cadastro de exercício. */
@Injectable()
export class BibliotecaStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('carregando');
  readonly exercicios = signal<readonly Exercicio[]>([]);
  readonly grupo = signal('');
  readonly salvando = signal(false);

  carregar(grupo = this.grupo()): void {
    this.grupo.set(grupo);
    this.estado.set('carregando');
    this.api
      .get('/api/treinos/exercicios', { consulta: grupo ? { grupo: grupo as never } : {} })
      .pipe(
        tap((exercicios) => {
          this.exercicios.set(exercicios);
          this.estado.set('pronto');
        }),
        catchError((falha: unknown) => {
          this.estado.set(estadoDoErro(falha));
          return EMPTY;
        }),
      )
      .subscribe();
  }

  cadastrar(dados: DadosDoExercicio): Observable<Exercicio> {
    this.salvando.set(true);
    return this.api.post('/api/treinos/exercicios', dados).pipe(
      tap(() => this.carregar()),
      finalize(() => this.salvando.set(false)),
    );
  }
}
