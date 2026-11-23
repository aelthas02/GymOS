import { TestBed } from '@angular/core/testing';
import { Badge, type BadgeVariant } from './badge';

function render(variant?: BadgeVariant) {
  const fixture = TestBed.createComponent(Badge);
  if (variant) fixture.componentRef.setInput('variant', variant);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('Badge', () => {
  it.each<BadgeVariant>(['ok', 'late', 'soon', 'off'])(
    'aplica o par bg/fg da variante %s',
    (variant) => {
      const style = render(variant).el.getAttribute('style') ?? '';

      expect(style).toContain(`background-color: var(--badge-${variant}-bg)`);
      expect(style).toContain(`color: var(--badge-${variant}-fg)`);
    },
  );

  it('usa a variante off quando nenhuma é informada', () => {
    expect(render().el.getAttribute('style')).toContain('var(--badge-off-bg)');
  });

  it('troca o par quando a variante muda', () => {
    const { fixture, el } = render('ok');
    fixture.componentRef.setInput('variant', 'late');
    fixture.detectChanges();

    const style = el.getAttribute('style') ?? '';
    expect(style).toContain('var(--badge-late-bg)');
    expect(style).not.toContain('var(--badge-ok-bg)');
  });

  it('não some para o leitor de tela: o texto projetado é lido', () => {
    expect(render('ok').el.getAttribute('aria-hidden')).toBeNull();
  });
});
