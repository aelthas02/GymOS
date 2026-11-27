import { pontosBase, ratearPorPeso, type Centavos, type PontosBase } from '@gymos/shared-money';
import { diasEntre, somarDias } from '../../alunos/domain/datas';
import { type DataCivil, FUSO_PADRAO } from '../../platform/domain/relogio';

// Regras puras do Financeiro (T21, ADR-020): períodos no calendário de São Paulo, receita líquida,
// inadimplência, comparação e o rateio da receita de plano pelas presenças do aluno no mês.
// Dinheiro em centavos inteiros e percentuais em pontos-base, com as funções de `shared-money`.

export { FUSO_PADRAO };

// --- setores e origens -----------------------------------------------------------------------

export const SETORES = ['musculacao', 'aulas', 'lutas', 'loja', 'personal', 'nutricao'] as const;
export type Setor = (typeof SETORES)[number];

export const ROTULO_DO_SETOR: Readonly<Record<Setor, string>> = {
  musculacao: 'Planos de musculação',
  aulas: 'Aulas coletivas',
  lutas: 'Lutas',
  loja: 'Loja',
  personal: 'Personal',
  nutricao: 'Nutrição',
};

/** Origens (T19) cuja receita é de plano e passa pelo rateio. */
const ORIGENS_DE_PLANO: readonly string[] = ['mensalidade', 'plano'];

export const ehReceitaDePlano = (origem: string): boolean => ORIGENS_DE_PLANO.includes(origem);

/** Setor que recebe direto a receita que não é de plano (aula avulsa, personal, nutrição, loja). */
export function setorDaReceitaDireta(origem: string): Setor {
  switch (origem) {
    case 'personal':
      return 'personal';
    case 'nutricao':
      return 'nutricao';
    case 'loja':
      return 'loja';
    default:
      return 'aulas';
  }
}

/**
 * Setor principal do plano: onde cai o check-in de quem não frequenta aula e a receita de quem não
 * tem presença no mês. Musculação vence; plano só de lutas vai para Lutas; só de aulas, para Aulas.
 */
export function setorPrincipalDoPlano(modalidades: readonly string[]): Setor {
  if (modalidades.includes('Musculação')) {
    return 'musculacao';
  }
  if (modalidades.includes('Lutas')) {
    return 'lutas';
  }
  if (modalidades.some((modalidade) => ['Aulas', 'Spinning', 'Funcional'].includes(modalidade))) {
    return 'aulas';
  }
  return 'musculacao';
}

// --- períodos --------------------------------------------------------------------------------

export const CHAVES_DE_PERIODO = [
  'hoje',
  '7-dias',
  'este-mes',
  'trimestre',
  'ano',
  'personalizado',
] as const;
export type ChaveDePeriodo = (typeof CHAVES_DE_PERIODO)[number];

export interface Periodo {
  chave: ChaveDePeriodo;
  de: DataCivil;
  ate: DataCivil;
}

/** Mês civil `AAAA-MM`. */
export type MesCivil = string;

export class PeriodoInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'PeriodoInvalidoError';
  }
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

const dia = (ano: number, mes: number, d: number): DataCivil =>
  `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}` as DataCivil;

function partes(data: string): [number, number, number] {
  const [ano = 0, mes = 0, d = 0] = data.split('-').map(Number);
  return [ano, mes, d];
}

const diasDoMes = (ano: number, mes: number): number =>
  new Date(Date.UTC(ano, mes, 0)).getUTCDate();

export const mesDaData = (data: string): MesCivil => data.slice(0, 7);

export function intervaloDoMes(mes: MesCivil): { de: DataCivil; ate: DataCivil } {
  const [ano, numero] = partes(`${mes}-01`);
  return { de: dia(ano, numero, 1), ate: dia(ano, numero, diasDoMes(ano, numero)) };
}

/** `Novembro 2026`. */
export function rotuloDoMes(mes: MesCivil): string {
  const [ano, numero] = partes(`${mes}-01`);
  return `${MESES[numero - 1]} ${ano}`;
}

/** `Nov`, `Jun`: rótulo curto do gráfico mensal. */
export function rotuloCurtoDoMes(mes: MesCivil): string {
  const [, numero] = partes(`${mes}-01`);
  return (MESES[numero - 1] as string).slice(0, 3);
}

