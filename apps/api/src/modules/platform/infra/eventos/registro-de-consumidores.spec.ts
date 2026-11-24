import { ConsumidorInvalidoError, RegistroDeConsumidores } from './registro-de-consumidores';

const consumidor = (nome: string, fila?: 'notas') => ({
  nome,
  evento: 'PagamentoConfirmado' as const,
  fila,
  tratar: () => Promise.resolve(),
});

describe('RegistroDeConsumidores', () => {
  it.each(['semponto', 'Fiscal.emitir', 'fiscal.', '1fiscal.emitir', 'fiscal emitir.x', ''])(
    'recusa o nome "%s" fora do formato dominio.acao',
    (nome) => {
      expect(() => new RegistroDeConsumidores().registrar(consumidor(nome))).toThrow(
        ConsumidorInvalidoError,
      );
    },
  );

  it.each(['fiscal.emitir-nota', 'cache.invalida.resumo', 'a1.b2'])('aceita "%s"', (nome) => {
    expect(() => new RegistroDeConsumidores().registrar(consumidor(nome))).not.toThrow();
  });

  it('recusa nome duplicado', () => {
    const registro = new RegistroDeConsumidores();
    registro.registrar(consumidor('fiscal.emitir'));

    expect(() => registro.registrar(consumidor('fiscal.emitir'))).toThrow(/registrado duas vezes/);
  });

  it('a fila padrão é "eventos"', () => {
    const registro = new RegistroDeConsumidores();
    registro.registrar(consumidor('fiscal.emitir'));
    registro.registrar(consumidor('fiscal.outro', 'notas'));

    expect(registro.consumidor('fiscal.emitir')?.fila).toBe('eventos');
    expect(registro.consumidor('fiscal.outro')?.fila).toBe('notas');
    expect(registro.filas().sort()).toEqual(['eventos', 'notas']);
  });

  it('doEvento devolve só os consumidores do tipo', () => {
    const registro = new RegistroDeConsumidores();
    registro.registrar(consumidor('fiscal.emitir'));

    expect(registro.doEvento('PagamentoConfirmado')).toHaveLength(1);
    expect(registro.doEvento('CobrancaCriada')).toEqual([]);
    expect(registro.consumidor('nao.existe')).toBeUndefined();
  });
});
