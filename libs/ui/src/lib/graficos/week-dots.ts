import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const INICIAIS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const NOMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/** Os sete dias da semana (S T Q Q S S D do app do aluno), com o acento nos dias em que houve treino. */
@Component({
  selector: 'ui-week-dots',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    ul {
      display: flex;
      justify-content: space-between;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .ui-dia {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--divider);
      color: var(--muted);
      font-size: 10px;
      font-weight: var(--font-weight-bold);
    }
    .ui-dia--ativo {
      background: var(--accent);
      color: var(--accent-contrast);
    }
  `,
  template: `
    <ul>
      @for (inicial of iniciais; track $index) {
        <li class="ui-dia" [class.ui-dia--ativo]="ativos()[$index]">
          <span aria-hidden="true">{{ inicial }}</span>
          <span class="ui-sr-only"
            >{{ nomes[$index] }}: {{ ativos()[$index] ? 'treinou' : 'não treinou' }}</span
          >
        </li>
      }
    </ul>
  `,
})
export class WeekDots {
  /** Um booleano por dia, de segunda a domingo; o que faltar conta como sem treino. */
  readonly ativos = input.required<readonly boolean[]>();

  protected readonly iniciais = INICIAIS;
  protected readonly nomes = NOMES;
}
