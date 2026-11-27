import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  KeyboardSafe,
  MascaraBrl,
  MascaraCpf,
  mensagemVisivel,
  PERMISSION_CHECKER,
  Validadores,
} from '@gymos/shared-forms';
import { BrlPipe, DataBrPipe, PercentualPipe } from '@gymos/shared-pipes';
import {
  Button,
  ErrorState,
  Field,
  FieldControl,
  NoPermissionState,
  PageHeader,
  Skeleton,
  ToastService,
  Toggle,
} from '@gymos/ui';
import { ESTILOS_DO_FINANCEIRO } from '../components/estilos-do-financeiro';
import { EmitirNotaStore } from '../data-access/emitir-nota.store';
import type { ItemDaListaDeAlunos, TipoDeNota } from '../models/notas';

const TIPOS: ReadonlyArray<{ tipo: TipoDeNota; titulo: string; descricao: string }> = [
  { tipo: 'nfse', titulo: 'NFS-e (serviço)', descricao: 'Mensalidades, planos, aulas, personal' },
  { tipo: 'nfce', titulo: 'NFC-e (produto)', descricao: 'Vendas da Loja' },
];

const FALHA = 'Não foi possível emitir agora. Tente de novo em instantes.';

/** Financeiro › Notas fiscais › Emitir nota (`FinEmitir.html`), formulário longo com teclado seguro. */
@Component({
  selector: 'app-emitir-nota-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [EmitirNotaStore],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeader,
    Button,
    Field,
    FieldControl,
    Toggle,
    Skeleton,
    ErrorState,
    NoPermissionState,
    KeyboardSafe,
    MascaraCpf,
    MascaraBrl,
    BrlPipe,
    DataBrPipe,
    PercentualPipe,
  ],
  styles: `
    ${ESTILOS_DO_FINANCEIRO}
    form {
      display: contents;
    }
    .emitir__trilha {
      font-size: 13px;
      color: var(--muted);
    }
    .emitir__trilha a {
      color: inherit;
      text-decoration: none;
    }
    .emitir__trilha b {
      color: var(--ink);
    }
    .emitir__principal {
      flex: 2 1 520px;
    }
    .emitir__lateral {
      flex: 1 1 300px;
    }
    .emitir__tipos {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .emitir__tipo {
      flex: 1 1 220px;
      box-sizing: border-box;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      cursor: pointer;
    }
    .emitir__tipo:has(input:checked) {
      border: 2px solid var(--accent);
      background: color-mix(in srgb, var(--accent) 7%, var(--surface));
    }
    .emitir__tipo:has(input:focus-visible) {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .emitir__tipo input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .emitir__tipo b {
      font-size: 14px;
    }
    .emitir__tipo div,
    .emitir__sub {
      margin-top: 2px;
      font-size: 12px;
      color: var(--muted);
    }
    .emitir__campos {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .emitir__linha {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .emitir__linha > * {
      flex: 1 1 150px;
      min-width: 0;
    }
    .emitir__linha > .emitir__curto {
      flex: 1 1 110px;
    }
    .emitir__linha > .emitir__largo {
      flex: 1 1 240px;
    }
    .emitir__campo,
    .emitir__leitura {
      box-sizing: border-box;
      width: 100%;
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 14px;
    }
    .emitir__leitura {
      display: flex;
      align-items: center;
    }
    .emitir__rotulo {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .emitir__busca {
      position: relative;
    }
    .emitir__sugestoes {
      position: absolute;
      z-index: 5;
      left: 0;
      right: 0;
      margin: 4px 0 0;
      padding: 4px;
      list-style: none;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
    }
    .emitir__sugestoes button {
      width: 100%;
      min-height: 40px;
      padding: 0 10px;
      border: 0;
      border-radius: 8px;
      background: none;
      color: var(--ink);
      font: inherit;
      font-size: 14px;
      text-align: left;
      cursor: pointer;
    }
    .emitir__sugestoes button:hover,
    .emitir__sugestoes button:focus-visible {
      background: var(--page);
    }
    .emitir__total {
      font-size: 16px;
      font-weight: var(--font-weight-bold);
    }
    .emitir__total > span:first-child {
      color: var(--ink);
    }
    .emitir__resumo {
      margin-top: -6px;
    }
    .emitir__depois {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
    }
    .emitir__titulo {
      font-size: 14px;
      font-weight: var(--font-weight-semibold);
    }
    .emitir__depois + .emitir__depois {
      border-top: 1px solid var(--divider);
    }
    .emitir__rodape {
      display: none;
    }
    /* Celular e tablet: o botão de emitir acompanha o teclado (--teclado-altura, T10). */
    @media (max-width: 1023px) {
      .emitir__rodape {
        position: sticky;
        bottom: var(--teclado-altura, 0px);
        z-index: 4;
        display: block;
        padding: 12px 0;
        background: var(--page);
      }
    }
  `,
  template: `
    <nav class="emitir__trilha" aria-label="Você está em">
      <a routerLink="/financeiro">Financeiro</a> &#8250;
      <a routerLink="/financeiro/notas-fiscais">Notas fiscais</a> &#8250;
      <b aria-current="page">Emitir nota</b>
    </nav>
    <ui-page-header
      heading="Emitir nota fiscal"
      subtitle="Confira os dados e emita a nota em poucos cliques."
    >
      <div actions>
        <ui-button variant="outline" (click)="voltar()">Cancelar</ui-button>
        <ui-button variant="accent" [loading]="emitindo()" (click)="emitir()"
          >Emitir nota</ui-button
        >
      </div>
    </ui-page-header>

    @if (!podeEmitir) {
      <ui-no-permission-state />
    } @else {
      <form appKeyboardSafe novalidate [formGroup]="form" (ngSubmit)="emitir()">
        <div class="fin-grade">
          <div class="fin-grade__principal emitir__principal">
            <section class="fin-cartao" aria-labelledby="tipo-de-nota">
              <div class="fin-cartao__topo">
                <div>
                  <h2 id="tipo-de-nota">Tipo de nota</h2>
                  <p class="fin-cartao__sub">Escolha o que está sendo cobrado</p>
                </div>
              </div>
              <fieldset class="emitir__tipos">
                <legend class="ui-sr-only">Tipo de nota</legend>
                @for (opcao of tipos; track opcao.tipo) {
                  <label class="emitir__tipo">
                    <input type="radio" formControlName="tipo" [value]="opcao.tipo" />
                    <b>{{ opcao.titulo }}</b>
                    <div>{{ opcao.descricao }}</div>
                  </label>
                }
              </fieldset>
            </section>

            <section class="fin-cartao" aria-labelledby="cliente">
              <div class="fin-cartao__topo">
                <div>
                  <h2 id="cliente">Cliente</h2>
                  <p class="fin-cartao__sub">Dados do aluno vêm do cadastro</p>
                </div>
              </div>
              <div class="emitir__campos">
                <div class="emitir__linha">
                  <div class="emitir__largo emitir__busca">
                    <ui-field label="Aluno" [error]="erros().aluno">
                      <input
                        uiFieldControl
                        class="emitir__campo"
                        formControlName="busca"
                        autocomplete="off"
                        enterkeyhint="next"
                        (input)="buscar()"
                      />
                    </ui-field>
                    @if (store.alunos().length > 0) {
                      <ul class="emitir__sugestoes" aria-label="Alunos encontrados">
                        @for (aluno of store.alunos(); track aluno.id) {
                          <li>
                            <button type="button" (click)="escolher(aluno)">
                              {{ aluno.nome }}
                            </button>
                          </li>
                        }
                      </ul>
                    }
                  </div>
                  <ui-field label="CPF" [error]="erros().cpf">
                    <input uiFieldControl appCpf class="emitir__campo" formControlName="cpf" />
                  </ui-field>
                </div>
                <div class="emitir__linha">
                  <div class="emitir__largo">
                    <span class="emitir__rotulo">E-mail</span>
                    <div class="emitir__leitura">{{ cliente()?.email ?? '—' }}</div>
                  </div>
                  <div>
                    <span class="emitir__rotulo">Telefone</span>
                    <div class="emitir__leitura">{{ cliente()?.telefone ?? '—' }}</div>
                  </div>
                </div>
              </div>
            </section>

            <section class="fin-cartao" aria-labelledby="servico">
              <div class="fin-cartao__topo">
                <div>
                  <h2 id="servico">Serviço</h2>
                  <p class="fin-cartao__sub">Preenchido a partir da mensalidade em aberto</p>
                </div>
              </div>
              @if (store.estado() === 'carregando') {
                <ui-skeleton height="180px" />
              } @else if (store.estado() === 'erro') {
                <ui-error-state
                  heading="Não foi possível carregar os dados do aluno"
                  (retry)="preencher()"
                />
              } @else {
                <div class="emitir__campos">
                  <ui-field label="Descrição" [error]="erros().descricao">
                    <input
                      uiFieldControl
                      class="emitir__campo"
                      formControlName="descricao"
                      enterkeyhint="next"
                    />
                  </ui-field>
                  <div class="emitir__linha">
                    <div class="emitir__largo">
                      <span class="emitir__rotulo">Código do serviço</span>
                      <div class="emitir__leitura">{{ previa()?.codigoDoServico || '—' }}</div>
                    </div>
                    <ui-field class="emitir__curto" label="Valor" [error]="erros().valor">
                      <input
                        uiFieldControl
                        appBrl
                        class="emitir__campo"
                        formControlName="valorCentavos"
                        enterkeyhint="done"
                      />
                    </ui-field>
                    <div class="emitir__curto">
                      <span class="emitir__rotulo">Competência</span>
                      <div class="emitir__leitura">{{ servico()?.competenciaExibida ?? '—' }}</div>
                    </div>
                  </div>
                  <div class="emitir__linha">
                    <div>
                      <span class="emitir__rotulo">Forma de pagamento</span>
                      <div class="emitir__leitura">{{ servico()?.formaDePagamento ?? '—' }}</div>
                    </div>
                    <div>
                      <span class="emitir__rotulo">Data de emissão</span>
                      <div class="emitir__leitura">{{ dataDeEmissao() | dateBr }}</div>
                    </div>
                  </div>
                </div>
              }
            </section>
          </div>

          <div class="fin-grade__lateral emitir__lateral">
            <section class="fin-cartao" aria-labelledby="resumo-da-nota">
              <div class="fin-cartao__topo">
                <div>
                  <h2 id="resumo-da-nota">Resumo da nota</h2>
                  <p class="fin-cartao__sub">Prévia antes de emitir</p>
                </div>
              </div>
              @let resumo = previa();
              <div class="emitir__resumo">
                <div class="fin-linha-de-valor">
                  <span>Valor do serviço</span><span>{{ resumo?.valorCentavos ?? 0 | brl }}</span>
                </div>
                <div class="fin-linha-de-valor">
                  <span>ISS ({{ resumo?.aliquotaIssPontosBase ?? 0 | percent }})</span
                  ><span>{{ resumo?.issCentavos ?? 0 | brl }}</span>
                </div>
                <div class="fin-linha-de-valor">
                  <span>Retenções</span><span>{{ resumo?.retencoesCentavos ?? 0 | brl }}</span>
                </div>
                <div class="fin-linha-de-valor emitir__total">
                  <span>Total da nota</span><span>{{ resumo?.totalCentavos ?? 0 | brl }}</span>
                </div>
              </div>
              @if (resumo?.dadosFiscaisConferidos === false) {
                <div class="fin-aviso fin-aviso--alerta" role="status">
                  Preencha os dados fiscais em Configurações antes de emitir.
                </div>
              } @else {
                <div class="fin-aviso fin-aviso--ok">Dados fiscais da academia conferidos</div>
              }
            </section>

            <section class="fin-cartao" aria-labelledby="depois-de-emitir">
              <div class="fin-cartao__topo">
                <div><h2 id="depois-de-emitir">Depois de emitir</h2></div>
              </div>
              <div class="emitir__depois">
                <div aria-hidden="true">
                  <div class="emitir__titulo">Enviar ao aluno</div>
                  <div class="emitir__sub">Por e-mail e WhatsApp</div>
                </div>
                <ui-toggle
                  label="Enviar ao aluno por e-mail e WhatsApp"
                  [hideLabel]="true"
                  [(checked)]="enviarAoAluno"
                />
              </div>
              <div class="emitir__depois">
                <div aria-hidden="true">
                  <div class="emitir__titulo">Anexar PDF e XML</div>
                  <div class="emitir__sub">Junto com a mensagem</div>
                </div>
                <ui-toggle
                  label="Anexar PDF e XML junto com a mensagem"
                  [hideLabel]="true"
                  [(checked)]="anexarArquivos"
                />
              </div>
              <div class="emitir__depois">
                <div aria-hidden="true">
                  <div class="emitir__titulo">Registrar na ficha do aluno</div>
                  <div class="emitir__sub">Aparece no financeiro dele</div>
                </div>
                <ui-toggle
                  label="Registrar na ficha do aluno"
                  [hideLabel]="true"
                  [(checked)]="registrarNaFicha"
                />
              </div>
            </section>
          </div>
        </div>

        <div class="emitir__rodape" data-testid="rodape-de-emissao">
          <ui-button type="submit" variant="accent" size="xl" [block]="true" [loading]="emitindo()">
            Emitir nota
          </ui-button>
        </div>
      </form>
    }
  `,
})
export class EmitirNotaPage {
  protected readonly store = inject(EmitirNotaStore);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  protected readonly podeEmitir = inject(PERMISSION_CHECKER).pode('financeiro:criar');
  protected readonly tipos = TIPOS;

