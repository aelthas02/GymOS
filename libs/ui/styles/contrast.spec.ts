import {
  accentContrast,
  accentText,
  contrastRatio,
  hexToRgb,
  InvalidColorError,
  InvalidHexColorError,
  rgbToHex,
} from './contrast';

const INK = '#0C1722';
const WHITE = '#FFFFFF';
const PAGE = '#F3F5F2';

describe('accentContrast: texto sobre o acento', () => {
  it('o acento padrão #22C98A recebe texto tinta, com contraste ≥ 4.5:1', () => {
    const texto = accentContrast('#22C98A');

    expect(texto).toBe(INK);
    expect(contrastRatio('#22C98A', texto)).toBeGreaterThanOrEqual(4.5);
  });

  it('um acento azul escuro #1E3A8A recebe texto branco, com contraste ≥ 4.5:1', () => {
    const texto = accentContrast('#1E3A8A');

    expect(texto).toBe(WHITE);
    expect(contrastRatio('#1E3A8A', texto)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('accentText: tom do acento para texto e ícones em fundo claro', () => {
  it('para #22C98A devolve uma cor com contraste ≥ 4.5:1 sobre #FFFFFF', () => {
    const tom = accentText('#22C98A');

    expect(contrastRatio(tom, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('para #22C98A devolve uma cor com contraste ≥ 4.5:1 também sobre a página #F3F5F2', () => {
    const tom = accentText('#22C98A');

    expect(contrastRatio(tom, PAGE)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('conversão entre Hex e RGB', () => {
  it.each(['', 'red', '#12345', '#GGGGGG', '#22C98A80', '22C98A0'])(
    'o hex inválido "%s" lança InvalidHexColorError',
    (valor) => {
      expect(() => hexToRgb(valor)).toThrow(InvalidHexColorError);
    },
  );

  it('o erro de hex inválido é um InvalidColorError e guarda o valor recebido', () => {
    const erro = capturar(() => hexToRgb('#12345'));

    expect(erro).toBeInstanceOf(InvalidColorError);
    expect(erro).toMatchObject({ name: 'InvalidHexColorError', value: '#12345' });
  });

  it.each([
    { r: 34, g: 201, b: 138 },
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
    { r: 30, g: 58, b: 138 },
    { r: 1, g: 128, b: 254 },
  ])('RGB → Hex → RGB volta sem perda: %o', (rgb) => {
    expect(hexToRgb(rgbToHex(rgb))).toEqual(rgb);
  });

  it.each(['#22C98A', '#0C1722', '#FFFFFF', '#000000', '#1E3A8A'])(
    'Hex → RGB → Hex volta sem perda: %s',
    (hex) => {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
    },
  );
});

function capturar(acao: () => unknown): unknown {
  try {
    acao();
  } catch (erro) {
    return erro;
  }
  throw new Error('a ação não lançou erro');
}
