import type { DataCivil } from '../../platform/domain/relogio';
import {
  diasDoChipDeValidade,
  evolucaoDeCarga,
  pedidoDeGeracao,
  situacaoDaFicha,
  venceEmBreve,
} from './ficha';

const dia = (valor: string) => valor as DataCivil;
const HOJE = dia('2026-11-19');
const ativa = (validaAte: string) => ({ situacao: 'ativa' as const, validaAte: dia(validaAte) });

describe('validade da ficha', () => {
  it('entra em "vencem em 30 dias" com validade daqui a 30 dias, mas não com 31', () => {
    expect(venceEmBreve(ativa('2026-12-19'), HOJE)).toBe(true);
    expect(venceEmBreve(ativa('2026-12-20'), HOJE)).toBe(false);
    expect(diasDoChipDeValidade(ativa('2026-12-20'), HOJE)).toBe(31);
  });

  it('válida até ontem vira "vencida"; até hoje ainda vale', () => {
    expect(situacaoDaFicha(ativa('2026-11-18'), HOJE)).toBe('vencida');
    expect(situacaoDaFicha(ativa('2026-11-19'), HOJE)).toBe('ativa');
  });
});

describe('evolução de carga', () => {
  it('supino de 32 a 40 kg em 6 semanas dá "+8 kg em 6 semanas"', () => {
    const cargas = [32, 34, 36, 36, 38, 40];
    const registros = cargas.map((cargaKg, i) => {
      const data = new Date(Date.UTC(2026, 9, 8 + i * 8));
      return { dia: dia(data.toISOString().slice(0, 10)), cargaKg };
    });

    expect(evolucaoDeCarga('Supino reto', registros)?.texto).toBe('+8 kg em 6 semanas');
  });
});

describe('pedido à IA', () => {
  it('não leva nome nem CPF do aluno', () => {
    const pedido = pedidoDeGeracao({
      objetivo: 'Hipertrofia',
      nivel: 'intermediario',
      frequenciaSemanal: 4,
      divisao: 'ABC',
      restricoes: 'joelho sensível',
    });

    expect(Object.keys(pedido.dados).sort()).toEqual([
      'divisao',
      'frequenciaSemanal',
      'nivel',
      'objetivo',
      'restricoes',
    ]);
  });
});
