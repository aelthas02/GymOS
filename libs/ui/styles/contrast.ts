import { tokens } from './tokens';

/** Cor em hexadecimal no formato `#RRGGBB`, em maiúsculas. */
export type HexColor = `#${string}`;

/** Canais de 0 a 255, inteiros. */
export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Tema derivado da cor de destaque da academia (ADR-014). */
export interface AccentPalette {
  /** O acento normalizado, para fundos e preenchimentos. */
  readonly accent: HexColor;
  /** Texto e ícones sobre o acento. */
  readonly contrast: HexColor;
  /** Tom do acento para texto e ícones sobre `--surface` e `--page`. */
  readonly text: HexColor;
}

/** Contraste mínimo do WCAG 2 (AA) para texto normal. */
export const AA_CONTRAST = 4.5;

const WHITE: HexColor = '#FFFFFF';
const BLACK: HexColor = '#000000';
const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const LIGHT_BACKGROUNDS: readonly HexColor[] = [tokens.surface, tokens.page];
const SHADE_STEPS = 16;

export class InvalidColorError extends Error {
  readonly value: unknown;

  constructor(message: string, value: unknown) {
    super(message);
    this.value = value;
  }
}

export class InvalidHexColorError extends InvalidColorError {
  override readonly name = 'InvalidHexColorError';

  constructor(value: string) {
    super(`Cor hexadecimal inválida: "${value}". Use #RGB ou #RRGGBB.`, value);
  }
}

export class InvalidRgbColorError extends InvalidColorError {
  override readonly name = 'InvalidRgbColorError';

  constructor(value: RgbColor) {
    super(`Cor RGB inválida: ${JSON.stringify(value)}. Cada canal é um inteiro de 0 a 255.`, value);
  }
}

/** Aceita `#RGB` ou `#RRGGBB`, com ou sem `#`, e devolve `#RRGGBB` em maiúsculas. */
export function normalizeHex(value: string): HexColor {
  const trimmed = value.trim();
  if (!HEX_PATTERN.test(trimmed)) {
    throw new InvalidHexColorError(value);
  }

  const digits = trimmed.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;
  return `#${full.toUpperCase()}`;
}

export function hexToRgb(hex: string): RgbColor {
  const value = Number.parseInt(normalizeHex(hex).slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

export function rgbToHex(rgb: RgbColor): HexColor {
  const channels = [rgb.r, rgb.g, rgb.b];
  if (!channels.every(isChannel)) {
    throw new InvalidRgbColorError(rgb);
  }

  const digits = channels.map((channel) => channel.toString(16).padStart(2, '0')).join('');
  return `#${digits.toUpperCase()}`;
}

/** Luminância relativa do WCAG 2, de 0 (preto) a 1 (branco). */
export function relativeLuminance(color: string): number {
  const { r, g, b } = hexToRgb(color);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Razão de contraste do WCAG 2, de 1 a 21. A ordem das cores não importa. */
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Cor do texto sobre o acento: tinta ou branco, a de maior contraste. Nos tons médios em que
 * nenhuma das duas chega a 4,5:1 (um vermelho puro, por exemplo), usa preto, que sempre chega.
 */
export function accentContrast(accent: string): HexColor {
  const onInk = contrastRatio(accent, tokens.ink);
  const onWhite = contrastRatio(accent, WHITE);
  if (Math.max(onInk, onWhite) < AA_CONTRAST) {
    return BLACK;
  }
  return onInk >= onWhite ? tokens.ink : WHITE;
}

/**
 * Tom do acento para texto e ícones em fundo claro: o próprio acento, se já tiver 4,5:1 sobre
 * `--surface` e `--page`; senão, o tom mais claro do acento escurecido (misturado com preto, que
 * mantém o matiz) que chega a 4,5:1 sobre os dois.
 */
export function accentText(accent: string): HexColor {
  const base = hexToRgb(accent);
  if (isLegibleOnLightBackgrounds(shade(base, 1))) {
    return shade(base, 1);
  }

  // Busca binária no fator de escurecimento: 0 é preto (sempre legível), 1 é o acento (não é).
  let legible = 0;
  let illegible = 1;
  for (let step = 0; step < SHADE_STEPS; step += 1) {
    const middle = (legible + illegible) / 2;
    if (isLegibleOnLightBackgrounds(shade(base, middle))) {
      legible = middle;
    } else {
      illegible = middle;
    }
  }
  return shade(base, legible);
}

export function accentPalette(accent: string): AccentPalette {
  return {
    accent: normalizeHex(accent),
    contrast: accentContrast(accent),
    text: accentText(accent),
  };
}

function isChannel(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function shade({ r, g, b }: RgbColor, factor: number): HexColor {
  return rgbToHex({
    r: Math.round(r * factor),
    g: Math.round(g * factor),
    b: Math.round(b * factor),
  });
}

function isLegibleOnLightBackgrounds(color: HexColor): boolean {
  return LIGHT_BACKGROUNDS.every((background) => contrastRatio(color, background) >= AA_CONTRAST);
}
