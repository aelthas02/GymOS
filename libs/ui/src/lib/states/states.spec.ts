import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { NoPermissionState } from './no-permission-state';
import { Skeleton } from './skeleton';

@Component({
  imports: [EmptyState],
  template: `<ui-empty-state
    heading="Nenhum aluno cadastrado ainda"
    description="Cadastre o primeiro aluno ou traga todos de uma vez por planilha."
    [icon]="icone"
  >
    <button actions type="button">Cadastrar aluno</button>
  </ui-empty-state>`,
})
class EmptyHost {
  icone = true;
}

@Component({
  imports: [ErrorState],
  template: `<ui-error-state
    [tone]="tom"
    heading="Não foi possível salvar o plano"
    description="Você está sem internet."
    [retrying]="tentando"
    (retry)="tentativas = tentativas + 1"
  >
    <button actions type="button">Ver detalhes</button>
  </ui-error-state>`,
})
class ErrorHost {
  tom: 'error' | 'warn' = 'warn';
  tentando = false;
  tentativas = 0;
}

function montar<T>(tipo: new () => T, patch: Partial<T> = {}) {
  const fixture = TestBed.createComponent(tipo);
  Object.assign(fixture.componentInstance as object, patch);
  fixture.detectChanges();
  return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('EmptyState', () => {
  it('mostra título, descrição e o slot de ações', () => {
    const { el } = montar(EmptyHost);

    expect(el.querySelector('.ui-state__title')?.textContent).toBe('Nenhum aluno cadastrado ainda');
    expect(el.textContent).toContain('Cadastre o primeiro aluno');
    expect(el.querySelector('[actions]')?.textContent).toBe('Cadastrar aluno');
  });

  it('o círculo do ícone é opcional e decorativo', () => {
    expect(montar(EmptyHost).el.querySelector('.ui-state__icon')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(montar(EmptyHost, { icone: false }).el.querySelector('.ui-state__icon')).toBeNull();
  });

  it('sem ações não deixa um bloco vazio', () => {
    const fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('heading', 'Nada encontrado para "Marcelo Dias"');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ui-state__actions:not(:empty)')).toBeNull();
  });
});

describe('ErrorState', () => {
  it('é um alerta com título, descrição e botão Tentar agora', () => {
    const { el } = montar(ErrorHost);

    expect(el.querySelector('[role=alert]')).not.toBeNull();
    expect(el.textContent).toContain('Não foi possível salvar o plano');
    expect(el.textContent).toContain('Você está sem internet.');
    expect(el.textContent).toContain('Tentar agora');
  });

  it('Tentar agora emite retry', () => {
    const { el, host } = montar(ErrorHost);

    [...el.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Tentar agora'))!
      .click();

    expect(host.tentativas).toBe(1);
  });

  it('tentando de novo, o botão fica ocupado e não repete o clique', () => {
    const { el, host } = montar(ErrorHost, { tentando: true });
    const botao = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tentar agora'),
    )!;

    botao.click();

    expect(botao.disabled).toBe(true);
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(host.tentativas).toBe(0);
  });

  it('o tom troca o par de cores do estado', () => {
    expect(montar(ErrorHost, { tom: 'error' }).el.querySelector('.ui-state--error')).not.toBeNull();
    expect(montar(ErrorHost, { tom: 'warn' }).el.querySelector('.ui-state--warn')).not.toBeNull();
  });

  it('mantém as ações extras e permite esconder o retry', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('heading', 'Catraca sem conexão desde 08h12');
    fixture.componentRef.setInput('retryable', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Tentar agora');
  });

  it('o rótulo do retry pode ser trocado', () => {
    const fixture = TestBed.createComponent(ErrorState);
    fixture.componentRef.setInput('heading', 'Catraca sem conexão');
    fixture.componentRef.setInput('retryLabel', 'Testar conexão');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Testar conexão');
  });
});

describe('NoPermissionState', () => {
  it('traz um texto padrão e aceita outro', () => {
    const padrao = TestBed.createComponent(NoPermissionState);
    padrao.detectChanges();
    expect(padrao.nativeElement.querySelector('.ui-state__title')?.textContent).toMatch(/acesso/i);

    const outro = TestBed.createComponent(NoPermissionState);
    outro.componentRef.setInput('heading', 'Sem permissão para o Financeiro');
    outro.componentRef.setInput('description', 'Peça acesso a quem administra.');
    outro.detectChanges();
    expect(outro.nativeElement.textContent).toContain('Sem permissão para o Financeiro');
    expect(outro.nativeElement.textContent).toContain('Peça acesso a quem administra.');
  });

  it('mostra um cadeado decorativo', () => {
    const fixture = TestBed.createComponent(NoPermissionState);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.ui-state__icon ui-icon')).not.toBeNull();
  });
});

describe('Skeleton', () => {
  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(Skeleton);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('é decorativo: some para o leitor de tela', () => {
    expect(render().getAttribute('aria-hidden')).toBe('true');
  });

  it('largura e altura vêm dos inputs', () => {
    const el = render({ width: '120px', height: '14px' });

    expect(el.style.width).toBe('120px');
    expect(el.style.height).toBe('14px');
  });

  it('o formato circle faz um círculo do tamanho da altura', () => {
    const el = render({ shape: 'circle', height: '36px' });

    expect(el.classList).toContain('ui-skeleton--circle');
    expect(el.style.width).toBe('36px');
  });
});