  protected readonly form = new FormGroup({
    tipo: new FormControl<TipoDeNota>('nfse', { nonNullable: true }),
    busca: new FormControl('', { nonNullable: true }),
    cpf: new FormControl<string | null>(null, [Validators.required, Validadores.cpf]),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    valorCentavos: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
  });

  protected readonly enviarAoAluno = signal(true);
  protected readonly anexarArquivos = signal(true);
  protected readonly registrarNaFicha = signal(true);
  protected readonly emitindo = signal(false);
  private readonly enviado = signal(false);
  private readonly alunoId = signal<string | null>(this.rota.snapshot.queryParamMap.get('alunoId'));

  protected readonly cliente = computed(() => this.store.sugestao()?.cliente ?? null);
  protected readonly servico = computed(() => this.store.sugestao()?.servico ?? null);
  protected readonly previa = computed(() => this.store.previa());
  protected readonly dataDeEmissao = computed(() => this.store.sugestao()?.dataDeEmissao ?? null);

  private readonly eventos = toSignal(this.form.events, { initialValue: null });
  private readonly tipo = toSignal(this.form.controls.tipo.valueChanges, { initialValue: 'nfse' });
  protected readonly erros = computed(() => {
    this.eventos();
    const enviado = this.enviado();
    const { cpf, descricao, valorCentavos } = this.form.controls;
    return {
      aluno: enviado && !this.alunoId() ? 'Escolha o aluno.' : undefined,
      cpf: mensagemVisivel(cpf, enviado) ?? undefined,
      descricao: mensagemVisivel(descricao, enviado) ?? undefined,
      valor: enviado && valorCentavos.invalid ? 'Informe o valor da nota.' : undefined,
    };
  });

