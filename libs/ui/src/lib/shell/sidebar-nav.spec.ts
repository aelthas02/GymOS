import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { SidebarNav, type NavSection } from './sidebar-nav';

const secoes = (): NavSection[] => [
  {
    items: [
      { label: 'Início', link: '/', icon: 'home', exact: true },
      { label: 'Alunos', link: '/alunos', icon: 'user' },
      { label: 'Financeiro', link: '/financeiro', icon: 'bag', visible: false },
    ],
  },
  {
    title: 'Módulos extras',
    items: [
      { label: 'Aulas', link: '/aulas', icon: 'calendar' },
      { label: 'Loja', link: '/loja', icon: 'bag', visible: false },
    ],
  },
];

@Component({
  imports: [SidebarNav],
  template: `<ui-sidebar-nav
    [sections]="secoes()"
    [collapsed]="recolhida()"
    (navigate)="navegou = navegou + 1"
  />`,
})
class Host {
  secoes = signal(secoes());
  recolhida = signal(false);
  navegou = 0;
}

async function setup(url = '/') {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: '**', component: Host }])],
  });
  const harness = await RouterTestingHarness.create();
  const host = await harness.navigateByUrl(url, Host);
  harness.detectChanges();
  const el = harness.fixture.nativeElement as HTMLElement;
  const textos = () => [...el.querySelectorAll('a')].map((a) => a.textContent?.trim());
  return { harness, host, el, textos };
}

describe('SidebarNav', () => {
  it('é a navegação principal, com a marca e os links', async () => {
    const { el, textos } = await setup();

    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Menu principal');
    expect(el.textContent).toContain('GymOS');
    expect(textos()).toEqual(['Início', 'Alunos', 'Aulas']);
  });

  it('esconde os itens cuja flag é falsa, sem ler flag nenhuma por conta própria', async () => {
    const { host, harness, textos } = await setup();
    expect(textos()).not.toContain('Financeiro');
    expect(textos()).not.toContain('Loja');

    host.secoes.set([
      {
        items: [{ label: 'Financeiro', link: '/financeiro', icon: 'bag', visible: true }],
      },
    ]);
    harness.detectChanges();

    expect(textos()).toEqual(['Financeiro']);
  });

  it('a seção "Módulos extras" aparece com itens e some quando todos estão escondidos', async () => {
    const { host, harness, el } = await setup();
    expect(el.textContent).toContain('Módulos extras');

    host.secoes.set([
      {
        title: 'Módulos extras',
        items: [{ label: 'Loja', link: '/loja', icon: 'bag', visible: false }],
      },
    ]);
    harness.detectChanges();

    expect(el.textContent).not.toContain('Módulos extras');
  });

  it('o item ativo vem do router e leva aria-current', async () => {
    const { el } = await setup('/alunos');
    const links = [...el.querySelectorAll('a')];

    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([null, 'page', null]);
  });

  it('item exact só fica ativo na rota exata', async () => {
    const { el } = await setup('/alunos');

    expect(el.querySelector('a')?.getAttribute('aria-current')).toBeNull();
  });

  it('rota filha mantém o item pai ativo', async () => {
    const { el } = await setup('/alunos/12');

    expect(el.querySelectorAll('a')[1]?.getAttribute('aria-current')).toBe('page');
  });

  it('mostra o cartão "Precisa de ajuda?"', async () => {
    const { el } = await setup();

    expect(el.querySelector('.ui-nav__help')?.textContent).toContain('Precisa de ajuda?');
    expect(el.querySelector('.ui-nav__help')?.textContent).toContain(
      'Toque em "?" em qualquer tela para ver um mini tutorial.',
    );
  });

  describe('recolhida (tablet)', () => {
    it('só ícones: o nome continua acessível e o cartão de ajuda some', async () => {
      const { host, harness, el } = await setup();
      host.recolhida.set(true);
      harness.detectChanges();

      const link = el.querySelector('a')!;
      expect(el.querySelector('.ui-nav--collapsed')).not.toBeNull();
      expect(link.querySelector('.ui-sr-only')?.textContent).toBe('Início');
      expect(link.getAttribute('title')).toBe('Início');
      expect(el.querySelector('.ui-nav__help')).toBeNull();
    });

    it('aberta, o link não tem title redundante', async () => {
      const { el } = await setup();

      expect(el.querySelector('a')?.getAttribute('title')).toBeNull();
    });
  });

  it('clicar num item avisa com navigate (a gaveta do mobile fecha)', async () => {
    const { host, harness, el } = await setup();

    el.querySelectorAll<HTMLElement>('a')[1]?.click();
    await harness.fixture.whenStable();

    expect(host.navegou).toBe(1);
  });
});
