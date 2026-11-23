import { validarCep, validarEmail, validarTelefone } from './contato';

describe('validarTelefone', () => {
  it.each([
    '(11) 99999-0000',
    '11999990000',
    '(11) 3333-4444',
    '1133334444',
    '(21) 2222-3333',
    '(99) 5555-0000',
    '+55 11 99999-0000',
    '+5511999990000',
  ])('%j é telefone BR', (telefone) => {
    expect(validarTelefone(telefone)).toBe(true);
  });

  it('distingue celular de fixo quando o tipo é pedido', () => {
    expect(validarTelefone('(11) 99999-0000', 'celular')).toBe(true);
    expect(validarTelefone('(11) 3333-4444', 'celular')).toBe(false);
    expect(validarTelefone('(11) 3333-4444', 'fixo')).toBe(true);
    expect(validarTelefone('(11) 99999-0000', 'fixo')).toBe(false);
  });

  it.each([
    ['(10) 99999-0000', 'DDD inexistente'],
    ['(20) 3333-4444', 'DDD inexistente'],
    ['(11) 89999-0000', 'celular sem o 9'],
    ['(11) 1333-4444', 'fixo começando com 1'],
    ['(11) 6333-4444', 'fixo começando com 6'],
    ['999990000', 'sem DDD'],
    ['(11) 99999-00000', 'dígito a mais'],
    ['55 11 99999-0000', 'código do país sem +'],
    ['+1 11 99999-0000', 'outro país'],
    ['(11) 9999a-0000', 'letra'],
    ['', 'vazio'],
  ])('%j é inválido (%s)', (telefone) => {
    expect(validarTelefone(telefone)).toBe(false);
  });
});

describe('validarEmail', () => {
  it.each(['pedro@email.com', 'ana.souza+gym@academia.com.br', 'a@b.co', 'UPPER@EXAMPLE.COM'])(
    '%j é válido',
    (email) => {
      expect(validarEmail(email)).toBe(true);
    },
  );

  it.each([
    '',
    'pedro',
    'pedro@',
    '@email.com',
    'pedro@email',
    'pedro@@email.com',
    'pedro @email.com',
    'pedro@email..com',
    'pedro@-email.com',
    '.pedro@email.com',
    'pedro.@email.com',
    'pedro@email.c',
  ])('%j é inválido', (email) => {
    expect(validarEmail(email)).toBe(false);
  });

  it('recusa endereço com mais de 254 caracteres', () => {
    expect(
      validarEmail(`${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.com`),
    ).toBe(false);
    expect(validarEmail(`${'a'.repeat(64)}@${'b'.repeat(63)}.com`)).toBe(true);
  });
});

describe('validarCep', () => {
  it.each(['01310-100', '01310100'])('%j é válido', (cep) => {
    expect(validarCep(cep)).toBe(true);
  });

  it.each(['0131-0100', '00000-000', '1234567', 'abcde-fgh', ''])('%j é inválido', (cep) => {
    expect(validarCep(cep)).toBe(false);
  });
});