  constructor() {
    // Cliente ou tipo mudou: preenche de novo a partir do cadastro e da mensalidade em aberto.
    effect(() => {
      const alunoId = this.alunoId();
      const tipo = this.tipo();
      if (alunoId && this.podeEmitir) {
        this.store.preencher(alunoId, tipo);
      }
    });
    effect(() => {
      const sugestao = this.store.sugestao();
      if (sugestao) {
        this.form.patchValue({
          busca: sugestao.cliente.nome,
          cpf: sugestao.cliente.cpf.replace(/\D/g, ''),
          descricao: sugestao.servico.descricao,
          valorCentavos: sugestao.servico.valorCentavos || null,
        });
      }
    });
    this.form.controls.valorCentavos.valueChanges.subscribe((valor) =>
      this.store.atualizarValor(valor ?? 0),
    );
  }

  protected buscar(): void {
    this.alunoId.set(null);
    this.store.buscarAlunos(this.form.controls.busca.value);
  }

  protected escolher(aluno: ItemDaListaDeAlunos): void {
    this.store.limparAlunos();
    this.form.controls.busca.setValue(aluno.nome);
    this.alunoId.set(aluno.id);
  }

  protected preencher(): void {
    const alunoId = this.alunoId();
    if (alunoId) {
      this.store.preencher(alunoId, this.form.controls.tipo.value);
    }
  }

