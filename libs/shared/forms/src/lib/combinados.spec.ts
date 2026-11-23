import { FormControl, FormGroup, Validators } from '@angular/forms';
import { centavos, formatarBrl } from '@gymos/shared-money';
import { mensagemDeErro } from './mensagens';
import { Validadores } from './validadores';

function cadastro(valores: { cpf: string | null; email: string | null; senha: string | null }) {
  return new FormGroup(
    {
      cpf: new FormControl(valores.cpf, [Validators.required, Validadores.cpf]),
      email: new FormControl(valores.email, [Validators.required, Validadores.email]),
      senha: new FormControl(valores.senha, [
        Validators.required,
        Validators.minLength(8),
        Validadores.senhaForte,
      ]),
    },
    { validators: Validadores.intervaloDeDatas('nada', 'nunca') },
  );
}

describe('Validadores com Validators.required num FormGroup real', () => {
  it('campos vazios: só o required aparece, nunca o validador de formato', () => {
    const grupo = cadastro({ cpf: '', email: null, senha: '' });

    expect(grupo.get('cpf')?.errors).toEqual({ required: true });
    expect(grupo.get('email')?.errors).toEqual({ required: true });
    expect(grupo.get('senha')?.errors).toEqual({ required: true });
    expect(grupo.valid).toBe(false);
    expect(mensagemDeErro(grupo.get('cpf')?.errors)).toBe('Campo obrigatório.');
  });

  it('preenchido errado: sai só o erro de formato, e a mensagem é a dele', () => {
    const grupo = cadastro({ cpf: '123.456.789-00', email: 'pedro@', senha: 'Gymos2026' });

    expect(grupo.get('cpf')?.errors).toEqual({ cpf: true });
    expect(grupo.get('email')?.errors).toEqual({ email: true });
    expect(grupo.get('senha')?.errors).toBeNull();
    expect(mensagemDeErro(grupo.get('cpf')?.errors)).toBe('CPF inválido.');
    expect(mensagemDeErro(grupo.get('email')?.errors)).toBe('E-mail inválido.');
  });

  it('tudo certo: o grupo fica válido', () => {
    const grupo = cadastro({ cpf: '529.982.247-25', email: 'pedro@email.com', senha: 'gymos2026' });

    expect(grupo.valid).toBe(true);
    expect(grupo.errors).toBeNull();
  });

  it('reage a setValue: apagar o CPF troca "CPF inválido" por "Campo obrigatório"', () => {
    const grupo = cadastro({ cpf: '123', email: 'a@b.co', senha: 'gymos2026' });
    const cpf = grupo.get('cpf');

    expect(mensagemDeErro(cpf?.errors)).toBe('CPF inválido.');
    cpf?.setValue('');
    expect(mensagemDeErro(cpf?.errors)).toBe('Campo obrigatório.');
    cpf?.setValue('529.982.247-25');
    expect(cpf?.valid).toBe(true);
  });

  it('campo desabilitado não acusa erro nem invalida o grupo', () => {
    const grupo = cadastro({ cpf: 'lixo', email: 'a@b.co', senha: 'gymos2026' });
    grupo.get('cpf')?.disable();

    expect(grupo.get('cpf')?.errors).toBeNull();
    expect(grupo.valid).toBe(true);
  });

  it('o validador do grupo e os dos campos não se misturam', () => {
    const grupo = new FormGroup(
      {
        inicio: new FormControl('2026-11-30', [Validators.required, Validadores.data]),
        fim: new FormControl('2026-11-01', [Validators.required, Validadores.data]),
      },
      { validators: Validadores.intervaloDeDatas('inicio', 'fim') },
    );

    expect(grupo.errors).toEqual({ intervaloDeDatas: true });
    expect(grupo.get('inicio')?.errors).toBeNull();
    expect(mensagemDeErro(grupo.errors)).toBe('A data final não pode ser antes da inicial.');
  });

  it('minimo com required: zero é preenchido e fica abaixo do mínimo', () => {
    const emReais = (valor: number) => formatarBrl(centavos(valor));
    const preco = new FormControl(0, [Validators.required, Validadores.minimo(1000, emReais)]);

    expect(preco.errors).toEqual({ minimo: { limite: 1000, atual: 0, exibicao: 'R$ 10,00' } });
    expect(mensagemDeErro(preco.errors)).toBe('O mínimo é R$ 10,00.');
  });
});

describe('mensagemDeErro com erros de mais de um validador', () => {
  it('senha curta e fraca: o primeiro erro, na ordem dos validadores, dá a mensagem', () => {
    const minlengthPrimeiro = new FormControl('abc', [
      Validators.minLength(8),
      Validadores.senhaForte,
    ]);
    const senhaFortePrimeiro = new FormControl('abc', [
      Validadores.senhaForte,
      Validators.minLength(8),
    ]);

    expect(Object.keys(minlengthPrimeiro.errors ?? {})).toEqual(['minlength', 'senhaForte']);
    expect(mensagemDeErro(minlengthPrimeiro.errors)).toBe('Use pelo menos 8 caracteres.');
    expect(Object.keys(senhaFortePrimeiro.errors ?? {})).toEqual(['senhaForte', 'minlength']);
    expect(mensagemDeErro(senhaFortePrimeiro.errors)).toBe(
      'Use 8 caracteres ou mais, com letras e números.',
    );
  });

  it('Validators.compose junta os erros de todos', () => {
    const controle = new FormControl('x', {
      validators: Validators.compose([Validators.pattern(/^\d+$/), Validadores.cpf]),
    });

    expect(Object.keys(controle.errors ?? {}).sort()).toEqual(['cpf', 'pattern']);
    expect(mensagemDeErro(controle.errors)).toBe('Formato inválido.');
  });

  it('required ganha de qualquer outro, em qualquer posição do objeto de erros', () => {
    expect(
      mensagemDeErro({
        cpf: true,
        minlength: { requiredLength: 8, actualLength: 0 },
        required: true,
      }),
    ).toBe('Campo obrigatório.');
  });

  it('erro desconhecido antes de um conhecido: mostra o conhecido', () => {
    expect(mensagemDeErro({ regraDoBackend: 'x', telefone: true })).toBe('Telefone inválido.');
  });

  it('só erros desconhecidos viram a mensagem genérica, e valores falsos não somem o erro', () => {
    expect(mensagemDeErro({ a: false, b: null })).toBe('Valor inválido.');
  });

  it('erro do servidor via setErrors convive com a chave conhecida', () => {
    const controle = new FormControl('529.982.247-25', Validadores.cpf);
    controle.setErrors({ cpfJaCadastrado: true });

    expect(mensagemDeErro(controle.errors)).toBe('Valor inválido.');
    controle.setErrors({ cpfJaCadastrado: true, cpf: true });
    expect(mensagemDeErro(controle.errors)).toBe('CPF inválido.');
  });

  it('chaves herdadas do Object.prototype não viram mensagem', () => {
    expect(mensagemDeErro({ toString: true })).toBe('Valor inválido.');
    expect(mensagemDeErro({ constructor: true, cnpj: true })).toBe('CNPJ inválido.');
  });
});
