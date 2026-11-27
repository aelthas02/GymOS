import { centavos, formatarBrl } from '@gymos/shared-money';
import type { BadgeVariant, TabItem } from '@gymos/ui';
import type { SituacaoDaNota } from '../models/notas';

/** Etiqueta da situação da nota, com as cores de FinNotas.html. */
export const SITUACAO_DA_NOTA: Readonly<
  Record<SituacaoDaNota, { readonly rotulo: string; readonly variante: BadgeVariant }>
> = {
  emitida: { rotulo: 'Emitida', variante: 'ok' },
  pendente: { rotulo: 'Pendente', variante: 'soon' },
  processando: { rotulo: 'Processando', variante: 'soon' },
  rejeitada: { rotulo: 'Rejeitada', variante: 'late' },
  cancelada: { rotulo: 'Cancelada', variante: 'off' },
};

/** "Visualizar por" do Financeiro: as outras visões são do T21. */
export const VISOES_DO_FINANCEIRO: readonly TabItem[] = [
  { label: 'Geral', link: '/financeiro' },
  { label: 'Setores', link: '/financeiro/setores' },
  { label: 'Funcionários', link: '/financeiro/funcionarios' },
  { label: 'Alunos', link: '/financeiro/alunos' },
  { label: 'Aulas', link: '/financeiro/aulas' },
  { label: 'Planos', link: '/financeiro/planos' },
  { label: 'Forma de pagamento', link: '/financeiro/formas-de-pagamento' },
  { label: 'Notas fiscais', link: '/financeiro/notas-fiscais' },
];

export const PERIODOS = ['Hoje', '7 dias', 'Este mês', 'Trimestre', 'Ano'] as const;

/** Largura da barra do "Resumo por tipo": a maior é 100%. */
export function larguraDaBarra(valor: number, maior: number): string {
  return maior > 0 ? `${Math.round((valor * 100) / maior)}%` : '0%';
}

/** KPI de valor como em FinNotas.html: "R$ 54.900" (reais arredondados, sem centavos). */
export function reaisInteiros(valorCentavos: number): string {
  return formatarBrl(centavos(Math.round(valorCentavos / 100) * 100)).replace(/,00$/, '');
}

/** Baixa um arquivo recebido da API (ZIP da exportação). */
export function baixarArquivo(conteudo: Blob, nome: string, documento: Document): void {
  const url = URL.createObjectURL(conteudo);
  const link = documento.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
