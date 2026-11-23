import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Chips, type ChipOption } from './chips';

const opcoes: ChipOption[] = [
  { value: 'todos', label: 'Todos', count: 312 },
  { value: 'em-dia', label: 'Em dia', count: 289 },
  { value: 'a-vencer', label: 'A vencer', count: 11 },
  { value: 'em-atraso', label: 'Em atraso', count: 12 },
];

@Component({
  imports: [Chips],
  template: `<ui-chips
    [options]="opcoes"
    [multiple]="multiplo"
    [(values)]="sel"
    label="Situação"
  />`,
})
class Host {
  opcoes = opcoes;
  multiplo = true;
  sel: string[] = [];
}

function setup(patch: Partial<Host> = {}) {
  const fixture = TestBed.createComponent(Host);
  Object.assign(fixture.componentInstance, patch);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const botoes = () => [...el.querySelectorAll<HTMLButtonElement>('button')];
  return { fixture, host: fixture.componentInstance, el, botoes };
}

describe('Chips', () => {
  it('é um grupo nomeado de botões com contador', () => {
    const { el, botoes } = setup();

    expect(el.querySelector('[role=group]')?.getAttribute('aria-label')).toBe('Situação');
    expect(botoes().map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Todos 312',
      'Em dia 289',
      'A vencer 11',
      'Em atraso 12',
    ]);
  });

  it('seleção múltipla: marca vários e aria-pressed acompanha', () => {
    const { fixture, host, botoes } = setup();

    botoes()[1]?.click();
    botoes()[3]?.click();
    fixture.detectChanges();

    expect(host.sel).toEqual(['em-dia', 'em-atraso']);
    expect(botoes().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
      'true',
    ]);
  });

  it('clicar de novo desmarca', () => {
    const { host, botoes } = setup({ sel: ['em-dia'] });

    botoes()[1]?.click();

    expect(host.sel).toEqual([]);
  });

  it('seleção única: marcar outro troca o anterior', () => {
    const { host, botoes } = setup({ multiplo: false, sel: ['todos'] });

    botoes()[2]?.click();

    expect(host.sel).toEqual(['a-vencer']);
  });

  it('não altera o array recebido', () => {
    const original = ['em-dia'];
    const { host, botoes } = setup({ sel: original });

    botoes()[2]?.click();

    expect(original).toEqual(['em-dia']);
    expect(host.sel).toEqual(['em-dia', 'a-vencer']);
  });

  it('opção sem contador não mostra o número', () => {
    const fixture = TestBed.createComponent(Chips);
    fixture.componentRef.setInput('options', [{ value: 'a', label: 'Só texto' }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.ui-chip__count')).toBeNull();
  });

  it('contador zero ainda aparece', () => {
    const fixture = TestBed.createComponent(Chips);
    fixture.componentRef.setInput('options', [{ value: 'a', label: 'Vazio', count: 0 }]);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.ui-chip__count')?.textContent,
    ).toBe('0');
  });
});
