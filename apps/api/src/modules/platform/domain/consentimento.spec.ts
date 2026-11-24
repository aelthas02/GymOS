import {
  ConsentimentoInvalidoError,
  dependeDeAceite,
  elegivelPara,
  type Finalidade,
  validarRegistro,
} from './consentimento';

const valido = {
  finalidade: 'marketing',
  decisao: 'aceite',
  origem: 'painel',
} as const;

describe('validarRegistro', () => {
  it('aceita finalidade que depende de aceite com origem', () => {
    expect(() => validarRegistro(valido)).not.toThrow();
  });

  it('recusa finalidade desconhecida', () => {
    expect(() => validarRegistro({ ...valido, finalidade: 'espionagem' as Finalidade })).toThrow(
      /Finalidade desconhecida: espionagem/,
    );
  });

  it('recusa a finalidade transacional (base contratual)', () => {
    expect(() => validarRegistro({ ...valido, finalidade: 'transacional' })).toThrow(
      ConsentimentoInvalidoError,
    );
  });

  it.each(['', '   ', '\t'])('recusa origem vazia (%j)', (origem) => {
    expect(() => validarRegistro({ ...valido, origem })).toThrow(/precisa da origem/);
  });
});

describe('elegibilidade', () => {
  it('transacional nunca depende de aceite', () => {
    expect(dependeDeAceite('transacional')).toBe(false);
    for (const decisao of [null, 'aceite', 'revogacao'] as const) {
      expect(elegivelPara('transacional', decisao)).toBe(true);
    }
  });

  it.each(['marketing', 'dados_de_saude', 'biometria'] as const)(
    '%s só vale com aceite como última decisão',
    (finalidade) => {
      expect(dependeDeAceite(finalidade)).toBe(true);
      expect(elegivelPara(finalidade, 'aceite')).toBe(true);
      expect(elegivelPara(finalidade, 'revogacao')).toBe(false);
      expect(elegivelPara(finalidade, null)).toBe(false);
    },
  );
});
