/**
 * Conjunto de ícones próprio: traço de 2 px em grade de 24, estilo contorno. Cada ícone é uma lista
 * de comandos `d` de `<path>`; círculos e retângulos viram arcos e linhas para o `Icon` desenhar
 * tudo com `<path>` e sem `innerHTML`.
 */
const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const icons = {
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z'],
  trash: [
    'M3 6h18',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
    'M10 11v6',
    'M14 11v6',
  ],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  qr: [
    'M3 3h7v7H3Z',
    'M14 3h7v7h-7Z',
    'M3 14h7v7H3Z',
    'M14 14h3v3h-3Z',
    'M20 14v.01',
    'M14 20h3',
    'M20 17v4',
  ],
  dumbbell: ['M6 7v10', 'M18 7v10', 'M3 9.5v5', 'M21 9.5v5', 'M6 12h12'],
  calendar: [
    'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
    'M16 2v4',
    'M8 2v4',
    'M3 10h18',
  ],
  bag: ['M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: [circle(11, 11, 7), 'M21 21l-4.3-4.3'],
  close: ['M18 6L6 18', 'M6 6l12 12'],
  check: ['M20 6L9 17l-5-5'],
  'chevron-left': ['M15 18l-6-6 6-6'],
  'chevron-right': ['M9 18l6-6-6-6'],
  'chevron-down': ['M6 9l6 6 6-6'],
  'arrow-up': ['M12 19V5', 'M5 12l7-7 7 7'],
  'arrow-down': ['M12 5v14', 'M19 12l-7 7-7-7'],
  sort: ['M7 15l5 5 5-5', 'M7 9l5-5 5 5'],
  help: [circle(12, 12, 10), 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3', 'M12 17h.01'],
  info: [circle(12, 12, 10), 'M12 16v-4', 'M12 8h.01'],
  alert: [
    'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    'M12 9v4',
    'M12 17h.01',
  ],
  lock: ['M5 11h14v10H5Z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', circle(12, 7, 4)],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof icons;

export const iconNames = Object.keys(icons) as IconName[];
