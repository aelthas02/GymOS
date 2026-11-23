import { Component, type Provider, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { composeStory } from './compose-story';
import type { StoriesModule } from './compose-story';

// Toda história do Storybook passa pelo axe. O jsdom não calcula layout nem cor, então o contraste
// (`color-contrast`) fica de fora aqui: os pares de cor saem dos tokens e `contrast.spec.ts` prova o
// contraste mínimo de cada um. As regras de página inteira também não se aplicam a um componente.
const regrasDePagina = [
  'color-contrast',
  'region',
  'page-has-heading-one',
  'landmark-one-main',
  'landmark-unique',
  'scrollable-region-focusable',
];

const modulos = import.meta.glob<StoriesModule>('../stories/*.stories.ts', { eager: true });

const casos = Object.entries(modulos).flatMap(([arquivo, modulo]) =>
  Object.keys(modulo)
    .filter((nome) => nome !== 'default')
    .map((nome) => ({ arquivo: arquivo.replace('../stories/', ''), nome, modulo })),
);

describe('axe em todas as histórias', () => {
  it('encontra as histórias', () => {
    expect(casos.length).toBeGreaterThan(0);
  });

  it.each(casos)('$arquivo › $nome não tem violações', async ({ modulo, nome }) => {
    const { template, imports, providers, props } = composeStory(modulo, nome);

    @Component({ template, imports: imports as Type<unknown>[] })
    class Host {
      constructor() {
        Object.assign(this, props);
      }
    }

    TestBed.configureTestingModule({ providers: providers as Provider[] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const resultado = await axe.run(fixture.nativeElement as HTMLElement, {
      rules: Object.fromEntries(regrasDePagina.map((regra) => [regra, { enabled: false }])),
    });

    const relatorio = resultado.violations.map(
      (v) => `${v.id}: ${v.help}\n${v.nodes.map((n) => `  ${n.html}`).join('\n')}`,
    );
    expect(relatorio).toEqual([]);
  });
});