export function somarMesesCivis(mes: MesCivil, quantidade: number): MesCivil {
  const [ano, numero] = partes(`${mes}-01`);
  const indice = ano * 12 + (numero - 1) + quantidade;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`;
}

/**
 * Período pedido no calendário de São Paulo. "Este mês" é o mês civil de `hoje` inteiro: em
 * 01/12 00:30 de São Paulo (03:30 UTC) já é dezembro. Trimestre e ano são os civis em curso.
 */
export function resolverPeriodo(
  chave: ChaveDePeriodo,
  hoje: DataCivil,
  personalizado?: { de?: string; ate?: string },
): Periodo {
  const [ano, mes] = partes(hoje);
  switch (chave) {
    case 'hoje':
      return { chave, de: hoje, ate: hoje };
    case '7-dias':
      return { chave, de: somarDias(hoje, -6), ate: hoje };
    case 'este-mes':
      return { chave, ...intervaloDoMes(mesDaData(hoje)) };
    case 'trimestre': {
      const primeiro = Math.floor((mes - 1) / 3) * 3 + 1;
      return {
        chave,
        de: dia(ano, primeiro, 1),
        ate: intervaloDoMes(`${ano}-${String(primeiro + 2).padStart(2, '0')}`).ate,
      };
    }
    case 'ano':
      return { chave, de: dia(ano, 1, 1), ate: dia(ano, 12, 31) };
    case 'personalizado': {
      const { de, ate } = personalizado ?? {};
      if (!de || !ate || !ehDia(de) || !ehDia(ate)) {
        throw new PeriodoInvalidoError('Informe o início e o fim do período personalizado.');
      }
      if (de > ate) {
        throw new PeriodoInvalidoError('O início do período vem depois do fim.');
      }
      return { chave, de: de as DataCivil, ate: ate as DataCivil };
    }
  }
}

function ehDia(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }
  const [ano, mes, d] = partes(valor);
  return mes >= 1 && mes <= 12 && d >= 1 && d <= diasDoMes(ano, mes);
}

/**
 * Período usado na comparação: mês, trimestre e ano civis vão ao anterior; os demais, à janela de
 * mesmo tamanho logo antes.
 */
export function periodoAnterior(periodo: Periodo): Periodo {
  const { chave, de, ate } = periodo;
  if (chave === 'este-mes' || chave === 'trimestre' || chave === 'ano') {
    const meses = chave === 'este-mes' ? 1 : chave === 'trimestre' ? 3 : 12;
    const inicio = somarMesesCivis(mesDaData(de), -meses);
    const fim = somarMesesCivis(mesDaData(de), -1);
    return { chave, de: intervaloDoMes(inicio).de, ate: intervaloDoMes(fim).ate };
  }
  const tamanho = diasEntre(de, ate) + 1;
  return { chave, de: somarDias(de, -tamanho), ate: somarDias(de, -1) };
}

/** Meses civis tocados pelo período, em ordem. */
export function mesesDoPeriodo(periodo: Pick<Periodo, 'de' | 'ate'>): MesCivil[] {
  const meses: MesCivil[] = [];
  for (
    let mes = mesDaData(periodo.de);
    mes <= mesDaData(periodo.ate);
    mes = somarMesesCivis(mes, 1)
  ) {
    meses.push(mes);
  }
  return meses;
}

/** Interseção do período com o mês, ou nulo quando não se tocam. */
export function recortarNoMes(
  periodo: Pick<Periodo, 'de' | 'ate'>,
  mes: MesCivil,
): { de: DataCivil; ate: DataCivil } | null {
  const doMes = intervaloDoMes(mes);
  const de = periodo.de > doMes.de ? periodo.de : doMes.de;
  const ate = periodo.ate < doMes.ate ? periodo.ate : doMes.ate;
  return de <= ate ? { de, ate } : null;
}

// --- totais ----------------------------------------------------------------------------------

/** Receita líquida = bruta − taxas − despesas. */
export function receitaLiquida(bruta: Centavos, taxas: Centavos, despesas: Centavos): Centavos {
  return (bruta - taxas - despesas) as Centavos;
}

/** Alunos em atraso ÷ alunos ativos, em pontos-base (12 de 312 → 385 = 3,85%). */
export function inadimplencia(emAtraso: number, ativos: number): PontosBase {
  return pontosBase(ativos <= 0 ? 0 : Math.round((emAtraso * 10_000) / ativos));
}

/** Variação sobre o período anterior em pontos-base (48.320 sobre 46.100 → 482); nula sem base. */
export function variacaoEmPontosBase(atual: number, anterior: number): PontosBase | null {
  if (anterior <= 0) {
    return null;
  }
  return pontosBase(Math.round(((atual - anterior) * 10_000) / anterior));
}

/**
 * Porcentagens inteiras que somam exatamente 100, pelo maior resto. Sem valor nenhum, todas 0.
 */
export function porcentagensInteiras(valores: readonly number[]): number[] {
  const total = valores.reduce((soma, valor) => soma + Math.max(0, valor), 0);
  if (total <= 0) {
    return valores.map(() => 0);
  }
  return ratearPorPeso(
    100 as PontosBase,
    valores.map((valor) => Math.max(0, valor)),
  );
}

/**
 * Folha do período: o custo mensal da equipe é de cada mês; em período parcial, proporcional aos
 * dias do mês que o período cobre (mês inteiro = o custo cheio).
 */
export function folhaDoPeriodo(
  custoMensalCentavos: number,
  periodo: Pick<Periodo, 'de' | 'ate'>,
): number {
  let total = 0;
  for (const mes of mesesDoPeriodo(periodo)) {
    const recorte = recortarNoMes(periodo, mes);
    if (!recorte) {
      continue;
    }
    const [ano, numero] = partes(`${mes}-01`);
    const diasCobertos = diasEntre(recorte.de, recorte.ate) + 1;
    total += Math.round((custoMensalCentavos * diasCobertos) / diasDoMes(ano, numero));
  }
  return total;
}

// --- rateio de receita (ADR-020) -------------------------------------------------------------

/** Uma presença do aluno no mês: check-in (setor do plano) ou aula (setor, aula e professor). */
export interface Presenca {
  setor: Setor;
  aulaId: string | null;
  aulaNome: string | null;
  professorId: string | null;
}

/** Parte da receita de um aluno atribuída a um setor, e à aula e ao professor quando houver. */
export interface ParteDaReceita extends Presenca {
  centavos: number;
}

const chaveDaPresenca = (p: Presenca): string =>
  `${p.setor}|${p.aulaId ?? ''}|${p.professorId ?? ''}`;

/**
 * Distribui a receita de plano de um aluno no mês pelas presenças dele, pelo maior resto (a soma das
 * partes é sempre o valor). Sem presença, 100% vai ao setor principal do plano.
 */
export function ratearReceitaDoAluno(
  valorCentavos: number,
  setorPrincipal: Setor,
  presencas: readonly Presenca[],
): ParteDaReceita[] {
  if (valorCentavos === 0) {
    return [];
  }
  if (presencas.length === 0) {
    return [
      {
        setor: setorPrincipal,
        aulaId: null,
        aulaNome: null,
        professorId: null,
        centavos: valorCentavos,
      },
    ];
  }
  const grupos = new Map<string, { presenca: Presenca; quantidade: number }>();
  for (const presenca of presencas) {
    const chave = chaveDaPresenca(presenca);
    const grupo = grupos.get(chave);
    if (grupo) {
      grupo.quantidade += 1;
    } else {
      grupos.set(chave, { presenca, quantidade: 1 });
    }
  }
  const lista = [...grupos.values()];
  const valores = ratearPorPeso(
    valorCentavos as Centavos,
    lista.map((grupo) => grupo.quantidade),
  );
  return lista
    .map((grupo, indice) => ({ ...grupo.presenca, centavos: valores[indice] as number }))
    .filter((parte) => parte.centavos !== 0);
}

export interface ReceitaPorAula {
  aulaId: string;
  aulaNome: string;
  setor: Setor;
  centavos: number;
}

export interface ReceitaPorProfessor {
  professorId: string;
  centavos: number;
}

export interface ReceitaRateada {
  porSetor: Record<Setor, number>;
  porAula: ReceitaPorAula[];
  porProfessor: ReceitaPorProfessor[];
}

export const receitaVazia = (): ReceitaRateada => ({
  porSetor: { musculacao: 0, aulas: 0, lutas: 0, loja: 0, personal: 0, nutricao: 0 },
  porAula: [],
  porProfessor: [],
});

/** Soma as partes (de vários alunos e meses) por setor, aula e professor. */
export function acumularPartes(
  acumulado: ReceitaRateada,
  partesDaReceita: readonly ParteDaReceita[],
): ReceitaRateada {
  for (const parte of partesDaReceita) {
    acumulado.porSetor[parte.setor] += parte.centavos;
    if (parte.aulaId !== null) {
      const aula = acumulado.porAula.find((item) => item.aulaId === parte.aulaId);
      if (aula) {
        aula.centavos += parte.centavos;
      } else {
        acumulado.porAula.push({
          aulaId: parte.aulaId,
          aulaNome: parte.aulaNome ?? '',
          setor: parte.setor,
          centavos: parte.centavos,
        });
      }
    }
    if (parte.professorId !== null) {
      acumularDoProfessor(acumulado, parte.professorId, parte.centavos);
    }
  }
  return acumulado;
}

export function acumularDoProfessor(
  acumulado: ReceitaRateada,
  professorId: string,
  centavos: number,
): void {
  const professor = acumulado.porProfessor.find((item) => item.professorId === professorId);
  if (professor) {
    professor.centavos += centavos;
  } else {
    acumulado.porProfessor.push({ professorId, centavos });
  }
}
