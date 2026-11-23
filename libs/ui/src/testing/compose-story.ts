/**
 * Monta uma história do Storybook (formato CSF com `render` e `moduleMetadata`) sem o Storybook,
 * para os testes de acessibilidade rodarem todas as histórias no Vitest.
 */
import { reflectComponentType, type Type } from '@angular/core';

interface StoryResult {
  template?: string;
  props?: Record<string, unknown>;
  moduleMetadata?: { imports?: unknown[]; providers?: unknown[] };
  applicationConfig?: { providers?: unknown[] };
}

type StoryFn = () => StoryResult;
type Decorator = (story: StoryFn, context: unknown) => StoryResult;

interface StoryDef {
  component?: Type<unknown>;
  args?: Record<string, unknown>;
  decorators?: Decorator[];
  render?: (args: Record<string, unknown>, context: unknown) => StoryResult;
}

export type StoriesModule = Record<string, unknown> & { default: StoryDef };

export interface ComposedStory {
  template: string;
  props: Record<string, unknown>;
  imports: unknown[];
  providers: unknown[];
}

export function composeStory(modulo: StoriesModule, nome: string): ComposedStory {
  const meta = modulo.default;
  const story = modulo[nome] as StoryDef;
  const args = { ...meta.args, ...story.args };
  const component = meta.component;
  // Sem render, o Storybook gera o template do componente ligando cada arg a um input.
  const render =
    story.render ??
    meta.render ??
    (component && ((a: Record<string, unknown>) => ({ template: gerarTemplate(component, a) })));
  if (!render) throw new Error(`A história "${nome}" não tem render nem component.`);

  const context = { args, globals: {}, parameters: {} };
  // Decoradores da história envolvem os do meta, como no Storybook.
  const decoradores = [...(meta.decorators ?? []), ...(story.decorators ?? [])];
  const final = decoradores.reduce<StoryFn>(
    (interno, decorador) => () => decorador(interno, context),
    () => render(args, context),
  );

  const resultado = final();
  if (!resultado.template) throw new Error(`A história "${nome}" não devolveu template.`);

  return {
    template: resultado.template,
    props: { ...args, ...resultado.props },
    imports: [...(component ? [component] : []), ...(resultado.moduleMetadata?.imports ?? [])],
    providers: [
      ...(resultado.moduleMetadata?.providers ?? []),
      ...(resultado.applicationConfig?.providers ?? []),
    ],
  };
}

function gerarTemplate(component: Type<unknown>, args: Record<string, unknown>): string {
  const seletor = reflectComponentType(component)?.selector ?? 'div';
  const ligacoes = Object.keys(args)
    .map((chave) => `[${chave}]="${chave}"`)
    .join(' ');
  return `<${seletor} ${ligacoes}></${seletor}>`;
}
