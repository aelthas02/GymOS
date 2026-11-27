import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { catchError, EMPTY, finalize, type Observable, tap } from 'rxjs';
import type { EstadoDaTela, Ficha, GerarFicha, SalvarFicha } from '../models/treinos';
import { treinosEditaveis, treinosParaApi } from '../utils/apresentacao';
import { EdicaoDeTreinos } from '../utils/edicao-de-treinos';

/** Editor da ficha de um aluno: dados do servidor, treinos em edição e o exercício em destaque. */
@Injectable()
export class FichaStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly edicao = new EdicaoDeTreinos();
  readonly estado = signal<EstadoDaTela>('carregando');
  readonly ficha = signal<Ficha | null>(null);
  readonly alunoNome = signal('');
  readonly processando = signal(false);
  readonly gerando = signal(false);

  /** Ficha da IA que ainda espera o professor (banner "Rascunho gerado com IA"). */
  readonly aguardando = computed(() => this.ficha()?.situacao === 'aguardando_aprovacao');

  carregar(alunoId: string): void {
    this.estado.set('carregando');
    this.api
      .get('/api/alunos/{id}', { caminho: { id: alunoId } })
      .pipe(
        tap((aluno) => this.alunoNome.set(aluno.nome)),
        catchError((falha: unknown) => {
          this.estado.set(this.estadoDoErro(falha));
          return EMPTY;
        }),
      )
      .subscribe(() => this.carregarFicha(alunoId));
  }

  private carregarFicha(alunoId: string): void {
    this.api
      .get('/api/treinos/alunos/{alunoId}/ficha', { caminho: { alunoId } })
      .pipe(
        catchError((falha: unknown) => {
          if (falha instanceof HttpErrorResponse && falha.status === 404) {
            // Aluno sem ficha: editor em branco.
            this.ficha.set(null);
            this.edicao.iniciar();
            this.estado.set('pronto');
          } else {
            this.estado.set(this.estadoDoErro(falha));
          }
          return EMPTY;
        }),
      )
      .subscribe((ficha) => {
        this.usar(ficha);
        this.estado.set('pronto');
      });
  }

  /** Troca a ficha em edição pela devolvida pelo servidor. */
  usar(ficha: Ficha): void {
    this.ficha.set(ficha);
    this.alunoNome.set(ficha.alunoNome);
    this.edicao.definir(treinosEditaveis(ficha.treinos));
  }

  salvar(alunoId: string, dados: Omit<SalvarFicha, 'treinos'>): Observable<Ficha> {
    this.processando.set(true);
    return this.api
      .put(
        '/api/treinos/alunos/{alunoId}/ficha',
        { ...dados, treinos: treinosParaApi(this.edicao.treinos()) },
        { caminho: { alunoId } },
      )
      .pipe(
        tap((ficha) => this.usarNaMesmaAba(ficha)),
        finalize(() => this.processando.set(false)),
      );
  }

  gerar(alunoId: string, dados: GerarFicha): Observable<Ficha> {
    this.gerando.set(true);
    return this.api
      .post('/api/treinos/alunos/{alunoId}/ficha/gerar-com-ia', dados, { caminho: { alunoId } })
      .pipe(
        tap((ficha) => this.usar(ficha)),
        finalize(() => this.gerando.set(false)),
      );
  }

  aprovar(fichaId: string): Observable<Ficha> {
    this.processando.set(true);
    return this.api
      .post('/api/treinos/fichas/{id}/aprovar', undefined as never, { caminho: { id: fichaId } })
      .pipe(
        tap((ficha) => this.usarNaMesmaAba(ficha)),
        finalize(() => this.processando.set(false)),
      );
  }

  private usarNaMesmaAba(ficha: Ficha): void {
    const aba = this.edicao.indice();
    this.usar(ficha);
    if (aba < this.edicao.treinos().length) {
      this.edicao.escolher(aba);
    }
  }

  private estadoDoErro(falha: unknown): EstadoDaTela {
    return falha instanceof HttpErrorResponse && falha.status === 403 ? 'sem-permissao' : 'erro';
  }
}
