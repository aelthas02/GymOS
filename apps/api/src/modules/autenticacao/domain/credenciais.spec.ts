import {
  avaliarRefresh,
  chaveDoIdentificador,
  emMs,
  interpretarIdentificador,
  normalizarEmail,
  usoUnicoDisponivel,
} from './credenciais';

describe('identificador do aluno', () => {
  it.each([
    ['123.456.789-09', { tipo: 'cpf', cpf: '12345678909' }],
    ['12345678909', { tipo: 'cpf', cpf: '12345678909' }],
    ['  123.456.789-09 ', { tipo: 'cpf', cpf: '12345678909' }],
    ['Paulo@Exemplo.com', { tipo: 'email', email: 'paulo@exemplo.com' }],
  ])('%j vira %j', (texto, esperado) => {
    expect(interpretarIdentificador(texto)).toEqual(esperado);
  });

  it.each(['123.456.789-00', '11111111111', 'paulo', ''])('%j não serve', (texto) => {
    expect(interpretarIdentificador(texto)).toBeNull();
  });

  it('a chave do limite separa CPF e e-mail', () => {
    expect(chaveDoIdentificador({ tipo: 'cpf', cpf: '12345678909' })).toBe('cpf:12345678909');
    expect(chaveDoIdentificador({ tipo: 'email', email: 'a@b.com' })).toBe('email:a@b.com');
    expect(normalizarEmail(' A@B.COM ')).toBe('a@b.com');
  });
});

describe('uso único e refresh', () => {
  const agora = new Date('2026-11-23T12:00:00Z');
  const depois = emMs(agora, 1000);
  const antes = emMs(agora, -1000);

  it('uso único vale até expirar e uma vez só', () => {
    expect(usoUnicoDisponivel({ expiraEm: depois, usadoEm: null }, agora)).toBe(true);
    expect(usoUnicoDisponivel({ expiraEm: agora, usadoEm: null }, agora)).toBe(false);
    expect(usoUnicoDisponivel({ expiraEm: depois, usadoEm: antes }, agora)).toBe(false);
  });

  it('refresh usado ou revogado é reuso; vencido é só expirado', () => {
    const base = { expiraEm: depois, usadoEm: null, revogadoEm: null };
    expect(avaliarRefresh(base, agora)).toBe('valido');
    expect(avaliarRefresh({ ...base, usadoEm: antes }, agora)).toBe('reuso');
    expect(avaliarRefresh({ ...base, revogadoEm: antes }, agora)).toBe('reuso');
    expect(avaliarRefresh({ ...base, expiraEm: antes }, agora)).toBe('expirado');
  });
});
