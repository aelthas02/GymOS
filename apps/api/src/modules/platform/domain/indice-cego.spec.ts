import { normalizarParaIndice } from './indice-cego';

describe('normalizarParaIndice', () => {
  it.each([
    ['cpf', '123.456.789-09', '12345678909'],
    ['cpf', ' 123 456 789 09 ', '12345678909'],
    ['cpf', '12345678909', '12345678909'],
    ['telefone', '(11) 98765-4321', '11987654321'],
    ['telefone', '+55 11 98765-4321', '5511987654321'],
    ['telefone', '11 9 8765 4321', '11987654321'],
    ['email', 'A@X.com ', 'a@x.com'],
    ['email', '  Maria.Silva@Exemplo.COM', 'maria.silva@exemplo.com'],
    ['email', 'ma ria @x.com', 'maria@x.com'],
    ['email', 'a\t@x.com\n', 'a@x.com'],
  ] as const)('%s %j → %j', (tipo, valor, esperado) => {
    expect(normalizarParaIndice(tipo, valor)).toBe(esperado);
  });

  it('e-mail mantém os dígitos; CPF descarta as letras', () => {
    expect(normalizarParaIndice('email', 'a1@x.com')).toBe('a1@x.com');
    expect(normalizarParaIndice('cpf', 'abc')).toBe('');
  });
});
