import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Checkbox } from './checkbox';

@Component({
  imports: [Checkbox],
  template: `<ui-checkbox [(checked)]="marcado" [indeterminate]="parcial" [disabled]="desabilitado"
    >Selecionar Rafael Souza</ui-checkbox
  >`,
})
class Host {
  marcado = false;
  parcial = false;
  desabilitado = false;
}

function setup(patch: Partial<Host> = {}) {
  const fixture = TestBed.createComponent(Host);
  Object.assign(fixture.componentInstance, patch);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    el,
    input: el.querySelector<HTMLInputElement>('input[type=checkbox]')!,
  };
}

describe('Checkbox', () => {
  it('o texto projetado é o rótulo do input', () => {
    const { el, input } = setup();

    expect(el.querySelector('label')?.contains(input)).toBe(true);
    expect(el.textContent).toContain('Selecionar Rafael Souza');
  });

  it('clicar marca e devolve o valor ao pai', () => {
    const { host, input } = setup();

    input.click();

    expect(input.checked).toBe(true);
    expect(host.marcado).toBe(true);
  });

  it('clicar no rótulo também alterna', () => {
    const { host, el } = setup();

    el.querySelector('label')!.click();

    expect(host.marcado).toBe(true);
  });

  it('o modelo do pai marca o input', () => {
    const { input } = setup({ marcado: true });
    expect(input.checked).toBe(true);
  });

  it('indeterminate vai para a propriedade do input e sai ao clicar', () => {
    const { fixture, host, input } = setup({ parcial: true });
    expect(input.indeterminate).toBe(true);

    input.click();
    fixture.detectChanges();

    expect(host.marcado).toBe(true);
    expect(input.indeterminate).toBe(false);
  });

  it('desabilitado não alterna', () => {
    const { host, input } = setup({ desabilitado: true });

    input.click();

    expect(host.marcado).toBe(false);
  });
});
