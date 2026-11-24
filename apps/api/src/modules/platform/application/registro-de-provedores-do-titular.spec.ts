import {
  type ProvedorDeDadosDoTitular,
  ProvedorDoTitularDuplicadoError,
  RegistroDeProvedoresDoTitular,
} from './direitos-do-titular';

const provedor = (dominio: string): ProvedorDeDadosDoTitular => ({
  dominio,
  exportar: async () => ({}),
  excluirOuAnonimizar: async () => ({ registros: 0 }),
});

describe('RegistroDeProvedoresDoTitular', () => {
  it('registrar o mesmo domínio duas vezes lança ProvedorDoTitularDuplicadoError', () => {
    const registro = new RegistroDeProvedoresDoTitular();
    registro.registrar(provedor('treinos'));

    expect(() => registro.registrar(provedor('treinos'))).toThrow(ProvedorDoTitularDuplicadoError);
    expect(registro.provedores()).toHaveLength(1);
  });

  it('mantém a ordem de registro', () => {
    const registro = new RegistroDeProvedoresDoTitular();
    registro.registrar(provedor('b'));
    registro.registrar(provedor('a'));

    expect(registro.provedores().map((p) => p.dominio)).toEqual(['b', 'a']);
  });
});
