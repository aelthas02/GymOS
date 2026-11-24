import { formatarDataBr } from '@gymos/shared-pipes/formatadores';
import { textoDaAcao, textoDoModulo } from './atividade';

export interface LinhaDoLog {
  ocorridoEm: Date;
  quem: string;
  papel: string;
  acao: string;
  modulo: string;
  detalhe: string;
  sensivel: boolean;
}

export const CABECALHO_DO_CSV = [
  'Quando',
  'Quem',
  'Ação',
  'Módulo',
  'Sensível',
  'Detalhe',
] as const;

/** "Carla Menezes (Gerente)"; o administrador aparece só como "Administrador", como em Log.html. */
export function descricaoDeQuem(quem: string, papel: string): string {
  return quem === papel ? quem : `${quem} (${papel})`;
}

/**
 * Célula iniciada por `=`, `+`, `-`, `@`, tab ou CR é lida como fórmula pelo Excel: ganha um
 * apóstrofo na frente. Aspas e quebras de linha seguem o RFC 4180; o separador é `;` (Excel pt-BR).
 */
export function celulaDoCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

export function linhaDoCsv(linha: LinhaDoLog): string {
  return [
    formatarDataBr(linha.ocorridoEm, 'dataHora'),
    descricaoDeQuem(linha.quem, linha.papel),
    textoDaAcao(linha.acao),
    textoDoModulo(linha.modulo),
    linha.sensivel ? 'Sim' : 'Não',
    linha.detalhe,
  ]
    .map(celulaDoCsv)
    .join(';');
}

export function cabecalhoDoCsv(): string {
  return CABECALHO_DO_CSV.join(';');
}
