import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BottomTabBar, type BottomTab } from './bottom-tab-bar';

const abas: BottomTab[] = [
  { label: 'Início', link: '/aluno', icon: 'home', exact: true },
  { label: 'Treino', link: '/aluno/treino', icon: 'dumbbell' },
  { label: 'Aulas', link: '/aluno/aulas', icon: 'calendar' },
  { label: 'Loja', link: '/aluno/loja', icon: 'bag' },
  { label: 'Mais', link: '/aluno/mais', icon: 'menu' },
];

@Component({
  imports: [BottomTabBar],
  template: `<ui-bottom-tab-bar [tabs]="abas" />`,
})
class Host {
  abas = abas;
}

async function setup(url: string) {
  TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: Host }])] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, Host);
  harness.detectChanges();
  const el = harness.fixture.nativeElement as HTMLElement;
  return { harness, el, links: () => [...el.querySelectorAll('a')] };
}

describe('BottomTabBar', () => {
  it('é o menu do aluno, com as 5 abas e seus rótulos', async () => {
    const { el, links } = await setup('/aluno');

    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Menu do aluno');
    expect(links().map((a) => a.textContent?.trim())).toEqual([
      'Início',
      'Treino',
      'Aulas',
      'Loja',
      'Mais',
    ]);
  });

  it('a aba ativa vem do router e leva aria-current e a pílula do acento', async () => {
    const { links } = await setup('/aluno/aulas');

    expect(links().map((a) => a.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'page',
      null,
      null,
    ]);
    expect(links().map((a) => a.querySelector('.ui-tab-bar__pill') !== null)).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('a navegação do router move a pílula', async () => {
    const { harness, links } = await setup('/aluno');
    expect(links()[0]?.querySelector('.ui-tab-bar__pill')).not.toBeNull();

    await harness.navigateByUrl('/aluno/loja', Host);
    harness.detectChanges();

    expect(links()[0]?.querySelector('.ui-tab-bar__pill')).toBeNull();
    expect(links()[3]?.querySelector('.ui-tab-bar__pill')).not.toBeNull();
  });

  it('Início é exato: não fica ativo nas outras rotas do aluno', async () => {
    const { links } = await setup('/aluno/treino');

    expect(links()[0]?.getAttribute('aria-current')).toBeNull();
  });

  it('os ícones são decorativos', async () => {
    const { el } = await setup('/aluno');

    for (const icone of el.querySelectorAll('ui-icon')) {
      expect(icone.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
