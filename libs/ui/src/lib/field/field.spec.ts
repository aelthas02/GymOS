import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Field, FieldControl } from './field';

@Component({
  imports: [Field, FieldControl],
  template: `<ui-field [label]="'E-mail'" [hint]="hint" [error]="error">
    <input uiFieldControl type="email" />
  </ui-field>`,
})
class Host {
  hint: string | undefined = 'Usamos para enviar o recibo.';
  error: string | undefined;
}

function setup(patch: Partial<Host> = {}) {
  const fixture = TestBed.createComponent(Host);
  Object.assign(fixture.componentInstance, patch);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector('input')!;
  const ids = () => (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
  return { fixture, host: fixture.componentInstance, el, input, ids };
}

describe('Field', () => {
  it('o rótulo aponta para o controle', () => {
    const { el, input } = setup();

    expect(input.id).not.toBe('');
    expect(el.querySelector('label')?.getAttribute('for')).toBe(input.id);
    expect(el.querySelector('label')?.textContent).toContain('E-mail');
  });

  it('a dica descreve o controle por aria-describedby', () => {
    const { el, ids } = setup();
    const dica = el.querySelector('.ui-field__hint')!;

    expect(dica.textContent).toContain('Usamos para enviar o recibo.');
    expect(ids()).toEqual([dica.id]);
  });

  it('o erro entra em aria-describedby, marca aria-invalid e é anunciado', () => {
    const { fixture, host, el, input, ids } = setup();

    host.error = 'Informe um e-mail válido';
    fixture.componentRef.changeDetectorRef.detectChanges();
    fixture.detectChanges();

    const erro = el.querySelector('.ui-field__error')!;
    expect(erro.textContent).toContain('Informe um e-mail válido');
    expect(erro.getAttribute('role')).toBe('alert');
    expect(ids()).toContain(erro.id);
    expect(ids()).toHaveLength(2);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('sem erro, o controle não é inválido', () => {
    expect(setup().input.getAttribute('aria-invalid')).toBeNull();
  });

  it('sem dica nem erro, não há aria-describedby', () => {
    const { input } = setup({ hint: undefined });
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('dois campos não repartem ids', () => {
    const a = setup();
    const b = setup();
    expect(a.input.id).not.toBe(b.input.id);
  });
});
