import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Badge,
  Button,
  FileDropzone,
  PageHeader,
  Select,
  type SelectOption,
  Stepper,
  type StepItem,
  ToastService,
} from '@gymos/ui';
import { AbasDeAlunos } from '../components/abas-de-alunos';
import { ImportacaoStore } from '../data-access/importacao.store';
import { baixarBlob, baixarTexto, celulaDeCsv } from '../utils/apresentacao';
import { CAMPOS_DE_IMPORTACAO, type Destino, MODELO_DE_PLANILHA } from '../utils/planilha';

const PASSOS: readonly StepItem[] = [
  { label: 'Enviar planilha' },
  { label: 'Conferir colunas' },
  { label: 'Revisar e importar' },
];

const TAMANHO_MAXIMO_EM_BYTES = 5 * 1024 * 1024;

const OPCOES_DE_DESTINO: readonly SelectOption[] = [
  { value: '', label: 'Não importar' },
  ...CAMPOS_DE_IMPORTACAO.map((item) => ({ value: item.campo, label: item.rotulo })),
];

/** Importar alunos (`/alunos/importar`, `Importar.html`). */
@Component({
  selector: 'app-importar-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ImportacaoStore],
  imports: [PageHeader, AbasDeAlunos, Stepper, Button, Badge, Select, FileDropzone, RouterLink],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }
    .importar__corpo {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: flex-start;
    }
    aside {
      flex: 0 0 250px;
      align-self: flex-start;
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
      box-sizing: border-box;
    }
    .importar__titulo {
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .importar__nota {
      margin: 14px 0 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--muted);
    }
    aside ui-button {
      display: inline-block;
      margin-top: 10px;
    }
    section {
      flex: 1 1 560px;
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .importar__cabeca {
      padding: 20px;
    }
    .importar__arquivo {
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
      color: var(--muted);
    }
    h2 {
      margin: 4px 0 0;
      font-size: 20px;
      font-weight: var(--font-weight-bold);
    }
    .importar__envio {
      padding: 0 20px 20px;
    }
    .importar__rolagem {
      overflow-x: auto;
    }
    .importar__grade {
      min-width: 640px;
    }
    .importar__linha {
      display: grid;
      grid-template-columns: minmax(150px, 1fr) minmax(160px, 1fr) minmax(170px, 1fr) 100px;
      gap: 10px;
      align-items: center;
      padding: 11px 16px;
      border-top: 1px solid var(--divider);
      font-size: 14px;
    }
    .importar__linha--titulo {
      padding: 10px 16px;
      border-top: 0;
      color: var(--muted);
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .importar__linha--relatorio {
      grid-template-columns: 70px minmax(140px, 1fr) minmax(130px, 0.8fr) 120px minmax(
          200px,
          1.6fr
        );
    }
    ui-select {
      min-width: 0;
    }
    :host ::ng-deep .importar__linha select {
      /* 40 px de conteúdo mais a borda, como no protótipo. */
      height: 42px;
      border-radius: 10px;
    }
    .importar__exemplo {
      min-width: 0;
      overflow: hidden;
      color: var(--muted);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .importar__rodape {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px 20px;
      border-top: 1px solid var(--divider);
    }
    .importar__aviso {
      margin: 0;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--badge-soon-bg);
      color: var(--badge-soon-fg);
      font-size: 13px;
      line-height: 1.5;
    }
    .importar__aviso--erro {
      background: var(--badge-late-bg);
      color: var(--badge-late-fg);
    }
    .importar__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: space-between;
    }
    .importar__resumo {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      padding: 0 20px 20px;
    }
    .importar__numero {
      flex: 1 1 140px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
    }
    .importar__numero b {
      display: block;
      font-size: 26px;
    }
    .importar__numero span {
      font-size: 12px;
      color: var(--muted);
    }
    .importar__vazio {
      margin: 0;
      padding: 0 20px 20px;
      font-size: 14px;
      color: var(--muted);
    }
  `,
  template: `
    <ui-page-header
      heading="Alunos"
      subtitle="Importe os alunos do seu sistema anterior em poucos minutos."
      [help]="false"
    />

    <app-abas-de-alunos ativa="importar" />

    <div class="importar__corpo">
      <aside aria-label="Etapas da importação">
        <div class="importar__titulo">Importar alunos</div>
        <ui-stepper label="Etapas da importação" [steps]="passos" [current]="store.etapa() - 1" />
        <p class="importar__nota">Aceita .xlsx e .csv. Baixe o modelo pronto se preferir.</p>
        <ui-button variant="outline" (click)="baixarModelo()">Baixar modelo</ui-button>
      </aside>

      <section [attr.aria-label]="passos[store.etapa() - 1]?.label">
        @switch (store.etapa()) {
          @case (1) {
            <div class="importar__cabeca">
              <h2>Envie a planilha</h2>
            </div>
            <div class="importar__envio">
              <ui-file-dropzone
                title="Arraste a planilha aqui"
                hint="Arquivos .xlsx ou .csv, de até 5 MB"
                buttonLabel="Escolher planilha"
                [accept]="tiposAceitos"
                [maxSize]="tamanhoMaximo"
                [disabled]="store.lendo()"
                [externalError]="store.erroDeLeitura() ?? undefined"
                (fileSelected)="store.enviarArquivo($event)"
              />
            </div>
          }
          @case (2) {
            <div class="importar__cabeca">
              <div class="importar__arquivo">
                Arquivo: {{ store.nomeDoArquivo() }}, {{ store.totalDeLinhas() }} linhas
              </div>
              <h2>Confira as colunas</h2>
            </div>
            <div class="importar__rolagem">
              <div class="importar__grade">
                <div class="importar__linha importar__linha--titulo">
                  <span>Coluna da planilha</span>
                  <span>Exemplo</span>
                  <span>Vai para o campo</span>
                  <span>Situação</span>
                </div>
                @for (coluna of colunas(); track coluna.indice) {
                  <div class="importar__linha">
                    <b>{{ coluna.cabecalho }}</b>
                    <span class="importar__exemplo">{{ coluna.exemplo }}</span>
                    <ui-select
                      [ariaLabel]="'Campo para a coluna ' + coluna.cabecalho"
                      [options]="opcoesDeDestino"
                      [value]="coluna.destino"
                      (valueChange)="escolher(coluna.indice, $event)"
                    />
                    <ui-badge [variant]="coluna.destino === '' ? 'off' : 'ok'">
                      {{ coluna.destino === '' ? 'Ignorada' : 'Ok' }}
                    </ui-badge>
                  </div>
                }
              </div>
            </div>
            <div class="importar__rodape">
              @if (store.camposObrigatoriosFaltando().length > 0) {
                <p class="importar__aviso importar__aviso--erro" role="alert">
                  Escolha uma coluna para Nome e uma para CPF antes de importar.
                </p>
              } @else if (avisoDasLinhas()) {
                <p class="importar__aviso"><b>Atenção:</b> {{ avisoDasLinhas() }}</p>
              }
              @if (store.erroDaImportacao()) {
                <p class="importar__aviso importar__aviso--erro" role="alert">
                  {{ store.erroDaImportacao() }}
                </p>
              }
              <div class="importar__acoes">
                <ui-button size="lg" variant="outline" (click)="store.voltarParaOEnvio()">
                  Voltar
                </ui-button>
                <ui-button
                  size="lg"
                  variant="accent"
                  [disabled]="!store.pode()"
                  [loading]="store.importando()"
                  (click)="store.importar()"
                >
                  {{ textoDoBotao() }}
                </ui-button>
              </div>
            </div>
          }
          @default {
            @if (store.relatorio(); as relatorio) {
              <div class="importar__cabeca">
                <div class="importar__arquivo">Arquivo: {{ store.nomeDoArquivo() }}</div>
                <h2>Importação concluída</h2>
              </div>
              <div class="importar__resumo">
                <div class="importar__numero">
                  <b>{{ relatorio.criados }}</b><span>{{
                    relatorio.criados === 1 ? 'aluno criado' : 'alunos criados'
                  }}</span>
                </div>
                <div class="importar__numero">
                  <b>{{ puladas() }}</b><span>{{
                    puladas() === 1 ? 'linha pulada' : 'linhas puladas'
                  }}</span>
                </div>
                <div class="importar__numero">
                  <b>{{ paraCorrigir() }}</b><span>para corrigir</span>
                </div>
              </div>
              @if (relatorio.linhas.length > 0) {
                <div class="importar__rolagem">
                  <div class="importar__grade">
                    <div class="importar__linha importar__linha--relatorio importar__linha--titulo">
                      <span>Linha</span><span>Aluno</span><span>CPF</span><span>Situação</span
                      ><span>Motivo</span>
                    </div>
                    @for (linha of relatorio.linhas; track linha.linha) {
                      <div class="importar__linha importar__linha--relatorio">
                        <span>{{ linha.linha }}</span>
                        <span>{{ linha.nome || '—' }}</span>
                        <span>{{ linha.cpf || '—' }}</span>
                        <span>
                          <ui-badge [variant]="linha.situacao === 'pulada' ? 'late' : 'soon'">
                            {{ linha.situacao === 'pulada' ? 'Pulada' : 'Para corrigir' }}
                          </ui-badge>
                        </span>
                        <span>{{ linha.motivo }}</span>
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <p class="importar__vazio">Nenhuma linha precisa de correção.</p>
              }
              <div class="importar__rodape">
                <div class="importar__acoes">
                  <ui-button size="lg" variant="outline" (click)="baixarRelatorio()">
                    Baixar relatório
                  </ui-button>
                  <div class="importar__acoes">
                    <ui-button size="lg" variant="outline" (click)="store.recomecar()">
                      Importar outra planilha
                    </ui-button>
                    <ui-button size="lg" variant="accent" routerLink="/alunos">
                      Ver lista de alunos
                    </ui-button>
                  </div>
                </div>
              </div>
            }
          }
        }
      </section>
    </div>
  `,
})
export class ImportarPage {
  protected readonly store = inject(ImportacaoStore);
  private readonly toast = inject(ToastService);

  protected readonly passos = PASSOS;
  protected readonly tiposAceitos = ['.xlsx', '.csv'];
  protected readonly tamanhoMaximo = TAMANHO_MAXIMO_EM_BYTES;
  protected readonly opcoesDeDestino = OPCOES_DE_DESTINO;

  /** Uma linha por coluna da planilha, com um exemplo (o primeiro valor preenchido). */
  protected readonly colunas = computed(() => {
    const planilha = this.store.planilha();
    const mapa = this.store.mapa();
    return (planilha?.cabecalhos ?? []).map((cabecalho, indice) => ({
      indice,
      cabecalho,
      exemplo:
        planilha?.linhas.map((linha) => linha[indice] ?? '').find((texto) => texto !== '') ?? '',
      destino: mapa[indice] ?? ('' as Destino),
    }));
  });
  protected readonly textoDoBotao = computed(() => {
    const total = this.store.aImportar();
    if (this.store.importando()) {
      const progresso = this.store.progresso();
      return progresso ? `Importando ${progresso.feitas} de ${progresso.total}` : 'Importando';
    }
    return total === 1 ? 'Importar 1 aluno' : `Importar ${total} alunos`;
  });
  protected readonly avisoDasLinhas = computed(() => {
    const invalidas = this.store.comCpfInvalido();
    const planos = this.store.planosFaltando().length;
    const partes: string[] = [];
    if (invalidas > 0) {
      partes.push(
        invalidas === 1
          ? '1 linha com CPF inválido será pulada'
          : `${invalidas} linhas com CPF inválido serão puladas`,
      );
    }
    if (planos > 0) {
      partes.push(
        planos === 1
          ? '1 plano da planilha ainda não existe em Planos'
          : `${planos} planos da planilha ainda não existem em Planos`,
      );
    }
    return partes.length > 0
      ? `${partes.join(' e ')}. Você recebe a lista para corrigir depois.`
      : null;
  });
  protected readonly puladas = computed(
    () => this.store.relatorio()?.linhas.filter((linha) => linha.situacao === 'pulada').length ?? 0,
  );
  protected readonly paraCorrigir = computed(
    () =>
      this.store.relatorio()?.linhas.filter((linha) => linha.situacao === 'para_corrigir').length ??
      0,
  );

  protected escolher(coluna: number, valor: string): void {
    this.store.escolherDestino(coluna, valor as Destino);
  }

  /** Modelo `.xlsx` com cabeçalhos que o mapeamento automático reconhece e CPFs válidos de exemplo. */
  protected async baixarModelo(): Promise<void> {
    try {
      const { default: escrever } = await import('write-excel-file/browser');
      const dados = MODELO_DE_PLANILHA.map((linha, indice) =>
        linha.map((valor) =>
          indice === 0 ? { value: valor, fontWeight: 'bold' as const } : { value: valor },
        ),
      );
      const blob = await escrever(dados, {
        columns: MODELO_DE_PLANILHA[0]?.map(() => ({ width: 22 })) ?? [],
      }).toBlob();
      baixarBlob('modelo-de-alunos.xlsx', blob);
    } catch {
      this.toast.show({ message: 'Não foi possível gerar o modelo.', tone: 'error' });
    }
  }

  protected baixarRelatorio(): void {
    const relatorio = this.store.relatorio();
    if (!relatorio) {
      return;
    }
    const linhas = relatorio.linhas.map((linha) =>
      [
        String(linha.linha),
        linha.nome,
        linha.cpf,
        linha.situacao === 'pulada' ? 'Pulada' : 'Para corrigir',
        linha.motivo,
      ]
        .map(celulaDeCsv)
        .join(';'),
    );
    baixarTexto(
      'relatorio-da-importacao.csv',
      ['Linha;Aluno;CPF;Situação;Motivo', ...linhas].join('\r\n'),
    );
  }
}
