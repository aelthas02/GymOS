import { TestBed } from '@angular/core/testing';
import { Card } from './card';

function render(inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(Card);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('Card', () => {
  it('padrão: sem a marca de inverso', () => {
    expect(render().classList).not.toContain('ui-card--inverse');
  });

  it('inverse troca para o fundo de tinta', () => {
    expect(render({ inverse: true }).classList).toContain('ui-card--inverse');
  });

  it('compact reduz o padding', () => {
    expect(render({ compact: true }).classList).toContain('ui-card--compact');
  });
});
