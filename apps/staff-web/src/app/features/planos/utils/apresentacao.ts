import { HttpErrorResponse } from '@angular/common/http';
import { centavos, formatarBrl } from '@gymos/shared-money';
import type { SelectOption } from '@gymos/ui';
import type { DadosDoPlano, FormaDeCobranca, Plano } from '../models/plano';

/** Modalidades que a API aceita num plano (o catálogo mora no domínio da API). */
export const MODALIDADES = ['Musculação', 'Spinning', 'Funcional', 'Lutas', 'Aulas'] as const;

export const FORMAS_DE_COBRANCA: readonly (SelectOption & { value: FormaDeCobranca })[] = [
  { value: 'cartao_ou_pix', label: 'Cartão de crédito ou PIX' },
  { value: 'cartao', label: 'Cartão de crédito' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
];

/** "" é ilimitado (a API usa `null`); de 1 a 7 acessos por semana. */
export const ACESSOS_POR_SEMANA: readonly SelectOption[] = [
  { value: '', label: 'Ilimitado' },
  ...[1, 2, 3, 4, 5, 6, 7].map((dias) => ({ value: String(dias), label: `${dias}x por semana` })),
];

const MENSAGEM_PADRAO = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Duração como a lista mostra: "1 mês", "12 meses". */
export function textoDaDuracao(meses: number): string {
  return meses === 1 ? '1 mês' : `${meses} meses`;
}

/** Parcelas como a lista mostra: "9x R$ 105,33". */
export function textoDasParcelas(plano: Plano): string {
  return `${plano.parcelas}x ${formatarBrl(centavos(plano.parcelaCentavos))}`;
}

/** Coluna "Inclui": todas as modalidades, ou os nomes ligados por "e" ("Musculação e aulas"). */
export function textoDoQueInclui(modalidades: readonly string[]): string {
  if (MODALIDADES.every((modalidade) => modalidades.includes(modalidade))) {
    return 'Todas as modalidades';
  }
  const nomes = modalidades.map((nome, indice) => (indice === 0 ? nome : nome.toLowerCase()));
  if (nomes.length <= 1) {
    return nomes[0] ?? '—';
  }
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/** Os dados editáveis de um plano, para reenviar com uma única mudança (inativar). */
export function dadosDoPlano(plano: Plano): DadosDoPlano {
  return {
    nome: plano.nome,
    valorTotalCentavos: plano.valorTotalCentavos,
    duracaoMeses: plano.duracaoMeses,
    parcelas: plano.parcelas,
    formaDeCobranca: plano.formaDeCobranca,
    modalidades: [...plano.modalidades],
    acessosPorSemana: plano.acessosPorSemana,
    renovacaoAutomatica: plano.renovacaoAutomatica,
    ativo: plano.ativo,
  };
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
