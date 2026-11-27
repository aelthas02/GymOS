import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button, SortableList } from '@gymos/ui';
import type { ExercicioEditavel } from '../models/treinos';
import type { EdicaoDeTreinos } from '../utils/edicao-de-treinos';
import { rotuloDoTreino } from '../utils/apresentacao';

/**
 * Treinos em abas com a lista reordenável de exercícios (`AlunosFicha.html`). É o mesmo editor da
 * ficha do aluno e do modelo: o estado mora em `EdicaoDeTreinos`.
 */
@Component({
  selector: 'app-editor-de-treinos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, SortableList],
  styles: `
    :host {
      display: block;
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      background: var(--surface);
    }
    .abas {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 14px 16px;
    }
    .aba {
      padding: 9px 16px;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-bold) 13px var(--font);
      cursor: pointer;
    }
    .aba[aria-selected='true'] {
      border-width: 0;
      border-color: var(--ink);
      background: var(--ink);
      color: var(--on-ink);
    }
    .aba:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    .rolagem {
      overflow-x: auto;
      border-top: 1px solid var(--divider);
    }
    .grade {
      min-width: 700px;
    }
    .linha,
    .cabecalho {
      display: grid;
      grid-template-columns: minmax(170px, 1.6fr) 64px 84px 96px 84px 120px 36px;
      gap: 8px;
      align-items: center;
    }
    .cabecalho {
      display: grid;
      grid-template-columns: 30px minmax(170px, 1.6fr) 64px 84px 96px 84px 120px 36px;
      padding: 10px 16px;
      color: var(--muted);
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .campo {
      width: 100%;
      min-width: 0;
      height: 40px;
      padding: 0 6px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-medium) 14px var(--font);
      text-align: center;
    }
    .campo--nome {
      padding: 0 10px;
      font-weight: var(--font-weight-semibold);
      text-align: left;
    }
    .campo:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 1px;
    }
    .remover {
      width: 36px;
      height: 36px;
      border: 1px solid var(--state-error-border);
      border-radius: 8px;
      background: var(--badge-late-bg);
      color: var(--badge-late-fg);
      font: var(--font-weight-bold) 16px var(--font);
      cursor: pointer;
    }
    .remover:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    :host ::ng-deep ui-sortable-list li .ui-sortable__alca {
      min-height: 40px;
    }
    :host ::ng-deep .aba ~ ui-button button,
    :host ::ng-deep .rodape ui-button button {
      min-height: 40px;
      padding: 0 15px;
    }
    :host ::ng-deep .abas ui-button button {
      min-height: 36px;
    }
    :host ::ng-deep .linha ui-button button {
      min-height: 40px;
      padding: 0 9px;
      font-size: 12px;
    }
    :host ::ng-deep li:has(.linha--selecionada) {
      background: color-mix(in srgb, var(--accent) 8%, var(--surface));
    }
    .rodape {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 14px 16px;
      border-top: 1px solid var(--divider);
    }
  `,
  template: `
    <div class="abas" role="tablist" aria-label="Treinos da ficha">
      @for (treino of edicao().treinos(); track treino; let i = $index) {
        <button
          type="button"
          role="tab"
          class="aba"
          [attr.aria-selected]="i === edicao().indice()"
          (click)="edicao().escolher(i)"
        >
          {{ rotulo(treino) }}
        </button>
      }
      <ui-button size="sm" variant="outline" (click)="edicao().adicionarTreino()"
        >+ Treino</ui-button
      >
    </div>
    <div class="rolagem">
      <div class="grade">
        <div class="cabecalho" aria-hidden="true">
          <span>#</span>
          <span>Exercício</span>
          <span>Séries</span>
          <span>Repetições</span>
          <span>Carga (kg)</span>
          <span>Descanso</span>
          <span>Movimento</span>
          <span></span>
        </div>
        @if (edicao().treinoAtual(); as treino) {
          <ui-sortable-list
            label="Exercícios do treino"
            [items]="treino.exercicios"
            [itemLabel]="nomeDoExercicio"
            (orderChange)="edicao().reordenar($event)"
          >
            <ng-template let-exercicio>
              <div class="linha" [class.linha--selecionada]="exercicio === edicao().selecionado()">
                <input
                  class="campo campo--nome"
                  aria-label="Exercício"
                  autocomplete="off"
                  enterkeyhint="next"
                  [value]="exercicio.nome"
                  (input)="editar(exercicio, 'nome', $event)"
                  (focus)="edicao().selecionado.set(exercicio)"
                />
                <input
                  class="campo"
                  aria-label="Séries"
                  inputmode="numeric"
                  enterkeyhint="next"
                  [value]="exercicio.series"
                  (input)="editar(exercicio, 'series', $event)"
                />
                <input
                  class="campo"
                  aria-label="Repetições"
                  inputmode="numeric"
                  enterkeyhint="next"
                  [value]="exercicio.repeticoes"
                  (input)="editar(exercicio, 'repeticoes', $event)"
                />
                <input
                  class="campo"
                  aria-label="Carga (kg)"
                  inputmode="decimal"
                  enterkeyhint="next"
                  [value]="exercicio.carga"
                  (input)="editar(exercicio, 'carga', $event)"
                />
                <input
                  class="campo"
                  aria-label="Descanso"
                  inputmode="numeric"
                  enterkeyhint="done"
                  [value]="exercicio.descanso"
                  (input)="editar(exercicio, 'descanso', $event)"
                />
                <ui-button size="sm" variant="outline" (click)="verMovimento.emit(exercicio)">
                  Ver movimento
                </ui-button>
                <button
                  type="button"
                  class="remover"
                  [attr.aria-label]="'Remover ' + (exercicio.nome || 'exercício')"
                  (click)="edicao().remover(exercicio)"
                >
                  &#215;
                </button>
              </div>
            </ng-template>
          </ui-sortable-list>
        }
      </div>
    </div>
    <div class="rodape">
      <ui-button variant="outline" (click)="edicao().adicionarExercicio()">
        + Adicionar exercício
      </ui-button>
      <ui-button variant="outline" (click)="abrirBiblioteca.emit()">
        Biblioteca de exercícios
      </ui-button>
    </div>
  `,
})
export class EditorDeTreinos {
  readonly edicao = input.required<EdicaoDeTreinos>();

  readonly verMovimento = output<ExercicioEditavel>();
  readonly abrirBiblioteca = output<void>();

  protected readonly rotulo = rotuloDoTreino;
  protected readonly nomeDoExercicio = (exercicio: ExercicioEditavel): string =>
    exercicio.nome || 'exercício';

  protected editar(
    exercicio: ExercicioEditavel,
    campo: 'nome' | 'series' | 'repeticoes' | 'carga' | 'descanso',
    evento: Event,
  ): void {
    exercicio[campo] = (evento.target as HTMLInputElement).value;
    this.edicao().editou();
  }
}
