import { TestBed } from '@angular/core/testing';
import { Icon } from './icon';
import { iconNames, icons } from './icons';

describe('conjunto de ícones', () => {
  it('traz os ícones usados nas telas', () => {
    for (const nome of [
      'edit',
      'list',
      'chat',
      'trash',
      'bell',
      'qr',
      'home',
      'dumbbell',
      'calendar',
      'bag',
      'menu',
    ]) {
      expect(iconNames).toContain(nome);
    }
  });

  it('todo ícone tem ao menos um desenho', () => {
    for (const nome of iconNames) expect(icons[nome].length).toBeGreaterThan(0);
  });
});

describe('Icon', () => {
  function render(name: string, label?: string) {
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', name);
    if (label) fixture.componentRef.setInput('label', label);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('desenha um svg e o esconde do leitor de tela quando não tem rótulo', () => {
    const el = render('home');

    expect(el.querySelector('svg')?.children.length).toBeGreaterThan(0);
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).toBeNull();
  });

  it('com rótulo, vira imagem nomeada', () => {
    const el = render('bell', 'Avisos');

    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Avisos');
    expect(el.getAttribute('aria-hidden')).toBeNull();
  });

  it('nome desconhecido não desenha nada e não quebra', () => {
    expect(render('nao-existe').querySelector('svg')?.children.length ?? 0).toBe(0);
  });
});
