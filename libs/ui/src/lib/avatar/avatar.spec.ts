import { TestBed } from '@angular/core/testing';
import { Avatar, initials } from './avatar';

describe('initials', () => {
  it('usa a primeira letra do primeiro nome, em maiúscula', () => {
    expect(initials('Rafael Souza')).toBe('R');
    expect(initials('juliana prado')).toBe('J');
  });

  it('com duas letras, usa primeiro e último nome', () => {
    expect(initials('Rafael Souza', 2)).toBe('RS');
    expect(initials('Maria da Silva Costa', 2)).toBe('MC');
  });

  it('com um nome só, duas letras repetem só a primeira', () => {
    expect(initials('Rafael', 2)).toBe('R');
  });

  it('ignora espaços nas pontas e entre as palavras', () => {
    expect(initials('   ana   lima  ', 2)).toBe('AL');
  });

  it('mantém letras acentuadas e emoji inteiros', () => {
    expect(initials('édson')).toBe('É');
    expect(initials('😀 Fulano')).toBe('😀');
  });

  it('devolve ? para nome vazio', () => {
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});

describe('Avatar', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(Avatar);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra as iniciais e expõe o nome como rótulo', () => {
    const el = render({ name: 'Rafael Souza' });

    expect(el.textContent?.trim()).toBe('R');
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Rafael Souza');
  });

  it('decorativo some para o leitor de tela', () => {
    const el = render({ name: 'Rafael Souza', decorative: true });

    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).toBeNull();
    expect(el.getAttribute('aria-label')).toBeNull();
  });

  it('o tom escolhe o par de cores do badge', () => {
    expect(render({ name: 'A', tone: 'late' }).getAttribute('style')).toContain(
      'var(--badge-late-bg)',
    );
  });

  it('o tamanho vira variável de CSS', () => {
    expect(render({ name: 'A', size: 44 }).style.getPropertyValue('--avatar-size')).toBe('44px');
  });
});
