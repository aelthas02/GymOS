import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface ResultadoDaComparacao {
  pixelsDiferentes: number;
  total: number;
  fracao: number;
  mesmasDimensoes: boolean;
  /** PNG com as diferenças em vermelho. */
  diff: Buffer;
}

/** Cópia do PNG num lienço maior, com o resto transparente (conta como diferença). */
function emLienco(origem: PNG, largura: number, altura: number): PNG {
  const lienco = new PNG({ width: largura, height: altura });
  PNG.bitblt(origem, lienco, 0, 0, origem.width, origem.height, 0, 0);
  return lienco;
}

/** Compara dois PNGs pixel a pixel; tamanhos diferentes contam a área extra como diferença. */
export function compararPng(referencia: Buffer, atual: Buffer): ResultadoDaComparacao {
  const a = PNG.sync.read(referencia);
  const b = PNG.sync.read(atual);
  const largura = Math.max(a.width, b.width);
  const altura = Math.max(a.height, b.height);
  const diff = new PNG({ width: largura, height: altura });
  const pixelsDiferentes = pixelmatch(
    emLienco(a, largura, altura).data,
    emLienco(b, largura, altura).data,
    diff.data,
    largura,
    altura,
    { threshold: 0.1 },
  );
  const total = largura * altura;
  return {
    pixelsDiferentes,
    total,
    fracao: pixelsDiferentes / total,
    mesmasDimensoes: a.width === b.width && a.height === b.height,
    diff: PNG.sync.write(diff),
  };
}
