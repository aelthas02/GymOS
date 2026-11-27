import { HttpErrorResponse } from '@angular/common/http';
import type { BadgeVariant } from '@gymos/ui';
import type { ItemDaLista } from '../models/aluno';

const MENSAGEM_PADRAO = 'Não foi possível concluir agora. Tente de novo em instantes.';

const plural = (quantidade: number, singular: string, mais: string): string =>
  `${quantidade} ${quantidade === 1 ? singular : mais}`;

/** Texto da coluna "Adimplência": "Em dia", "Vence em 3 dias", "Em atraso, 6 dias". */
export function textoDaSituacao(
  item: Pick<ItemDaLista, 'situacao' | 'diasDeAtraso' | 'venceEmDias'>,
): string {
  if (item.situacao === 'em_atraso') {
    return `Em atraso, ${plural(item.diasDeAtraso, 'dia', 'dias')}`;
  }
  if (item.situacao === 'a_vencer') {
    const dias = item.venceEmDias ?? 0;
    return dias === 0 ? 'Vence hoje' : `Vence em ${plural(dias, 'dia', 'dias')}`;
  }
  return 'Em dia';
}

const VARIANTES: Record<ItemDaLista['situacao'], BadgeVariant> = {
  em_dia: 'ok',
  a_vencer: 'soon',
  em_atraso: 'late',
};

export function variantDaSituacao(situacao: ItemDaLista['situacao']): BadgeVariant {
  return VARIANTES[situacao];
}

/** O nome do plano da linha, ou "—" quando o aluno não tem contrato. */
export function nomeDoPlano(item: Pick<ItemDaLista, 'plano'>): string {
  return item.plano?.nome ?? '—';
}

/**
 * Busca numérica incompleta: a API só acha CPF e telefone completos (índice cego, T13c). Devolve a
 * dica de "use o CPF completo" quando o texto parece um CPF cortado.
 */
export function dicaDaBusca(busca: string): string | null {
  const texto = busca.trim();
  if (!/^[\d.\-\s]+$/.test(texto)) {
    return null;
  }
  const digitos = texto.replace(/\D/g, '').length;
  return digitos >= 1 && digitos < 11
    ? 'Para buscar por CPF, use o CPF completo (11 dígitos), com ou sem pontuação.'
    : null;
}

/** Mensagem que a API devolveu (`{ message }` do Nest, texto ou lista); senão, o texto padrão. */
export function mensagemDaApi(erro: unknown, padrao: string = MENSAGEM_PADRAO): string {
  if (!(erro instanceof HttpErrorResponse)) {
    return padrao;
  }
  const mensagem: unknown = (erro.error as { message?: unknown } | null)?.message;
  if (typeof mensagem === 'string' && mensagem !== '') {
    return mensagem;
  }
  if (Array.isArray(mensagem) && mensagem.length > 0) {
    return mensagem.join(' ');
  }
  return padrao;
}

/** Texto do CSV: aspas duplicadas e campo entre aspas quando precisa. */
export function celulaDeCsv(valor: string): string {
  return /[";\n\r]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor;
}

/** Baixa um texto como arquivo (CSV com BOM para o Excel abrir em UTF-8). */
export function baixarTexto(nome: string, conteudo: string, tipo = 'text/csv'): void {
  baixarBlob(
    nome,
    new Blob([String.fromCharCode(0xfeff), conteudo], { type: `${tipo};charset=utf-8` }),
  );
}

export function baixarBlob(nome: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
