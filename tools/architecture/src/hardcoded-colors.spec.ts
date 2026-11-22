import { workspaceRoot } from '@nx/devkit';
import { ESLint, type Linter } from 'eslint';
import { join } from 'node:path';

const NO_HARDCODED_COLOR = 'gymos/no-hardcoded-color';

async function colorErrors(file: string, code: string): Promise<Linter.LintMessage[]> {
  const eslint = new ESLint({ cwd: workspaceRoot });
  const [result] = await eslint.lintText(code, { filePath: join(workspaceRoot, file) });
  const messages = result?.messages ?? [];
  const fatal = messages.filter((message) => message.fatal);
  expect(fatal).toEqual([]);
  return messages.filter(
    (message) => message.ruleId === NO_HARDCODED_COLOR && message.severity === 2,
  );
}

describe('nenhuma cor fixa fora de libs/ui/styles', () => {
  it.each([
    ['hex', '.card { color: #0C1722; }'],
    ['hex curto', '.card { border: 1px solid #fff; }'],
    ['rgb()', '.card { background: rgb(12 23 34); }'],
    ['hsla()', '.card { box-shadow: 0 1px 2px hsla(0, 0%, 0%, 0.2); }'],
    ['nome de cor', '.card { color: white; }'],
    ['fallback de var()', '.card { color: var(--ink, #0C1722); }'],
  ])('CSS de componente com %s gera erro', async (_caso, css) => {
    expect(await colorErrors('apps/staff-web/src/app/fixture.css', css)).toHaveLength(1);
  });

  it('CSS de componente que só usa tokens não gera erro', async () => {
    const css = [
      '.card {',
      '  color: var(--ink);',
      '  background: color-mix(in srgb, var(--accent) 15%, var(--surface));',
      '  border: 1px solid transparent;',
      '  outline-color: currentColor;',
      '  font-family: var(--font);',
      '}',
      '',
    ].join('\n');

    expect(await colorErrors('apps/staff-web/src/app/fixture.css', css)).toEqual([]);
  });

  it('variável SCSS com hex gera erro', async () => {
    const scss =
      "@use 'breakpoints' as bp;\n$cor: #22C98A;\n.card { @include bp.desktop { color: var(--ink); } }\n";

    expect(await colorErrors('apps/student-app/src/app/fixture.scss', scss)).toHaveLength(1);
  });

  it('libs/ui/styles pode declarar cores', async () => {
    expect(await colorErrors('libs/ui/styles/fixture.css', ':root { --ink: #0C1722; }')).toEqual(
      [],
    );
    expect(
      await colorErrors('libs/ui/styles/fixture.ts', "export const ink = '#0C1722';\n"),
    ).toEqual([]);
  });

  it('string com hex em TypeScript de front gera erro', async () => {
    const ts = "export const destaque = '#22C98A';\nexport const sombra = `rgba(0, 0, 0, 0.2)`;\n";

    expect(await colorErrors('libs/ui/src/lib/fixture.ts', ts)).toHaveLength(2);
  });

  it('estilo inline de componente em TypeScript gera erro', async () => {
    const ts = [
      "import { ChangeDetectionStrategy, Component } from '@angular/core';",
      '',
      '@Component({',
      "  selector: 'app-fixture',",
      "  template: '<p>ok</p>',",
      "  styles: ['p { color: #4A5A6B; }'],",
      '  changeDetection: ChangeDetectionStrategy.OnPush,',
      '})',
      'export class Fixture {}',
      '',
    ].join('\n');

    expect(await colorErrors('apps/staff-web/src/app/fixture.ts', ts)).toHaveLength(1);
  });

  it.each([
    ['atributo style', '<div style="background:#F3F5F2;color:#0C1722"></div>', 2],
    ['atributo de SVG', '<svg><path fill="#22C98A" d="M0 0h1"></path></svg>', 1],
    ['binding de estilo', '<div [style.color]="\'#22C98A\'"></div>', 1],
  ])('template com cor fixa no %s gera erro', async (_caso, html, erros) => {
    expect(await colorErrors('apps/student-app/src/app/fixture.html', html)).toHaveLength(erros);
  });

  it('template sem cor fixa não gera erro, mesmo com âncora parecida com hex', async () => {
    const html = '<a href="#add" class="card" [style.color]="corDoTema()">ok</a>\n';

    expect(await colorErrors('apps/student-app/src/app/fixture.html', html)).toEqual([]);
  });

  it('a API não é front e fica fora da regra', async () => {
    const ts = "export const corDoEmail = '#22C98A';\n";

    expect(await colorErrors('apps/api/src/fixture.ts', ts)).toEqual([]);
  });
});
