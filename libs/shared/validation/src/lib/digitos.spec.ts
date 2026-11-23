import { somenteDigitos } from './digitos';

describe('somenteDigitos', () => {
  it('tira pontuação e espaços', () => {
    expect(somenteDigitos('123.456.789-09')).toBe('12345678909');
    expect(somenteDigitos('(11) 99999-0000')).toBe('11999990000');
    expect(somenteDigitos('sem dígitos')).toBe('');
  });
});
