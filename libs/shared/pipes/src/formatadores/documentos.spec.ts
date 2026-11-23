import { formatarCnpj, formatarCpf, formatarTelefone } from './documentos';

describe('formatarCpf', () => {
  it('pontua o CPF cru', () => {
    expect(formatarCpf('12345678909')).toBe('123.456.789-09');
    expect(formatarCpf('123.456.789-09')).toBe('123.456.789-09');
  });

  it('devolve como veio o que não tem 11 dígitos', () => {
    expect(formatarCpf('1234')).toBe('1234');
  });
});

describe('formatarCnpj', () => {
  it('pontua o CNPJ cru, numérico ou alfanumérico', () => {
    expect(formatarCnpj('12345678000195')).toBe('12.345.678/0001-95');
    expect(formatarCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
  });

  it('devolve como veio o que não tem 14 caracteres', () => {
    expect(formatarCnpj('123')).toBe('123');
  });
});

describe('formatarTelefone', () => {
  it.each([
    ['11999990000', '(11) 99999-0000'],
    ['1133334444', '(11) 3333-4444'],
    ['+5511999990000', '(11) 99999-0000'],
    ['551133334444', '(11) 3333-4444'],
    ['(11) 99999-0000', '(11) 99999-0000'],
  ])('%s → %s', (cru, exibido) => {
    expect(formatarTelefone(cru)).toBe(exibido);
  });

  it('devolve como veio o que não tem 10 nem 11 dígitos', () => {
    expect(formatarTelefone('0800')).toBe('0800');
  });
});
