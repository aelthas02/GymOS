/**
 * gymos/no-hardcoded-color: nenhuma cor escrita à mão no front fora de libs/ui/styles (T04).
 * As cores vêm de var(--token) no CSS e de cssVar() no TypeScript; o tema da academia só funciona
 * se ninguém fixar uma cor por fora dele.
 *
 * Uma regra só, para as três linguagens do ESLint do projeto:
 * - CSS e SCSS (@eslint/css, modo tolerante): hex, funções de cor (rgb, hsl...) sem var() e nomes
 *   de cor em propriedades de cor; trechos que o parser não entende (Raw) passam pela busca de texto;
 * - TypeScript e JavaScript: strings e template strings com hex ou função de cor;
 * - templates Angular: atributos (style, fill, stroke...) e bindings com hex ou função de cor.
 */

const HEX = /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const COLOR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const COLOR_FUNCTION_NAMES = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
]);
const COLOR_PROPERTY =
  /color|^background$|^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$|^outline$|^fill$|^stroke$|shadow$|^text-decoration$|^column-rule$/i;
// Atributos de template que não levam cor e podem conter "#": âncoras e rotas.
const NON_COLOR_ATTRIBUTES = new Set(['href', 'xlink:href', 'routerlink', 'fragment', 'src']);

// Nomes de cor do CSS (CSS Color 4). transparent e currentColor não fixam cor e ficam de fora.
const NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue ' +
    'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk ' +
    'crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki ' +
    'darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue ' +
    'dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite ' +
    'gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
    'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen ' +
    'magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen ' +
    'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
    'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
    'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen ' +
    'steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
  ).split(' '),
);

/** Cores fixas num trecho de texto, com a posição de cada uma. */
function colorsInText(text) {
  return [...text.matchAll(HEX), ...text.matchAll(COLOR_FUNCTION)]
    .filter((match) => match[0].startsWith('#') || !referencesToken(text, match.index))
    .map((match) => ({ color: match[0].replace(/\($/, '()'), index: match.index }))
    .sort((a, b) => a.index - b.index);
}

// rgb(from var(--accent) r g b / 50%) deriva do token; só a função com valores fixos é proibida.
function referencesToken(text, start) {
  const end = text.indexOf(')', start);
  return text.slice(start, end === -1 ? undefined : end).includes('var(');
}

// Converte um span do compilador do Angular (linha a partir de 0) em loc do ESLint.
function spanToLoc(span) {
  return {
    start: { line: span.start.line + 1, column: span.start.col },
    end: { line: span.end.line + 1, column: span.end.col },
  };
}

export const noHardcodedColor = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Proíbe cor fixa no front fora de libs/ui/styles; use var(--token) ou cssVar().',
    },
    schema: [],
    messages: {
      hardcoded:
        'Cor fixa "{{color}}" fora de libs/ui/styles. Use um token: var(--nome) no CSS ou cssVar() ' +
        'de @gymos/ui no TypeScript; se a cor não existir, crie o token em libs/ui/styles.',
    },
  },
  create(context) {
    const report = (color, loc) => context.report({ loc, messageId: 'hardcoded', data: { color } });
    let declaration = null;

    return {
      // CSS e SCSS
      Declaration(node) {
        declaration = node;
      },
      'Declaration:exit'() {
        declaration = null;
      },
      Hash(node) {
        report(`#${node.value}`, node.loc);
      },
      Function(node) {
        if (
          COLOR_FUNCTION_NAMES.has(node.name.toLowerCase()) &&
          !context.sourceCode.getText(node).includes('var(')
        ) {
          report(`${node.name}()`, node.loc);
        }
      },
      Identifier(node) {
        if (
          declaration !== null &&
          COLOR_PROPERTY.test(declaration.property) &&
          NAMED_COLORS.has(node.name.toLowerCase())
        ) {
          report(node.name, node.loc);
        }
      },
      Raw(node) {
        for (const { color } of colorsInText(node.value)) {
          report(color, node.loc);
        }
      },

      // TypeScript e JavaScript
      Literal(node) {
        if (typeof node.value === 'string') {
          for (const { color } of colorsInText(node.value)) {
            report(color, node.loc);
          }
        }
      },
      TemplateElement(node) {
        for (const { color } of colorsInText(node.value.raw)) {
          report(color, node.loc);
        }
      },

      // Templates Angular
      Element(node) {
        for (const attribute of node.attributes) {
          if (!NON_COLOR_ATTRIBUTES.has(attribute.name.toLowerCase())) {
            for (const { color } of colorsInText(attribute.value)) {
              report(color, spanToLoc(attribute.sourceSpan));
            }
          }
        }
        for (const input of node.inputs) {
          for (const { color } of colorsInText(input.value?.source ?? '')) {
            report(color, spanToLoc(input.sourceSpan));
          }
        }
      },
    };
  },
};

export default {
  meta: { name: 'gymos' },
  rules: { 'no-hardcoded-color': noHardcodedColor },
};
