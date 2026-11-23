import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Field } from '../field/field';
import { Select, type SelectOption } from './select';

const planos: SelectOption[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual', disabled: true },
];

@Component({
  imports: [Select, Field],
  template: `<ui-field label="Plano" hint="Escolha um plano">
    <ui-select [options]="planos" [(value)]="valor" placeholder="Todos" />
  </ui-field>`,
})
class Host {
  planos = planos;
  valor = '';
}

function setup(valor = '') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.valor = valor;
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host: fixture.componentInstance,
    el,
    select: el.querySelector<HTMLSelectElement>('select')!,
  };
}

describe('Select', () => {
  it('lista o placeholder e as opções', () => {
    const { select } = setup();

    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      'Todos',
      'Mensal',
      'Trimestral',
      'Anual',
    ]);
  });

  it('opção desabilitada fica desabilitada', () => {
    expect(setup().select.options[3]?.disabled).toBe(true);
  });

  it('escolher uma opção devolve o valor ao pai', () => {
    const { host, select } = setup();

    select.value = 'trimestral';
    select.dispatchEvent(new Event('change'));

    expect(host.valor).toBe('trimestral');
  });

  it('o valor do pai seleciona a opção', () => {
    expect(setup('mensal').select.value).toBe('mensal');
  });

  it('voltar ao placeholder devolve texto vazio', () => {
    const { host, select } = setup('mensal');

    select.value = '';
    select.dispatchEvent(new Event('change'));

    expect(host.valor).toBe('');
  });

  it('dentro de um Field, herda rótulo e descrição', () => {
    const { el, select } = setup();

    expect(el.querySelector('label')?.getAttribute('for')).toBe(select.id);
    expect(select.getAttribute('aria-describedby')).toContain('ui-field-');
  });
});
