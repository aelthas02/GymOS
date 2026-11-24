import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EmptyState, PageHeader } from '@gymos/ui';

/** Tela provisória das features: o dono troca a rota pela tela real na sua própria linha. */
@Component({
  selector: 'app-em-construcao-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, EmptyState],
  template: `
    <ui-page-header [heading]="titulo" />
    <ui-empty-state heading="Em construção" description="Esta área ainda não está disponível." />
  `,
})
export class EmConstrucaoPage {
  protected readonly titulo = String(inject(ActivatedRoute).snapshot.data['titulo'] ?? '');
}