  protected voltar(): void {
    void this.router.navigate(['..'], { relativeTo: this.rota });
  }

  protected emitir(): void {
    this.enviado.set(true);
    const alunoId = this.alunoId();
    const sugestao = this.store.sugestao();
    const { tipo, cpf, descricao, valorCentavos } = this.form.getRawValue();
    if (this.form.invalid || !alunoId || !sugestao || !cpf || !valorCentavos || this.emitindo()) {
      return;
    }
    this.emitindo.set(true);
    this.store
      .emitir({
        tipo,
        alunoId,
        cpf,
        descricao: descricao.trim(),
        valorCentavos,
        competencia: sugestao.servico.competencia,
        ...(sugestao.servico.parcelaId ? { parcelaId: sugestao.servico.parcelaId } : {}),
        ...(sugestao.servico.formaDePagamento
          ? { formaDePagamento: sugestao.servico.formaDePagamento }
          : {}),
        enviarAoAluno: this.enviarAoAluno(),
        anexarArquivos: this.anexarArquivos(),
        registrarNaFicha: this.registrarNaFicha(),
      })
      .subscribe({
        next: (nota) => {
          this.emitindo.set(false);
          this.toast.show({
            message:
              nota.situacao === 'emitida'
                ? `Nota ${nota.rotulo ?? ''} emitida.`
                : nota.situacao === 'rejeitada'
                  ? `O emissor recusou a nota: ${nota.atencao}`
                  : 'Nota enviada ao emissor; a resposta chega em instantes.',
            tone: nota.situacao === 'rejeitada' ? 'error' : 'success',
          });
          this.voltar();
        },
        error: (falha: unknown) => {
          this.emitindo.set(false);
          const mensagem =
            falha instanceof HttpErrorResponse && falha.status === 422
              ? String((falha.error as { message?: string } | null)?.message ?? FALHA)
              : FALHA;
          this.toast.show({ message: mensagem, tone: 'error' });
        },
      });
  }
}
