import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { catchError, forkJoin, type Observable, of } from 'rxjs';
import type {
  Aluno,
  Contrato,
  EstadoDaTela,
  Pagamento,
  Parcela,
  Profissional,
  SituacaoDoAluno,
  TreinoDoAluno,
} from '../models/aluno';

/**
 * Dados de `/alunos/:id/acompanhamento`. Cada bloco vem do seu dono: aluno e contrato (T15a),
 * pagamentos e parcelas (T19), carga, esforço e ficha (T25). Frequência (T23a) e observações do
 * professor ainda não têm endpoint e a tela os mostra vazios.
 */
@Injectable()
export class AcompanhamentoStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('carregando');
  readonly aluno = signal<Aluno | null>(null);
  readonly contrato = signal<Contrato | null>(null);
  readonly situacao = signal<SituacaoDoAluno | null>(null);
  readonly pagamentos = signal<readonly Pagamento[]>([]);
  readonly parcelas = signal<readonly Parcela[]>([]);
  readonly professor = signal<Profissional | null>(null);
  readonly treino = signal<TreinoDoAluno | null>(null);

  readonly ultimoPagamento = computed(
    () =>
      [...this.pagamentos()]
        .filter((pagamento) => pagamento.situacao !== 'estornado')
        .sort((a, b) => b.confirmadoEm.localeCompare(a.confirmadoEm))[0] ?? null,
  );
  readonly parcelasAtrasadas = computed(() =>
    this.parcelas().filter((parcela) => parcela.situacao === 'atrasada'),
  );

  carregar(id: string): void {
    this.estado.set('carregando');
    // Só o aluno derruba a tela; o resto de cada bloco falha para "vazio".
    const opcional =
      <T>(valor: T) =>
      (origem: Observable<T>): Observable<T> =>
        origem.pipe(catchError(() => of(valor)));
    forkJoin({
      aluno: this.api.get('/api/alunos/{id}', { caminho: { id } }),
      contrato: this.api
        .get('/api/alunos/{id}/contrato', { caminho: { id } })
        .pipe(opcional<Contrato | null>(null)),
      situacao: this.api
        .get('/api/alunos/{id}/situacao', { caminho: { id } })
        .pipe(opcional<SituacaoDoAluno | null>(null)),
      pagamentos: this.api
        .get('/api/cobranca/alunos/{alunoId}/pagamentos', { caminho: { alunoId: id } })
        .pipe(opcional<readonly Pagamento[]>([])),
      parcelas: this.api
        .get('/api/cobranca/alunos/{alunoId}/parcelas', { caminho: { alunoId: id } })
        .pipe(opcional<readonly Parcela[]>([])),
      treino: this.api
        .get('/api/treinos/alunos/{alunoId}/acompanhamento', { caminho: { alunoId: id } })
        .pipe(opcional<TreinoDoAluno | null>(null)),
      profissionais: this.api
        .get('/api/funcionarios/profissionais')
        .pipe(opcional<readonly Profissional[]>([])),
    }).subscribe({
      next: (dados) => {
        this.aluno.set(dados.aluno);
        this.contrato.set(dados.contrato);
        this.situacao.set(dados.situacao);
        this.pagamentos.set(dados.pagamentos);
        this.parcelas.set(dados.parcelas);
        this.treino.set(dados.treino);
        this.professor.set(
          dados.profissionais.find((item) => item.id === dados.aluno.professorId) ?? null,
        );
        this.estado.set('pronto');
      },
      error: (falha: unknown) =>
        this.estado.set(
          falha instanceof HttpErrorResponse && falha.status === 403 ? 'sem-permissao' : 'erro',
        ),
    });
  }
}
