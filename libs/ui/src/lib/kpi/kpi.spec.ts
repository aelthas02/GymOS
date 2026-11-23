import { TestBed } from '@angular/core/testing';
import { Kpi } from './kpi';

function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(Kpi);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Kpi', () => {
  it('mostra rótulo, valor e legenda', () => {
    const el = render({ label: 'Receita bruta', value: 'R$ 54.900', legend: 'Antes de taxas' });

    expect(el.textContent).toContain('Receita bruta');
    expect(el.textContent).toContain('R$ 54.900');
    expect(el.textContent).toContain('Antes de taxas');
  });

  it('sem legenda e sem variação não renderiza esses blocos', () => {
    const el = render({ label: 'Alunos', value: '312' });

    expect(el.querySelector('.ui-kpi__legend')).toBeNull();
    expect(el.querySelector('.ui-kpi__delta')).toBeNull();
  });

  it('variação positiva diz "subiu" ao leitor de tela, além da seta', () => {
    const el = render({ label: 'A', value: '1', delta: '+8,2%', trend: 'up' });
    const delta = el.querySelector('.ui-kpi__delta')!;

    expect(delta.textContent).toContain('+8,2%');
    expect(delta.classList).toContain('ui-kpi__delta--up');
    expect(delta.querySelector('.ui-sr-only')?.textContent).toMatch(/subiu/i);
  });

  it('variação negativa diz "caiu"', () => {
    const el = render({ label: 'A', value: '1', delta: '-3%', trend: 'down' });

    expect(el.querySelector('.ui-kpi__delta .ui-sr-only')?.textContent).toMatch(/caiu/i);
  });

  it('variação estável é neutra', () => {
    const el = render({ label: 'A', value: '1', delta: '0%', trend: 'flat' });

    expect(el.querySelector('.ui-kpi__delta')?.classList).toContain('ui-kpi__delta--flat');
  });
});
