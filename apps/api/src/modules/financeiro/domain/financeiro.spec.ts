import type { DataCivil } from '../../platform/domain/relogio';
import {
  acumularPartes,
  folhaDoPeriodo,
  inadimplencia,
  periodoAnterior,
  porcentagensInteiras,
  ratearReceitaDoAluno,
  receitaLiquida,
  receitaVazia,
  resolverPeriodo,
  setorPrincipalDoPlano,
  variacaoEmPontosBase,
} from './financeiro';
import type { Centavos } from '@gymos/shared-money';

const dia = (texto: string): DataCivil => texto as DataCivil;

describe('receita e indicadores', () => {
  it('receita líquida = bruta − taxas − despesas', () => {
    expect(receitaLiquida(5_490_000 as Centavos, 198_000 as Centavos, 460_000 as Centavos)).toBe(
      4_832_000,
    );
  });

  it('inadimplência em pontos-base: 12 de 312 → 385 (3,85%)', () => {
    expect(inadimplencia(12, 312)).toBe(385);
    expect(inadimplencia(0, 0)).toBe(0);
  });

  it('comparação "acima de outubro" em pontos-base', () => {
    expect(variacaoEmPontosBase(4_832_000, 4_610_000)).toBe(482);
    expect(variacaoEmPontosBase(10, 0)).toBeNull();
  });

  it('as porcentagens somam 100 pelo maior resto', () => {
    const pesos = porcentagensInteiras([27_500, 8_700, 5_100, 6_600, 4_900, 2_100]);
    expect(pesos.reduce((soma, valor) => soma + valor, 0)).toBe(100);
    expect(pesos[0]).toBe(50);
    expect(porcentagensInteiras([0, 0])).toEqual([0, 0]);
  });
});

describe('períodos no calendário de São Paulo', () => {
  it('"Este mês" em 01/12 00:30 de São Paulo (03:30 UTC) é dezembro', () => {
    // O relógio entrega o dia de São Paulo: 2026-12-01T03:30Z já é 01/12 00:30 em São Paulo.
    const hoje = dia('2026-12-01');
    expect(resolverPeriodo('este-mes', hoje)).toMatchObject({
      de: '2026-12-01',
      ate: '2026-12-31',
    });
    expect(periodoAnterior(resolverPeriodo('este-mes', hoje))).toMatchObject({
      de: '2026-11-01',
      ate: '2026-11-30',
    });
  });

  it('trimestre, ano, 7 dias e personalizado', () => {
    const hoje = dia('2026-11-19');
    expect(resolverPeriodo('trimestre', hoje)).toMatchObject({
      de: '2026-10-01',
      ate: '2026-12-31',
    });
    expect(resolverPeriodo('ano', hoje)).toMatchObject({ de: '2026-01-01', ate: '2026-12-31' });
    expect(resolverPeriodo('7-dias', hoje)).toMatchObject({ de: '2026-11-13', ate: '2026-11-19' });
    expect(periodoAnterior(resolverPeriodo('7-dias', hoje))).toMatchObject({
      de: '2026-11-06',
      ate: '2026-11-12',
    });
    expect(() => resolverPeriodo('personalizado', hoje, { de: '2026-11-10' })).toThrow();
    expect(() =>
      resolverPeriodo('personalizado', hoje, { de: '2026-11-10', ate: '2026-11-01' }),
    ).toThrow();
  });

  it('a folha do mês cheio é o custo mensal; em período parcial, proporcional aos dias', () => {
    expect(folhaDoPeriodo(230_000, { de: dia('2026-11-01'), ate: dia('2026-11-30') })).toBe(
      230_000,
    );
    expect(folhaDoPeriodo(300_000, { de: dia('2026-11-01'), ate: dia('2026-11-10') })).toBe(
      100_000,
    );
  });
});

describe('rateio da receita por presença (ADR-020)', () => {
  const musculacao = {
    setor: 'musculacao',
    aulaId: null,
    aulaNome: null,
    professorId: null,
  } as const;
  const crossfit = {
    setor: 'aulas',
    aulaId: 'crossfit',
    aulaNome: 'CrossFit',
    professorId: 'diego',
  } as const;
  const pilates = {
    setor: 'aulas',
    aulaId: 'pilates',
    aulaNome: 'Pilates',
    professorId: 'lia',
  } as const;

  it('Mensal de R$ 119,00 com 6 musculação, 3 CrossFit (Diego) e 1 Pilates (Lia)', () => {
    const presencas = [
      ...Array.from({ length: 6 }, () => musculacao),
      ...Array.from({ length: 3 }, () => crossfit),
      pilates,
    ];
    const total = acumularPartes(
      receitaVazia(),
      ratearReceitaDoAluno(11_900, 'musculacao', presencas),
    );

    expect(total.porSetor).toMatchObject({ musculacao: 7_140, aulas: 4_760 });
    expect(total.porAula).toEqual([
      { aulaId: 'crossfit', aulaNome: 'CrossFit', setor: 'aulas', centavos: 3_570 },
      { aulaId: 'pilates', aulaNome: 'Pilates', setor: 'aulas', centavos: 1_190 },
    ]);
    expect(total.porProfessor).toEqual([
      { professorId: 'diego', centavos: 3_570 },
      { professorId: 'lia', centavos: 1_190 },
    ]);
  });

  it('a soma das partes é sempre o valor (resto vai ao maior resto)', () => {
    const partes = ratearReceitaDoAluno(10_000, 'musculacao', [musculacao, crossfit, pilates]);
    expect(partes.reduce((soma, parte) => soma + parte.centavos, 0)).toBe(10_000);
  });

  it('aluno sem presença no mês: 100% no setor principal do plano', () => {
    expect(ratearReceitaDoAluno(11_900, 'lutas', [])).toEqual([
      { setor: 'lutas', aulaId: null, aulaNome: null, professorId: null, centavos: 11_900 },
    ]);
  });

  it('setor principal do plano pelas modalidades', () => {
    expect(setorPrincipalDoPlano(['Musculação', 'Lutas'])).toBe('musculacao');
    expect(setorPrincipalDoPlano(['Lutas'])).toBe('lutas');
    expect(setorPrincipalDoPlano(['Spinning'])).toBe('aulas');
    expect(setorPrincipalDoPlano([])).toBe('musculacao');
  });
});
