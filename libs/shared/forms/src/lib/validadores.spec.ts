import { FormControl, FormGroup, Validators, type ValidatorFn } from '@angular/forms';
import { centavos, formatarBrl } from '@gymos/shared-money';
import { MENSAGENS_DE_ERRO, mensagemDeErro } from './mensagens';
import { Validadores } from './validadores';

const erros = (valor: unknown, validador: ValidatorFn) => new FormControl(valor, validador).errors;

describe('Validadores de texto', () => {
  it.each([
    ['cpf', Validadores.cpf, '123.456.789-09', '123.456.789-00'],
    ['cnpj', Validadores.cnpj, '12.345.678/0001-95', '12.345.678/0001-90'],
    ['telefone', Validadores.telefone(), '(11) 99999-0000', '(10) 99999-0000'],
    ['email', Validadores.email, 'pedro@email.com', 'pedro@'],
    ['cep', Validadores.cep, '01310-100', '00000-000'],
    ['senhaForte', Validadores.senhaForte, 'gymos2026', 'gymos'],
    ['data', Validadores.data, '19/11/2026', '30/02/2026'],
    ['competencia', Validadores.competencia, '11/2026', '13/2026'],
    ['urlYoutube', Validadores.urlYoutube, 'https://youtu.be/dQw4w9WgXcQ', 'https://vimeo.com/1'],
  ])(
    '%s: válido passa, inválido marca o erro, vazio fica para o required',
    (chave, validador, valido, invalido) => {
      expect(erros(valido, validador)).toBeNull();
      expect(erros(invalido, validador)).toEqual({ [chave]: true });
      expect(erros('', validador)).toBeNull();
      expect(erros(null, validador)).toBeNull();
      expect(erros(12345678909, validador)).toEqual({ [chave]: true });
    },
  );

  it('telefone pode exigir celular (WhatsApp)', () => {
    expect(erros('(11) 3333-4444', Validadores.telefone('celular'))).toEqual({ telefone: true });
    expect(erros('(11) 99999-0000', Validadores.telefone('celular'))).toBeNull();
  });

  it('data aceita Date', () => {
    expect(erros(new Date('2026-11-19T12:00:00Z'), Validadores.data)).toBeNull();
  });
});

describe('Validadores de limite', () => {
  const emReais = (valor: number) => formatarBrl(centavos(valor));

  it('mínimo e máximo inclusivos, com o limite formatado para a mensagem', () => {
    expect(erros(1000, Validadores.minimo(1000, emReais))).toBeNull();
    expect(erros(999, Validadores.minimo(1000, emReais))).toEqual({
      minimo: { limite: 1000, atual: 999, exibicao: 'R$ 10,00' },
    });
    expect(erros(1001, Validadores.maximo(1000))).toEqual({
      maximo: { limite: 1000, atual: 1001, exibicao: '1000' },
    });
    expect(erros(1000, Validadores.maximo(1000))).toBeNull();
  });

  it('vazio fica para o required e texto não é número', () => {
    expect(erros(null, Validadores.minimo(1))).toBeNull();
    expect(erros('', Validadores.maximo(1))).toBeNull();
    expect(erros('10', Validadores.minimo(1))).toEqual({
      minimo: { limite: 1, atual: '10', exibicao: '1' },
    });
  });
});

describe('Validadores.intervaloDeDatas (no grupo)', () => {
  const grupo = (inicio: unknown, fim: unknown, permitirIgual?: boolean) =>
    new FormGroup(
      { inicio: new FormControl(inicio), fim: new FormControl(fim) },
      { validators: Validadores.intervaloDeDatas('inicio', 'fim', { permitirIgual }) },
    ).errors;

  it('marca o grupo quando o fim vem antes do início', () => {
    expect(grupo('2026-11-30', '2026-11-01')).toEqual({ intervaloDeDatas: true });
    expect(grupo('2026-11-01', '2026-11-30')).toBeNull();
  });

  it('respeita permitirIgual', () => {
    expect(grupo('2026-11-19', '2026-11-19')).toBeNull();
    expect(grupo('2026-11-19', '2026-11-19', false)).toEqual({ intervaloDeDatas: true });
  });

  it('deixa para os campos quando falta uma ponta ou o tipo não é data', () => {
    expect(grupo('', '2026-11-01')).toBeNull();
    expect(grupo('2026-11-01', null)).toBeNull();
    expect(grupo(20261101, '2026-11-01')).toEqual({ intervaloDeDatas: true });
  });

  it('sem os campos no grupo não acusa erro', () => {
    const semCampos = new FormGroup({}, { validators: Validadores.intervaloDeDatas('a', 'b') });

    expect(semCampos.errors).toBeNull();
  });
});

describe('mensagemDeErro', () => {
  it('traduz o primeiro erro conhecido, com o required antes de todos', () => {
    expect(mensagemDeErro({ cpf: true })).toBe('CPF inválido.');
    expect(mensagemDeErro({ cpf: true, required: true })).toBe('Campo obrigatório.');
    expect(mensagemDeErro({ desconhecido: true, cnpj: true })).toBe('CNPJ inválido.');
  });

  it('usa o detalhe do erro quando a mensagem depende dele', () => {
    expect(mensagemDeErro({ minimo: { limite: 1000, atual: 1, exibicao: 'R$ 10,00' } })).toBe(
      'O mínimo é R$ 10,00.',
    );
    expect(mensagemDeErro({ maximo: { limite: 5, atual: 6, exibicao: '5' } })).toBe(
      'O máximo é 5.',
    );
    expect(mensagemDeErro({ minlength: { requiredLength: 8, actualLength: 3 } })).toBe(
      'Use pelo menos 8 caracteres.',
    );
    expect(mensagemDeErro({ maxlength: { requiredLength: 60, actualLength: 61 } })).toBe(
      'Use no máximo 60 caracteres.',
    );
  });

  it('sem erro não há mensagem; erro sem tradução tem mensagem genérica', () => {
    expect(mensagemDeErro(null)).toBeNull();
    expect(mensagemDeErro(undefined)).toBeNull();
    expect(mensagemDeErro({})).toBeNull();
    expect(mensagemDeErro({ desconhecido: true })).toBe('Valor inválido.');
  });

  it('funciona com os erros de um FormControl', () => {
    const controle = new FormControl('123.456.789-00', [Validators.required, Validadores.cpf]);

    expect(mensagemDeErro(controle.errors)).toBe('CPF inválido.');
  });

  it('todas as mensagens são curtas e terminam com ponto', () => {
    const textos = Object.values(MENSAGENS_DE_ERRO).flatMap((mensagem) =>
      typeof mensagem === 'string' ? [mensagem] : [],
    );

    expect(textos.every((texto) => texto.endsWith('.') && texto.length <= 60)).toBe(true);
  });
});
