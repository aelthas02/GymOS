import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Toggle } from './toggle';

@Component({
  imports: [Toggle],
  template: `<ui-toggle [(checked)]="ativo" [disabled]="desabilitado" label="Receber avisos" />`,
})
class Host {
  ativo = signal(false);
  desabilitado = false;
}

function setup(patch: Partial<Host> = {}) {
  const fixture = TestBed.createComponent(Host);
  Object.assign(fixture.componentInstance, patch);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const sw = el.querySelector<HTMLButtonElement>('[role=switch]')!;
  return { fixture, host: fixture.componentInstance, sw };
}

const tecla = (key: string, type: 'keydown' | 'keyup' = 'keydown') =>
  new KeyboardEvent(type, { key, bubbles: true, cancelable: true });

describe('Toggle', () => {
  it('é um switch com o nome vindo do rótulo', () => {
    const { sw } = setup();

    expect(sw.getAttribute('role')).toBe('switch');
    expect(sw.textContent).toContain('Receber avisos');
  });

  it('aria-checked reflete o modelo, nos dois sentidos', () => {
    const { fixture, host, sw } = setup();
    expect(sw.getAttribute('aria-checked')).toBe('false');

    host.ativo.set(true);
    fixture.detectChanges();

    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('Espaço alterna o valor e o devolve ao pai', () => {
    const { fixture, host, sw } = setup();

    sw.dispatchEvent(tecla(' '));
    fixture.detectChanges();

    expect(host.ativo()).toBe(true);
    expect(sw.getAttribute('aria-checked')).toBe('true');

    sw.dispatchEvent(tecla(' '));
    expect(host.ativo()).toBe(false);
  });

  it('Espaço não rola a página nem dispara um segundo clique ao soltar', () => {
    const { sw } = setup();

    const down = tecla(' ');
    const up = tecla(' ', 'keyup');
    sw.dispatchEvent(down);
    sw.dispatchEvent(up);

    expect(down.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
  });

  it('clique alterna uma única vez', () => {
    const { host, sw } = setup();

    sw.click();

    expect(host.ativo()).toBe(true);
  });

  it('desabilitado ignora clique e Espaço', () => {
    const { host, sw } = setup({ desabilitado: true });

    sw.click();
    sw.dispatchEvent(tecla(' '));

    expect(host.ativo()).toBe(false);
    expect(sw.disabled).toBe(true);
  });

  it('outras teclas não alternam', () => {
    const { host, sw } = setup();

    sw.dispatchEvent(tecla('a'));

    expect(host.ativo()).toBe(false);
  });
});
