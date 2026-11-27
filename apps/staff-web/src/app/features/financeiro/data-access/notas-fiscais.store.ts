import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API, URL_BASE_DA_API } from '@gymos/api-contracts';
import { forkJoin, type Observable, tap } from 'rxjs';
import type { NotaFiscal, NotaFiscalDetalhe, ResumoDasNotas } from '../models/notas';

export type EstadoDaTela = 'carregando' | 'pronto' | 'erro';

const TAMANHO_DA_PAGINA = 20;

/** Store de `/financeiro/notas-fiscais`: KPIs, "Notas do mês" por cursor e "Precisa de atenção". */
@Injectable()
export class NotasFiscaisStore {
  private readonly api = inject(CLIENTE_DA_API);
  private readonly http = inject(HttpClient);
  private readonly base = inject(URL_BASE_DA_API);

  readonly estado = signal<EstadoDaTela>('carregando');
  readonly resumo = signal<ResumoDasNotas | null>(null);
  readonly notas = signal<readonly NotaFiscal[]>([]);
  readonly atencao = signal<readonly NotaFiscal[]>([]);
  readonly proximoCursor = signal<string | null>(null);
  readonly carregandoMais = signal(false);

  readonly maiorPorTipo = computed(() => {
    const porTipo = this.resumo()?.emitidasPorTipo;
    return porTipo ? Math.max(porTipo.nfse, porTipo.nfce) : 0;
  });

  carregar(): void {
    this.estado.set('carregando');
    forkJoin({
      resumo: this.api.get('/api/notas-fiscais/resumo'),
      pagina: this.api.get('/api/notas-fiscais', { consulta: { limite: TAMANHO_DA_PAGINA } }),
      atencao: this.api.get('/api/notas-fiscais/atencao'),
    }).subscribe({
      next: ({ resumo, pagina, atencao }) => {
        this.resumo.set(resumo);
        this.notas.set(pagina.itens);
        this.proximoCursor.set(pagina.proximoCursor);
        this.atencao.set(atencao);
        this.estado.set('pronto');
      },
      error: () => this.estado.set('erro'),
    });
  }

  carregarMais(): void {
    const cursor = this.proximoCursor();
    if (!cursor || this.carregandoMais()) {
      return;
    }
    this.carregandoMais.set(true);
    this.api
      .get('/api/notas-fiscais', { consulta: { limite: TAMANHO_DA_PAGINA, cursor } })
      .subscribe({
        next: (pagina) => {
          this.notas.update((atuais) => [...atuais, ...pagina.itens]);
          this.proximoCursor.set(pagina.proximoCursor);
          this.carregandoMais.set(false);
        },
        error: () => this.carregandoMais.set(false),
      });
  }

  detalhe(id: string): Observable<NotaFiscalDetalhe> {
    return this.api.get('/api/notas-fiscais/{id}', { caminho: { id } });
  }

  reenviar(id: string): Observable<NotaFiscalDetalhe> {
    return this.api
      .post('/api/notas-fiscais/{id}/reenvio', undefined as never, { caminho: { id } })
      .pipe(tap((nota) => this.atualizar(nota)));
  }

  corrigir(
    id: string,
    correcao: { cpf?: string; descricao?: string; valorCentavos?: number },
  ): Observable<NotaFiscalDetalhe> {
    return this.api
      .post('/api/notas-fiscais/{id}/correcao', correcao, { caminho: { id } })
      .pipe(tap((nota) => this.atualizar(nota)));
  }

  cancelar(id: string, motivo: string): Observable<NotaFiscalDetalhe> {
    return this.api
      .post('/api/notas-fiscais/{id}/cancelamento', { motivo }, { caminho: { id } })
      .pipe(tap((nota) => this.atualizar(nota)));
  }

  enviarAoAluno(id: string): Observable<{ enviadaPor: Array<'email' | 'whatsapp'> }> {
    return this.api.post(
      '/api/notas-fiscais/{id}/envio',
      { canais: ['email', 'whatsapp'], anexarArquivos: true },
      { caminho: { id } },
    );
  }

  arquivo(id: string, arquivo: 'pdf' | 'xml'): Observable<{ url: string }> {
    return this.api.get('/api/notas-fiscais/{id}/arquivos/{arquivo}', {
      caminho: { id, arquivo },
    });
  }

  /** ZIP com os XMLs e o CSV do mês (o cliente gerado só fala JSON). */
  exportar(): Observable<Blob> {
    const competencia = this.resumo()?.competencia;
    return this.http.get(`${this.base}/api/notas-fiscais/exportacao`, {
      params: competencia ? { competencia } : {},
      responseType: 'blob',
    });
  }

  /** Troca a nota nas listas e recarrega os números do mês. */
  private atualizar(nota: NotaFiscal): void {
    this.notas.update((atuais) => atuais.map((item) => (item.id === nota.id ? nota : item)));
    forkJoin({
      resumo: this.api.get('/api/notas-fiscais/resumo'),
      atencao: this.api.get('/api/notas-fiscais/atencao'),
    }).subscribe({
      next: ({ resumo, atencao }) => {
        this.resumo.set(resumo);
        this.atencao.set(atencao);
      },
    });
  }
}
