import {
  AA_CONTRAST,
  accentContrast,
  accentPalette,
  accentText,
  contrastRatio,
  hexToRgb,
  InvalidColorError,
  InvalidHexColorError,
  InvalidRgbColorError,
  normalizeHex,
  relativeLuminance,
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

describe('InvalidRgbColorError: canais fora de 0–255', () => {
  it.each([
    { r: -1, g: 0, b: 0 },
    { r: 0, g: 256, b: 0 },
    { r: 0, g: 0, b: 1.5 },
    { r: Number.NaN, g: 0, b: 0 },
    { r: 0, g: 0, b: Number.POSITIVE_INFINITY },
  ])('rgbToHex(%o) lança InvalidRgbColorError', (rgb) => {
    expect(() => rgbToHex(rgb)).toThrow(InvalidRgbColorError);
  });

  it('o erro é um InvalidColorError e guarda o valor recebido', () => {
    const rgb = { r: 300, g: 0, b: 0 };
    const erro = capturar(() => rgbToHex(rgb));

    expect(erro).toBeInstanceOf(InvalidColorError);
    expect(erro).toMatchObject({ name: 'InvalidRgbColorError', value: rgb });
  });

  it('os limites 0 e 255 são aceitos', () => {
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00FF00');
  });
});

describe('normalizeHex', () => {
  it.each([
    ['#abc', '#AABBCC'],
    ['abc', '#AABBCC'],
    ['#22c98a', '#22C98A'],
    ['22c98a', '#22C98A'],
    ['  #1e3a8a  ', '#1E3A8A'],
    ['#FFF', '#FFFFFF'],
  ])('"%s" vira %s', (entrada, esperado) => {
    expect(normalizeHex(entrada)).toBe(esperado);
  });

  it('lança InvalidHexColorError para valor inválido', () => {
    expect(() => normalizeHex('#12')).toThrow(InvalidHexColorError);
  });

  it('hexToRgb aceita o formato curto', () => {
    expect(hexToRgb('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });
});

describe('relativeLuminance', () => {
  it('preto é 0 e branco é 1', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 10);
  });

  it('canal abaixo do limiar 0.04045 usa o trecho linear', () => {
    expect(relativeLuminance('#0A0000')).toBeCloseTo(0.2126 * (10 / 255 / 12.92), 10);
  });

  it('canal acima do limiar usa o trecho de potência', () => {
    expect(relativeLuminance('#800000')).toBeCloseTo(0.2126 * 0.21586, 4);
  });
});

describe('contrastRatio', () => {
  it('preto sobre branco é 21', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 10);
  });

  it('é simétrico', () => {
    expect(contrastRatio('#22C98A', '#0C1722')).toBe(contrastRatio('#0C1722', '#22C98A'));
  });

  it('cores iguais dão 1', () => {
    expect(contrastRatio('#22C98A', '#22C98A')).toBe(1);
  });
});

describe('accentContrast: casos de borda', () => {
  it('em tom médio em que nem tinta nem branco chegam a 4,5:1, usa preto', () => {
    expect(contrastRatio('#777777', INK)).toBeLessThan(AA_CONTRAST);
    expect(contrastRatio('#777777', WHITE)).toBeLessThan(AA_CONTRAST);
    expect(accentContrast('#777777')).toBe('#000000');
    expect(contrastRatio('#777777', '#000000')).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it('branco recebe tinta e preto recebe branco', () => {
    expect(accentContrast('#FFFFFF')).toBe(INK);
    expect(accentContrast('#000000')).toBe(WHITE);
  });

  it('aceita hex curto e sem #', () => {
    expect(accentContrast('1e3a8a')).toBe(WHITE);
    expect(accentContrast('#fff')).toBe(INK);
  });
});

describe('accentText: casos de borda', () => {
  it('devolve o próprio acento quando já é legível', () => {
    expect(accentText('#1E3A8A')).toBe('#1E3A8A');
  });

  it('devolve o acento normalizado quando já é legível, mesmo em hex curto', () => {
    expect(accentText('#000')).toBe('#000000');
  });

  it.each(['#22C98A', '#3AA6F0', '#FF8A3D', '#A78BFA', '#FFFFFF', '#FFE600', '#FF0000'])(
    'escurece %s até chegar a 4,5:1 sobre #FFFFFF e #F3F5F2',
    (acento) => {
      const tom = accentText(acento);

      expect(contrastRatio(tom, WHITE)).toBeGreaterThanOrEqual(AA_CONTRAST);
      expect(contrastRatio(tom, PAGE)).toBeGreaterThanOrEqual(AA_CONTRAST);
    },
  );

  it('escurece um acento claro demais para texto', () => {
    expect(accentText('#22C98A')).not.toBe('#22C98A');
  });
});

describe('accentPalette', () => {
  it('reúne acento normalizado, contraste e tom de texto', () => {
    expect(accentPalette('22c98a')).toEqual({
      accent: '#22C98A',
      contrast: accentContrast('#22C98A'),
      text: accentText('#22C98A'),
    });
  });

  it('lança InvalidHexColorError para hex inválido', () => {
    expect(() => accentPalette('azul')).toThrow(InvalidHexColorError);
  });
});

describe('propriedade: contraste e texto sempre ≥ 4,5:1', () => {
  // Grade determinística de 6³ = 216 cores, mais 17 cinzas, sem aleatoriedade.
  const passos = [0, 51, 102, 153, 204, 255];
  const amostra = [
    ...passos.flatMap((r) => passos.flatMap((g) => passos.map((b) => rgbToHex({ r, g, b })))),
    ...Array.from({ length: 17 }, (_, i) => rgbToHex({ r: i * 15, g: i * 15, b: i * 15 })),
  ];

  it('o texto sobre o acento tem ao menos 4,5:1 para toda a amostra', () => {
    for (const cor of amostra) {
      expect(contrastRatio(cor, accentContrast(cor)), cor).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });

  it('o tom de texto tem ao menos 4,5:1 sobre #FFFFFF e #F3F5F2 para toda a amostra', () => {
    for (const cor of amostra) {
      const tom = accentText(cor);
      expect(contrastRatio(tom, WHITE), cor).toBeGreaterThanOrEqual(AA_CONTRAST);
      expect(contrastRatio(tom, PAGE), cor).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });
});

function capturar(acao: () => unknown): unknown {
  try {
    acao();
  } catch (erro) {
    return erro;
  }
  throw new Error('a ação não lançou erro');
}
