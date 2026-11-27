import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { catchError, finalize, type Observable, of, tap } from 'rxjs';
import type {
  Aluno,
  CadastroDeAluno,
  DadosDoAluno,
  EstadoDaTela,
  Plano,
  Profissional,
} from '../models/aluno';
import { mensagemDaApi } from '../utils/apresentacao';

/** Erro de gravação: o que cabe no campo CPF vai para ele, o resto para o aviso do formulário. */
export interface ErroDeGravacao {
  readonly cpf: string | null;
  readonly geral: string | null;
}

const MENCIONA_CPF = /\bcpf\b/i;

/** Estado de `/alunos/novo` e `/alunos/:id`: o aluno em edição, os planos e os professores. */
@Injectable()
export class AlunoFormStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('pronto');
  readonly aluno = signal<Aluno | null>(null);
  readonly planos = signal<readonly Plano[]>([]);
  readonly profissionais = signal<readonly Profissional[]>([]);
  readonly salvando = signal(false);
  readonly planosAtivos = computed(() => this.planos().filter((plano) => plano.ativo));

  /** Carrega os apoios do formulário e, na edição, o aluno. */
  carregar(id: string | null): void {
    this.api
      .get('/api/planos')
      .pipe(catchError(() => of([] as Plano[])))
      .subscribe((planos) => this.planos.set(planos));
    this.api
      .get('/api/funcionarios/profissionais')
      .pipe(catchError(() => of([] as Profissional[])))
      .subscribe((profissionais) => this.profissionais.set(profissionais));
    if (!id) {
      this.estado.set('pronto');
      return;
    }
    this.estado.set('carregando');
    this.api.get('/api/alunos/{id}', { caminho: { id } }).subscribe({
      next: (aluno) => {
        this.aluno.set(aluno);
        this.estado.set('pronto');
      },
      error: (falha: unknown) =>
        this.estado.set(
          falha instanceof HttpErrorResponse && falha.status === 403 ? 'sem-permissao' : 'erro',
        ),
    });
  }

  cadastrar(dados: CadastroDeAluno): Observable<Aluno> {
    this.salvando.set(true);
    return this.api.post('/api/alunos', dados).pipe(finalize(() => this.salvando.set(false)));
  }

  editar(id: string, dados: DadosDoAluno): Observable<Aluno> {
    this.salvando.set(true);
    return this.api.put('/api/alunos/{id}', dados, { caminho: { id } }).pipe(
      tap((aluno) => this.aluno.set(aluno)),
      finalize(() => this.salvando.set(false)),
    );
  }
}

/** Separa a mensagem da API entre o campo CPF e o aviso geral. */
export function erroDeGravacao(falha: unknown): ErroDeGravacao {
  const mensagem = mensagemDaApi(falha, 'Não foi possível salvar o aluno.');
  return MENCIONA_CPF.test(mensagem)
    ? { cpf: mensagem, geral: null }
    : { cpf: null, geral: mensagem };
}
