import { ehTipoDeEvento, TIPOS_DE_EVENTO, VERSAO_ATUAL } from './catalogo';

describe('catálogo de eventos', () => {
  it('lista os eventos já conhecidos, todos na versão 1', () => {
    expect(TIPOS_DE_EVENTO).toHaveLength(17);
    expect(new Set(Object.values(VERSAO_ATUAL))).toEqual(new Set([1]));
  });

  it('reconhece só os tipos do catálogo', () => {
    expect(ehTipoDeEvento('PagamentoConfirmado')).toBe(true);
    expect(ehTipoDeEvento('PagamentoInventado')).toBe(false);
    expect(ehTipoDeEvento('toString')).toBe(false);
    expect(ehTipoDeEvento(42)).toBe(false);
  });
});
