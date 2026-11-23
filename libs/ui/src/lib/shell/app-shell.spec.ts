import { BreakpointObserver } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { mediaQueries } from '../../../styles/breakpoints';
import { AppShell } from './app-shell';
import type { NavSection } from './sidebar-nav';

@Component({
  imports: [AppShell],
  template: `<ui-app-shell [sections]="secoes"><p id="conteudo-da-tela">Alunos</p></ui-app-shell>`,
})
class Host {
  secoes: NavSection[] = [
    {
      items: [
        { label: 'Início', link: '/', icon: 'home', exact: true },
        { label: 'Alunos', link: '/alunos', icon: 'user' },
      ],
    },
  ];
}

type Modo = 'desktop' | 'tablet' | 'mobile';

function setup(modo: Modo) {
  const resultado = (valor: Modo) => ({
    matches: valor !== 'desktop',
    breakpoints: {
      [mediaQueries.mobile]: valor === 'mobile',
      [mediaQueries.tablet]: valor === 'tablet',
    },
  });
  const largura = new BehaviorSubject(resultado(modo));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: Host }]),
      { provide: BreakpointObserver, useValue: { observe: () => largura } },
    ],
  });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    mudar: (novo: Modo) => {
      largura.next(resultado(novo));
      fixture.detectChanges();
    },
  };
}

describe('AppShell', () => {
  it('desktop: menu lateral completo e o conteúdo da tela no main', () => {
    const { el } = setup('desktop');

    expect(el.querySelector('ui-sidebar-nav')).not.toBeNull();
    expect(el.querySelector('.ui-nav--collapsed')).toBeNull();
    expect(el.querySelector('main #conteudo-da-tela')?.textContent).toBe('Alunos');
    expect(el.querySelector('button[aria-label="Abrir menu"]')).toBeNull();
  });

  it('tablet: o menu lateral fica recolhido em ícones', () => {
    const { el } = setup('tablet');

    expect(el.querySelector('.ui-nav--collapsed')).not.toBeNull();
  });

  it('o link "Ir para o conteúdo" leva o foco ao main', () => {
    const { el } = setup('desktop');

    el.querySelector<HTMLElement>('.ui-shell__skip')!.click();

    expect(document.activeElement).toBe(el.querySelector('main'));
  });

  describe('mobile', () => {
    it('sem menu lateral fixo; botão de menu na barra de cima', () => {
      const { el } = setup('mobile');

      expect(el.querySelector('ui-sidebar-nav')).toBeNull();
      expect(el.querySelector('button[aria-label="Abrir menu"]')).not.toBeNull();
    });

    it('o botão abre o menu numa gaveta com foco preso', () => {
      const { fixture, el } = setup('mobile');
      document.body.appendChild(el);

      el.querySelector<HTMLElement>('button[aria-label="Abrir menu"]')!.click();
      fixture.detectChanges();

      const gaveta = el.querySelector('[role=dialog]')!;
      expect(gaveta.getAttribute('aria-modal')).toBe('true');
      expect(gaveta.querySelector('ui-sidebar-nav')).not.toBeNull();
      expect(gaveta.contains(document.activeElement)).toBe(true);
    });

    it('escolher um item fecha a gaveta', () => {
      const { fixture, el } = setup('mobile');
      document.body.appendChild(el);
      el.querySelector<HTMLElement>('button[aria-label="Abrir menu"]')!.click();
      fixture.detectChanges();

      el.querySelector<HTMLElement>('[role=dialog] a')!.click();
      fixture.detectChanges();

      expect(el.querySelector('[role=dialog]')).toBeNull();
    });

    it('voltar ao desktop com a gaveta aberta não deixa a gaveta para trás', () => {
      const { fixture, el, mudar } = setup('mobile');
      el.querySelector<HTMLElement>('button[aria-label="Abrir menu"]')!.click();
      fixture.detectChanges();

      mudar('desktop');
      mudar('mobile');

      expect(el.querySelector('[role=dialog]')).toBeNull();
    });
  });
});
