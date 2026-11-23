import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Tabs, type TabItem } from './tabs';

const itens: TabItem[] = [
  { label: 'Lista de alunos', link: '/alunos' },
  { label: 'Importar alunos', link: '/alunos/importar' },
  { label: 'Acompanhamento', link: '/alunos/acompanhamento', count: 3 },
];

@Component({
  imports: [Tabs],
  template: `<ui-tabs [items]="itens" label="Alunos" />`,
})
class Pagina {
  itens = itens;
}

async function setup(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'alunos', component: Pagina },
        { path: 'alunos/importar', component: Pagina },
        { path: 'alunos/acompanhamento', component: Pagina },
        { path: 'fora', component: Pagina },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, Pagina);
  harness.detectChanges();
  const el = harness.fixture.nativeElement as HTMLElement;
  const abas = () => [...el.querySelectorAll<HTMLAnchorElement>('[role=tab]')];
  return { harness, el, abas };
}

const tecla = (alvo: HTMLElement, key: string) => {
  const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  alvo.dispatchEvent(evento);
  return evento;
};

describe('Tabs', () => {
  it('é uma lista de abas nomeada, com links de verdade', async () => {
    const { el, abas } = await setup('/alunos');

    expect(el.querySelector('[role=tablist]')?.getAttribute('aria-label')).toBe('Alunos');
    expect(abas().map((a) => a.getAttribute('href'))).toEqual([
      '/alunos',
      '/alunos/importar',
      '/alunos/acompanhamento',
    ]);
    expect(abas()[2]?.textContent).toContain('3');
  });

  it('a aba ativa vem do router, e só ela tem aria-selected', async () => {
    const { abas } = await setup('/alunos/importar');

    expect(abas().map((a) => a.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('a navegação do router troca a aba ativa', async () => {
    const { harness, abas } = await setup('/alunos');

    await harness.navigateByUrl('/alunos/acompanhamento', Pagina);
    harness.detectChanges();

    expect(abas().map((a) => a.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
  });

  it('só a aba ativa entra na ordem do Tab (tabindex 0)', async () => {
    const { abas } = await setup('/alunos/importar');

    expect(abas().map((a) => a.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('sem aba ativa, a primeira continua alcançável pelo teclado', async () => {
    const { abas } = await setup('/fora');

    expect(abas().map((a) => a.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false']);
    expect(abas().map((a) => a.tabIndex)).toEqual([0, -1, -1]);
  });

  it('a rota de uma aba não ativa a vizinha que só começa igual', async () => {
    const { abas } = await setup('/alunos/importar');

    expect(abas()[0]?.getAttribute('aria-selected')).toBe('false');
  });

  it('seta direita e esquerda movem o foco, com volta ao fim e ao início', async () => {
    const { abas } = await setup('/alunos');
    abas()[0]?.focus();

    expect(tecla(abas()[0]!, 'ArrowRight').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(abas()[1]);

    tecla(abas()[1]!, 'ArrowRight');
    tecla(abas()[2]!, 'ArrowRight');
    expect(document.activeElement).toBe(abas()[0]);

    tecla(abas()[0]!, 'ArrowLeft');
    expect(document.activeElement).toBe(abas()[2]);
  });

  it('Home vai à primeira e End à última', async () => {
    const { abas } = await setup('/alunos/importar');
    abas()[1]?.focus();

    tecla(abas()[1]!, 'End');
    expect(document.activeElement).toBe(abas()[2]);

    tecla(abas()[2]!, 'Home');
    expect(document.activeElement).toBe(abas()[0]);
  });

  it('mover o foco não navega: a seleção só muda pelo router', async () => {
    const { abas } = await setup('/alunos');
    abas()[0]?.focus();

    tecla(abas()[0]!, 'ArrowRight');

    expect(abas()[0]?.getAttribute('aria-selected')).toBe('true');
    expect(abas()[1]?.getAttribute('aria-selected')).toBe('false');
  });

  it('outras teclas seguem o comportamento normal', async () => {
    const { abas } = await setup('/alunos');

    expect(tecla(abas()[0]!, 'a').defaultPrevented).toBe(false);
    expect(tecla(abas()[0]!, 'Enter').defaultPrevented).toBe(false);
  });
});
