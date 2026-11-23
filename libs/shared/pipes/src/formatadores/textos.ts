/** As quatro variantes do Badge das listas (ok, late, soon, off). */
export type SituacaoDoBadge = 'ok' | 'late' | 'soon' | 'off';

const PARTICULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

/** 'Rafael Souza' → 'RS'; 'Maria da Silva Santos' → 'MS'; um nome só → uma letra. */
export function iniciais(nome: string): string {
  const palavras = nome
    .trim()
    .split(/\s+/)
    .filter((palavra) => palavra && !PARTICULAS.has(palavra.toLowerCase()));
  return palavras
    .filter((_, indice) => indice === 0 || indice === palavras.length - 1)
    .map((palavra) => palavra.charAt(0))
    .join('')
    .toLocaleUpperCase('pt-BR');
}

function plural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/** Texto do Badge: 'late' com 6 dias → 'Em atraso, 6 dias'; 'soon' com 0 → 'Vence hoje'. */
export function rotuloDeStatus(situacao: SituacaoDoBadge, dias?: number | null): string {
  switch (situacao) {
    case 'ok':
      return 'Em dia';
    case 'off':
      return 'Inativo';
    case 'late':
      return dias == null ? 'Em atraso' : `Em atraso, ${plural(dias, 'dia', 'dias')}`;
    case 'soon':
      if (dias == null) {
        return 'A vencer';
      }
      if (dias === 0) {
        return 'Vence hoje';
      }
      return dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`;
  }
}
