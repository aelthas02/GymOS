import { computed, inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API } from '@gymos/api-contracts';
import { validarCpf } from '@gymos/shared-validation';
import { catchError, concatMap, from, map, of, reduce, tap } from 'rxjs';
import type {
  LinhaDaPlanilha,
  LinhaDoRelatorio,
  Plano,
  RelatorioDaImportacao,
} from '../models/aluno';
import { mensagemDaApi } from '../utils/apresentacao';
import {
  contarCpfsValidos,
  type Destino,
  lerArquivo,
  mapearColunas,
  type Planilha,
  planosInexistentes,
  prepararLinhas,
} from '../utils/planilha';

/** O corpo JSON da API tem o limite padrão de 100 kB: cada chamada leva no máximo 80 kB de linhas. */
const BYTES_POR_LOTE = 80_000;

interface Lote {
  /** Posição da primeira linha do lote na lista inteira. */
  readonly base: number;
  readonly linhas: LinhaDaPlanilha[];
}

/** Divide as linhas em lotes que cabem no corpo de uma requisição. */
function dividirEmLotes(linhas: readonly LinhaDaPlanilha[]): Lote[] {
  const lotes: Lote[] = [];
  let atual: Lote = { base: 0, linhas: [] };
  let bytes = 0;
  linhas.forEach((linha, indice) => {
    const tamanho = JSON.stringify(linha).length + 1;
    if (atual.linhas.length > 0 && bytes + tamanho > BYTES_POR_LOTE) {
      lotes.push(atual);
      atual = { base: indice, linhas: [] };
      bytes = 0;
    }
    atual.linhas.push(linha);
    bytes += tamanho;
  });
  if (atual.linhas.length > 0) {
    lotes.push(atual);
  }
  return lotes;
}

export type EtapaDaImportacao = 1 | 2 | 3;

interface Acumulado {
  criados: number;
  comContrato: number;
  semContrato: number;
  linhas: LinhaDoRelatorio[];
}

/**
 * Importação de alunos em 3 etapas: enviar a planilha, conferir as colunas e revisar o relatório.
 * As regras (CPF, plano, duplicidade) são da API; aqui só se lê o arquivo e se mostra o resultado.
 */
@Injectable()
export class ImportacaoStore {
  private readonly api = inject(CLIENTE_DA_API);

  readonly etapa = signal<EtapaDaImportacao>(1);
  readonly nomeDoArquivo = signal('');
  readonly planilha = signal<Planilha | null>(null);
  readonly mapa = signal<readonly Destino[]>([]);
  readonly planos = signal<readonly Plano[]>([]);

  readonly lendo = signal(false);
  readonly erroDeLeitura = signal<string | null>(null);
  readonly importando = signal(false);
  readonly progresso = signal<{ feitas: number; total: number } | null>(null);
  readonly erroDaImportacao = signal<string | null>(null);
  readonly relatorio = signal<RelatorioDaImportacao | null>(null);

  private readonly preparadas = computed(() => {
    const planilha = this.planilha();
    return planilha
      ? prepararLinhas(planilha, this.mapa())
      : { linhas: [] as LinhaDaPlanilha[], numeros: [] as number[], semNome: [] };
  });

  /** Falta mapear Nome ou CPF: sem eles não há como importar. */
  readonly camposObrigatoriosFaltando = computed(() => {
    const mapa = this.mapa();
    return (['nome', 'cpf'] as const).filter((campo) => !mapa.includes(campo));
  });
  readonly totalDeLinhas = computed(() => this.planilha()?.linhas.length ?? 0);
  /** Linhas que a API vai tentar criar: as com CPF válido. */
  readonly aImportar = computed(() => contarCpfsValidos(this.preparadas().linhas));
  readonly comCpfInvalido = computed(
    () =>
      this.preparadas().linhas.length -
      this.aImportar() +
      this.preparadas().semNome.filter((linha) => !validarCpf(linha.cpf)).length,
  );
  readonly planosFaltando = computed(() =>
    planosInexistentes(
      this.preparadas().linhas,
      this.planos()
        .filter((plano) => plano.ativo)
        .map((plano) => plano.nome),
    ),
  );
  readonly pode = computed(
    () => this.camposObrigatoriosFaltando().length === 0 && this.aImportar() > 0,
  );

