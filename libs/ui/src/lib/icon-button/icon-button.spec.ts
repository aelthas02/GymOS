import { TestBed } from '@angular/core/testing';
import { IconButton } from './icon-button';

function setup(inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(IconButton);
  fixture.componentRef.setInput('icon', 'edit');
  fixture.componentRef.setInput('label', 'Editar aluno');
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, button: el.querySelector('button')! };
}

describe('IconButton', () => {
  it('o botão tem nome acessível vindo do rótulo', () => {
    expect(setup().button.getAttribute('aria-label')).toBe('Editar aluno');
  });

  it('desenha o ícone escolhido, escondido do leitor de tela', () => {
    const { el } = setup({ icon: 'trash' });
    expect(el.querySelector('ui-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('área de toque de 44 px com visual de 36 px', () => {
    const { el, button } = setup();

    expect(getComputedStyle(el).width).toBe('44px');
    expect(getComputedStyle(el).height).toBe('44px');
    expect(getComputedStyle(button).width).toBe('36px');
  });

  it('desabilitado não dispara clique', () => {
    const { button, el } = setup({ disabled: true });
    let cliques = 0;
    el.addEventListener('click', () => cliques++);

    button.click();

    expect(cliques).toBe(0);
  });
});
