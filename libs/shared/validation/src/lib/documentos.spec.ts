import { validarCnpj, validarCpf } from './documentos';

describe('validarCpf', () => {
  it.each([
    '123.456.789-09',
    '12345678909',
    '987.654.321-00',
    '529.982.247-25',
    ' 123.456.789-09 ',
  ])('%j é válido', (cpf) => {
    expect(validarCpf(cpf)).toBe(true);
  });

  it('aceita pontuação parcial nas posições certas', () => {
    expect(validarCpf('123456789-09')).toBe(true);
  });

  it('123.456.789-00, o exemplo "Ok" de Importar e Passo 5, é inválido (inconsistencias.md)', () => {
    expect(validarCpf('123.456.789-00')).toBe(false);
  });

  it.each([
    ['111.111.111-11', 'dígitos repetidos'],
    ['000.000.000-00', 'dígitos repetidos'],
    ['123.456.789-19', 'primeiro dígito verificador errado'],
    ['123.456.789-08', 'segundo dígito verificador errado'],
    ['1234567890', 'dez dígitos'],
    ['123456789090', 'doze dígitos'],
    ['123-456-789.09', 'pontuação fora do lugar'],
    ['123.456.789-0a', 'letra'],
    ['', 'vazio'],
  ])('%j é inválido (%s)', (cpf) => {
    expect(validarCpf(cpf)).toBe(false);
  });
});

describe('validarCnpj', () => {
  it.each(['12.345.678/0001-95', '12345678000195', ' 12.345.678/0001-95 '])(
    '%j é válido',
    (cnpj) => {
      expect(validarCnpj(cnpj)).toBe(true);
    },
  );

  it('12.345.678/0001-90, o exemplo de Configurações, é inválido (inconsistencias.md)', () => {
    expect(validarCnpj('12.345.678/0001-90')).toBe(false);
  });

  it('aceita o CNPJ alfanumérico (Receita Federal, a partir de julho de 2026)', () => {
    expect(validarCnpj('12.ABC.345/01DE-35')).toBe(true);
    expect(validarCnpj('12ABC34501DE35')).toBe(true);
    expect(validarCnpj('12.abc.345/01de-35')).toBe(true);
    expect(validarCnpj('12.ABC.345/01DE-36')).toBe(false);
  });

  it.each([
    ['11.111.111/1111-11', 'repetido'],
    ['00000000000000', 'repetido'],
    ['AAAAAAAAAAAA00', 'dígitos verificadores errados'],
    ['12.345.678/0001-05', 'primeiro dígito verificador errado'],
    ['12.345.678/0001-9A', 'dígito verificador com letra'],
    ['1234567800019', 'treze caracteres'],
    ['12.345.678/0001_95', 'pontuação estranha'],
    ['', 'vazio'],
  ])('%j é inválido (%s)', (cnpj) => {
    expect(validarCnpj(cnpj)).toBe(false);
  });
});
