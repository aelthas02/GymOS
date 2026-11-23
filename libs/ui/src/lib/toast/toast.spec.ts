import { TestBed } from '@angular/core/testing';
import { ToastOutlet } from './toast-outlet';
import { ToastService } from './toast.service';

function setup() {
  const fixture = TestBed.createComponent(ToastOutlet);
  fixture.detectChanges();
  const service = TestBed.inject(ToastService);
  const el = fixture.nativeElement as HTMLElement;
  const textos = () =>
    [...el.querySelectorAll('.ui-toast__message')].map((n) => n.textContent?.trim());
  const render = () => fixture.detectChanges();
  return { fixture, service, el, textos, render };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Toast', () => {
  it('a região aria-live existe mesmo vazia, para o leitor de tela registrá-la', () => {
    const { el } = setup();

    expect(el.querySelector('[aria-live=polite]')).not.toBeNull();
  });

  it('mostra a mensagem enviada', () => {
    const { service, textos, render } = setup();

    service.show({ message: 'Plano salvo' });
    render();

    expect(textos()).toEqual(['Plano salvo']);
  });

  it('erro é anunciado como alerta; os demais, como status', () => {
    const { service, el, render } = setup();

    service.show({ message: 'Salvo', tone: 'success' });
    service.show({ message: 'Falhou', tone: 'error' });
    render();

    const itens = [...el.querySelectorAll('.ui-toast')];
    expect(itens.map((i) => i.getAttribute('role'))).toEqual(['status', 'alert']);
  });

  it('some sozinho depois de 5 segundos', () => {
    const { service, textos, render } = setup();
    service.show({ message: 'Plano salvo' });
    render();

    vi.advanceTimersByTime(4999);
    render();
    expect(textos()).toEqual(['Plano salvo']);

    vi.advanceTimersByTime(1);
    render();
    expect(textos()).toEqual([]);
  });

  it('duração própria; duração 0 não some sozinha', () => {
    const { service, textos, render } = setup();
    service.show({ message: 'Rápido', duration: 1000 });
    service.show({ message: 'Fixo', duration: 0 });
    render();

    vi.advanceTimersByTime(60_000);
    render();

    expect(textos()).toEqual(['Fixo']);
  });

  it('o botão Fechar dispensa o aviso', () => {
    const { service, el, textos, render } = setup();
    service.show({ message: 'Plano salvo', duration: 0 });
    render();

    el.querySelector<HTMLElement>('[aria-label="Fechar aviso"]')!.click();
    render();

    expect(textos()).toEqual([]);
  });

  it('dismiss de id desconhecido não faz nada', () => {
    const { service, textos, render } = setup();
    service.show({ message: 'A', duration: 0 });

    service.dismiss(9999);
    render();

    expect(textos()).toEqual(['A']);
  });

  it('ids são únicos', () => {
    const { service } = setup();

    expect(service.show({ message: 'A' })).not.toBe(service.show({ message: 'B' }));
  });

  describe('fila', () => {
    it('mostra até 3 de uma vez; os demais esperam', () => {
      const { service, textos, render } = setup();
      for (const m of ['1', '2', '3', '4']) service.show({ message: m, duration: 0 });
      render();

      expect(textos()).toEqual(['1', '2', '3']);
    });

    it('ao liberar uma vaga, o próximo da fila aparece', () => {
      const { service, textos, render } = setup();
      const primeiro = service.show({ message: '1', duration: 0 });
      for (const m of ['2', '3', '4']) service.show({ message: m, duration: 0 });

      service.dismiss(primeiro);
      render();

      expect(textos()).toEqual(['2', '3', '4']);
    });

    it('o tempo do aviso na fila só conta a partir de quando ele aparece', () => {
      const { service, textos, render } = setup();
      for (const m of ['1', '2', '3']) service.show({ message: m, duration: 3000 });
      service.show({ message: '4', duration: 3000 });
      render();

      vi.advanceTimersByTime(3000);
      render();
      expect(textos()).toEqual(['4']);

      vi.advanceTimersByTime(2999);
      render();
      expect(textos()).toEqual(['4']);

      vi.advanceTimersByTime(1);
      render();
      expect(textos()).toEqual([]);
    });
  });

  it('clear limpa tudo, inclusive a fila', () => {
    const { service, textos, render } = setup();
    for (const m of ['1', '2', '3', '4']) service.show({ message: m, duration: 0 });

    service.clear();
    render();

    expect(textos()).toEqual([]);
  });
});