  constructor() {
    this.api
      .get('/api/planos')
      .pipe(catchError(() => of([] as Plano[])))
      .subscribe((planos) => this.planos.set(planos));
  }

  /** Lê o arquivo e passa para a conferência das colunas, com o mapeamento automático. */
  async enviarArquivo(arquivo: File): Promise<void> {
    this.lendo.set(true);
    this.erroDeLeitura.set(null);
    try {
      const planilha = await lerArquivo(arquivo);
      if (planilha.cabecalhos.length === 0 || planilha.linhas.length === 0) {
        this.erroDeLeitura.set('A planilha não tem linhas de alunos. Confira o arquivo.');
        return;
      }
      this.nomeDoArquivo.set(arquivo.name);
      this.planilha.set(planilha);
      this.mapa.set(mapearColunas(planilha.cabecalhos));
      this.relatorio.set(null);
      this.etapa.set(2);
    } catch {
      this.erroDeLeitura.set('Não foi possível ler a planilha. Envie um arquivo .xlsx ou .csv.');
    } finally {
      this.lendo.set(false);
    }
  }

  /** Muda o campo de uma coluna; cada campo da API fica com uma coluna só. */
  escolherDestino(coluna: number, destino: Destino): void {
    this.mapa.update((mapa) =>
      mapa.map((atual, indice) => {
        if (indice === coluna) {
          return destino;
        }
        return destino !== '' && atual === destino ? '' : atual;
      }),
    );
  }

  voltarParaOEnvio(): void {
    this.etapa.set(1);
    this.erroDaImportacao.set(null);
  }

  recomecar(): void {
    this.planilha.set(null);
    this.mapa.set([]);
    this.relatorio.set(null);
    this.nomeDoArquivo.set('');
    this.erroDaImportacao.set(null);
    this.progresso.set(null);
    this.etapa.set(1);
  }

  /** Manda as linhas à API em lotes e junta os relatórios, com o número da linha da planilha. */
  importar(): void {
    if (this.importando() || !this.pode()) {
      return;
    }
    const { linhas, numeros, semNome } = this.preparadas();
    const lotes = dividirEmLotes(linhas);
    this.importando.set(true);
    this.erroDaImportacao.set(null);
    this.progresso.set({ feitas: 0, total: linhas.length });
    from(lotes)
      .pipe(
        concatMap((lote) =>
          this.api.post('/api/alunos/importacao', { linhas: lote.linhas }).pipe(
            tap(() =>
              this.progresso.update((atual) =>
                atual
                  ? { ...atual, feitas: Math.min(atual.total, atual.feitas + lote.linhas.length) }
                  : atual,
              ),
            ),
            map((relatorio) => ({ relatorio, base: lote.base })),
          ),
        ),
        reduce<{ relatorio: RelatorioDaImportacao; base: number }, Acumulado>(
          (acc, { relatorio, base }) => ({
            criados: acc.criados + relatorio.criados,
            comContrato: acc.comContrato + relatorio.comContrato,
            semContrato: acc.semContrato + relatorio.semContrato,
            linhas: [
              ...acc.linhas,
              ...relatorio.linhas.map((linha) => ({
                ...linha,
                linha: numeros[base + linha.linha - 1] ?? linha.linha,
              })),
            ],
          }),
          { criados: 0, comContrato: 0, semContrato: 0, linhas: [] },
        ),
      )
      .subscribe({
        next: (total) => {
          const puladasSemNome: LinhaDoRelatorio[] = semNome.map((linha) => ({
            linha: linha.linha,
            nome: '',
            cpf: linha.cpf,
            situacao: 'pulada',
            motivo: 'Nome não informado',
          }));
          this.relatorio.set({
            ...total,
            linhas: [...total.linhas, ...puladasSemNome].sort((a, b) => a.linha - b.linha),
          });
          this.importando.set(false);
          this.etapa.set(3);
        },
        error: (falha: unknown) => {
          this.importando.set(false);
          this.erroDaImportacao.set(
            mensagemDaApi(falha, 'Não foi possível importar a planilha. Tente de novo.'),
          );
        },
      });
  }
}
