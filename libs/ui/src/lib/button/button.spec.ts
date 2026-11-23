import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button } from './button';

@Component({
  imports: [Button],
  template: `<ui-button
    [variant]="variant"
    [size]="size"
    [loading]="loading"
    [disabled]="disabled"
    type="submit"
    (click)="cliques = cliques + 1"
    >Salvar</ui-button
  >`,
})
class Host {
  variant: 'primary' | 'accent' | 'outline' | 'danger' = 'primary';
  size: 'sm' | 'md' | 'lg' = 'md';
  loading = false;
  disabled = false;
  cliques = 0;
}

function setup(patch: Partial<Host> = {}) {
  const fixture = TestBed.createComponent(Host);
  Object.assign(fixture.componentInstance, patch);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, el, button: el.querySelector('button')! };
}

describe('Button', () => {
  it('projeta o texto e repassa o type ao botão nativo', () => {
    const { button } = setup();

    expect(button.textContent).toContain('Salvar');
    expect(button.type).toBe('submit');
  });

  it.each(['primary', 'accent', 'outline', 'danger'] as const)('variante %s', (variant) => {
    expect(setup({ variant }).button.classList).toContain(`ui-button--${variant}`);
  });

  it.each(['sm', 'md', 'lg'] as const)('tamanho %s', (size) => {
    expect(setup({ size }).button.classList).toContain(`ui-button--${size}`);
  });

  it('clique chega ao pai', () => {
    const { button, host } = setup();
    button.click();
    expect(host.cliques).toBe(1);
  });

  it('desabilitado não dispara clique', () => {
    const { button, host } = setup({ disabled: true });

    button.click();

    expect(button.disabled).toBe(true);
    expect(host.cliques).toBe(0);
  });

  it('carregando mostra o indicador, marca aria-busy e bloqueia o clique', () => {
    const { button, host, el } = setup({ loading: true });

    button.click();

    expect(el.querySelector('.ui-button__spinner')).not.toBeNull();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(true);
    expect(host.cliques).toBe(0);
  });

  it('sem carregar não tem spinner nem aria-busy', () => {
    const { button, el } = setup();

    expect(el.querySelector('.ui-button__spinner')).toBeNull();
    expect(button.getAttribute('aria-busy')).toBeNull();
  });
});
