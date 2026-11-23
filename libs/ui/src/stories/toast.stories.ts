import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '../lib/button/button';
import { ToastOutlet } from '../lib/toast/toast-outlet';
import { ToastService } from '../lib/toast/toast.service';

/** Demonstração: o app real chama `ToastService.show` de qualquer lugar. */
@Component({
  selector: 'ui-toast-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, ToastOutlet],
  template: `
    <div style="display:flex;gap:8px;padding:16px">
      <ui-button variant="outline" (click)="sucesso()">Salvar plano</ui-button>
      <ui-button variant="outline" (click)="erro()">Simular erro</ui-button>
    </div>
    <ui-toast-outlet />
  `,
})
class ToastDemo {
  private readonly toasts = inject(ToastService);

  constructor() {
    this.toasts.clear();
    this.toasts.show({ message: 'Plano salvo', tone: 'success', duration: 0 });
    this.toasts.show({
      message: 'Não foi possível salvar o plano',
      tone: 'error',
      duration: 0,
    });
  }

  protected sucesso(): void {
    this.toasts.show({ message: 'Plano salvo', tone: 'success' });
  }

  protected erro(): void {
    this.toasts.show({ message: 'Não foi possível salvar o plano', tone: 'error' });
  }
}

const meta: Meta<ToastDemo> = {
  title: 'Componentes/Toast',
  component: ToastDemo,
  decorators: [moduleMetadata({ imports: [ToastDemo] })],
};

export default meta;

type Story = StoryObj<ToastDemo>;

/** Aparecem até 3 por vez; o resto espera na fila. */
export const Avisos: Story = {
  render: () => ({ template: `<ui-toast-demo />` }),
};
