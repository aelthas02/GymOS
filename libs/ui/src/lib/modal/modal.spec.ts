import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Modal } from './modal';

@Component({
  imports: [Modal],
  template: `
    <button id="gatilho" type="button" (click)="aberto.set(true)">Excluir plano</button>
    <ui-modal
      [(open)]="aberto"
      [variant]="variante()"
      [dismissable]="dispensavel()"
      heading="Excluir plano"
    >
      <p>Esta ação não pode ser desfeita.</p>
      <input id="motivo" aria-label="Motivo" />
      <button id="confirmar" type="button" footer>Confirmar</button>
    </ui-modal>
  `,
})
class Host {
  aberto = signal(false);
  variante = signal<'modal' | 'drawer'>('modal');
  dispensavel = signal(true);
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  document.body.appendChild(el);
  const gatilho = el.querySelector<HTMLButtonElement>('#gatilho')!;
  const dialogo = () => el.querySelector<HTMLElement>('[role=dialog]');
  const abrir = () => {
    gatilho.focus();
    gatilho.click();
    fixture.detectChanges();
  };
  const tecla = (alvo: Element, key: string, shiftKey = false) => {
    const evento = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    alvo.dispatchEvent(evento);
    fixture.detectChanges();
    return evento;
  };
  return { fixture, host: fixture.componentInstance, el, gatilho, dialogo, abrir, tecla };
}

afterEach(() => {
  document.body.style.overflow = '';
  document.body.innerHTML = '';
});

describe('Modal', () => {
  it('fechado, não renderiza nada', () => {
    expect(setup().dialogo()).toBeNull();
  });

  it('aberto, é um diálogo modal nomeado pelo título', () => {
    const { dialogo, abrir } = setup();

    abrir();

    const d = dialogo()!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    const titulo = d.querySelector('h2')!;
    expect(titulo.textContent).toContain('Excluir plano');
    expect(d.getAttribute('aria-labelledby')).toBe(titulo.id);
    expect(d.textContent).toContain('Esta ação não pode ser desfeita.');
  });

  it('o foco entra no diálogo ao abrir', () => {
    const { dialogo, abrir } = setup();

    abrir();

    expect(dialogo()!.contains(document.activeElement)).toBe(true);
  });

  describe('foco preso', () => {
    it('Tab no último elemento volta ao primeiro', () => {
      const { el, dialogo, abrir, tecla } = setup();
      abrir();
      const focaveis = dialogo()!.querySelectorAll<HTMLElement>('button, input');
      const ultimo = el.querySelector<HTMLElement>('#confirmar')!;
      ultimo.focus();

      const evento = tecla(ultimo, 'Tab');

      expect(evento.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(focaveis[0]);
    });

    it('Shift+Tab no primeiro vai ao último', () => {
      const { el, dialogo, abrir, tecla } = setup();
      abrir();
      const primeiro = dialogo()!.querySelector<HTMLElement>('button, input')!;
      primeiro.focus();

      tecla(primeiro, 'Tab', true);

      expect(document.activeElement).toBe(el.querySelector('#confirmar'));
    });

    it('Tab no meio segue o fluxo normal do navegador', () => {
      const { el, abrir, tecla } = setup();
      abrir();
      const meio = el.querySelector<HTMLElement>('#motivo')!;
      meio.focus();

      expect(tecla(meio, 'Tab').defaultPrevented).toBe(false);
    });

    it('o foco fora do diálogo volta para dentro', () => {
      const { gatilho, dialogo, abrir, fixture } = setup();
      abrir();

      gatilho.focus();
      document.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();

      expect(dialogo()!.contains(document.activeElement)).toBe(true);
    });
  });

  describe('fechar', () => {
    it('Esc fecha e devolve o foco ao gatilho', () => {
      const { host, gatilho, dialogo, abrir, tecla } = setup();
      abrir();

      tecla(document.activeElement!, 'Escape');

      expect(host.aberto()).toBe(false);
      expect(dialogo()).toBeNull();
      expect(document.activeElement).toBe(gatilho);
    });

    it('o botão Fechar fecha e devolve o foco', () => {
      const { host, el, gatilho, abrir, fixture } = setup();
      abrir();

      el.querySelector<HTMLElement>('[aria-label="Fechar"]')!.click();
      fixture.detectChanges();

      expect(host.aberto()).toBe(false);
      expect(document.activeElement).toBe(gatilho);
    });

    it('clicar no fundo fecha; clicar dentro do painel não', () => {
      const { host, el, abrir, fixture } = setup();
      abrir();

      el.querySelector<HTMLElement>('p')!.click();
      fixture.detectChanges();
      expect(host.aberto()).toBe(true);

      el.querySelector<HTMLElement>('.ui-modal__backdrop')!.click();
      fixture.detectChanges();
      expect(host.aberto()).toBe(false);
    });

    it('fechado pelo pai também devolve o foco', () => {
      const { host, gatilho, abrir, fixture } = setup();
      abrir();

      host.aberto.set(false);
      fixture.detectChanges();

      expect(document.activeElement).toBe(gatilho);
    });

    it('outras teclas não fecham', () => {
      const { host, abrir, tecla } = setup();
      abrir();

      tecla(document.activeElement!, 'a');

      expect(host.aberto()).toBe(true);
    });

    it('não dispensável: Esc e fundo não fecham e o X some', () => {
      const { host, el, abrir, tecla, fixture } = setup();
      host.dispensavel.set(false);
      abrir();

      tecla(document.activeElement!, 'Escape');
      el.querySelector<HTMLElement>('.ui-modal__backdrop')!.click();
      fixture.detectChanges();

      expect(host.aberto()).toBe(true);
      expect(el.querySelector('[aria-label="Fechar"]')).toBeNull();
    });
  });

  it('trava a rolagem da página enquanto aberto', () => {
    const { host, abrir, fixture } = setup();

    abrir();
    expect(document.body.style.overflow).toBe('hidden');

    host.aberto.set(false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('');
  });

  it('destruído aberto, libera a rolagem', () => {
    const { abrir, fixture } = setup();
    abrir();

    fixture.destroy();

    expect(document.body.style.overflow).toBe('');
  });

  it('variant drawer vira painel lateral', () => {
    const { host, dialogo, abrir, fixture } = setup();
    host.variante.set('drawer');
    fixture.detectChanges();

    abrir();

    expect(dialogo()!.classList).toContain('ui-modal__panel--drawer');
  });

  it('abre sem gatilho focado e fecha sem erro', () => {
    const { host, fixture, tecla } = setup();
    (document.activeElement as HTMLElement | null)?.blur();

    host.aberto.set(true);
    fixture.detectChanges();

    expect(() => tecla(document.activeElement!, 'Escape')).not.toThrow();
    expect(host.aberto()).toBe(false);
  });
});
