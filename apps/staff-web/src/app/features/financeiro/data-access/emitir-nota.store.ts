import { inject, Injectable, signal } from '@angular/core';
import { type Corpo, CLIENTE_DA_API } from '@gymos/api-contracts';
import { catchError, type Observable, of, Subject, switchMap, debounceTime, map } from 'rxjs';
import type {
  ItemDaListaDeAlunos,
  NotaFiscalDetalhe,
  PreviaDaNota,
  SugestaoDeNota,
  TipoDeNota,
} from '../models/notas';
import type { EstadoDaTela } from './notas-fiscais.store';

export type NovaNota = Corpo<'/api/notas-fiscais', 'post'>;

const ESPERA_DA_BUSCA_MS = 300;
const ESPERA_DA_PREVIA_MS = 250;

/** Store de `/financeiro/notas-fiscais/emitir`: busca do aluno, preenchimento, prévia e emissão. */
@Injectable()
export class EmitirNotaStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly estado = signal<EstadoDaTela>('pronto');
  readonly sugestao = signal<SugestaoDeNota | null>(null);
  readonly previa = signal<PreviaDaNota | null>(null);
  readonly alunos = signal<readonly ItemDaListaDeAlunos[]>([]);

  private readonly buscas = new Subject<string>();
  private readonly valores = new Subject<number>();

  constructor() {
    this.buscas
      .pipe(
        debounceTime(ESPERA_DA_BUSCA_MS),
        switchMap((busca) =>
          busca.trim().length < 2
            ? of([])
            : this.api.get('/api/alunos', { consulta: { busca: busca.trim(), limite: 6 } }).pipe(
                map((pagina) => pagina.itens),
                catchError(() => of([])),
              ),
        ),
      )
      .subscribe((itens) => this.alunos.set(itens));
    this.valores
      .pipe(
        debounceTime(ESPERA_DA_PREVIA_MS),
        switchMap((valorCentavos) =>
          this.api
            .get('/api/notas-fiscais/previa', { consulta: { valorCentavos } })
            .pipe(catchError(() => of(null))),
        ),
      )
      .subscribe((previa) => previa && this.previa.set(previa));
  }

  buscarAlunos(busca: string): void {
    this.buscas.next(busca);
  }

  limparAlunos(): void {
    this.alunos.set([]);
  }

  /** Cliente do cadastro e serviço da mensalidade em aberto. */
  preencher(alunoId: string, tipo: TipoDeNota): void {
    this.estado.set('carregando');
    this.api.get('/api/notas-fiscais/sugestao', { consulta: { alunoId, tipo } }).subscribe({
      next: (sugestao) => {
        this.sugestao.set(sugestao);
        this.previa.set(sugestao.resumo);
        this.estado.set('pronto');
      },
      error: () => this.estado.set('erro'),
    });
  }

  atualizarValor(valorCentavos: number): void {
    this.valores.next(Math.max(0, valorCentavos));
  }

  emitir(nota: NovaNota): Observable<NotaFiscalDetalhe> {
    return this.api.post('/api/notas-fiscais', nota);
  }
}
