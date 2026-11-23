import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageHeader, type Crumb } from './page-header';

const trilha: Crumb[] = [{ label: 'Alunos', link: '/alunos' }, { label: 'Rafael Souza' }];

@Component({
  imports: [PageHeader],
  template: `<ui-page-header
    heading="Alunos"
    subtitle="Cadastro, planos e situação de pagamento."
    [breadcrumb]="trilha"
    [help]="ajuda"
    (helpClick)="cliques = cliques + 1"
  >
    <button actions type="button">Cadastrar aluno</button>
  </ui-page-header>`,
})
class Host {
  trilha = trilha;
  ajuda = true;
  cliques = 0;
}

function setup(patch: Partial<Host> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Host);
  Object.assign(fixture.componentInstance, patch);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('PageHeader', () => {
  it('título é o h1 e o subtítulo vem logo abaixo', () => {
    const { el } = setup();

    expect(el.querySelector('h1')?.textContent).toBe('Alunos');
    expect(el.textContent).toContain('Cadastro, planos e situação de pagamento.');
  });

  it('as ações entram pelo slot', () => {
    expect(setup().el.querySelector('[actions]')?.textContent).toBe('Cadastrar aluno');
  });

  it('o botão "?" se chama Ajuda e emite helpClick', () => {
    const { el, host } = setup();
    const botao = el.querySelector<HTMLElement>('button[aria-label="Ajuda"]')!;

    botao.click();

    expect(host.cliques).toBe(1);
  });

  it('help=false esconde o botão', () => {
    expect(setup({ ajuda: false }).el.querySelector('[aria-label="Ajuda"]')).toBeNull();
  });

  describe('breadcrumb', () => {
    it('é uma navegação nomeada; o último item é a página atual e não é link', () => {
      const { el } = setup();
      const nav = el.querySelector('nav')!;

      expect(nav.getAttribute('aria-label')).toBe('Você está em');
      expect(nav.querySelector('a')?.getAttribute('href')).toBe('/alunos');
      const atual = nav.querySelector('[aria-current=page]')!;
      expect(atual.textContent?.trim()).toBe('Rafael Souza');
      expect(atual.tagName).not.toBe('A');
    });

    it('sem trilha, não há nav', () => {
      expect(setup({ trilha: [] }).el.querySelector('nav')).toBeNull();
    });

    it('item intermediário sem link vira texto simples', () => {
      const { el } = setup({
        trilha: [
          { label: 'Configurações' },
          { label: 'Equipe', link: '/equipe' },
          { label: 'Novo' },
        ],
      });

      expect(el.querySelectorAll('nav a')).toHaveLength(1);
      expect(el.querySelectorAll('nav li')).toHaveLength(3);
    });
  });
});
