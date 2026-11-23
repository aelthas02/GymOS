import { analisarModelo, validarModelo, type ParteDoModelo } from './modelo';

const variaveis = (partes: ParteDoModelo[]) => partes.filter((parte) => parte.tipo === 'variavel');

describe('posições em unidades UTF-16 do JavaScript', () => {
  it('emoji antes da variável conta 2 unidades', () => {
    const texto = '😀 Oi, {nome}';
    const [variavel] = variaveis(analisarModelo(texto).partes);

    expect(variavel).toEqual({ tipo: 'variavel', nome: 'nome', posicao: 7, comprimento: 6 });
    expect(texto.slice(7, 13)).toBe('{nome}');
  });

  it('emoji composto (família, 11 unidades) e bandeira deslocam a posição pelo comprimento real', () => {
    const familia = '👨‍👩‍👧';
    const texto = `${familia}🇧🇷 {plano}`;
    const [variavel] = variaveis(analisarModelo(texto).partes);

    expect(familia.length).toBe(8);
    expect(variavel?.posicao).toBe(familia.length + 4 + 1);
    expect(
      texto.slice(variavel?.posicao, (variavel?.posicao ?? 0) + (variavel?.comprimento ?? 0)),
    ).toBe('{plano}');
  });

  it('acentos pré-compostos e decompostos (e + U+0301) antes da variável', () => {
    const composto = 'Olá, José {nome}';
    const decomposto = 'Olá, José {nome}';

    expect(variaveis(analisarModelo(composto).partes)[0]?.posicao).toBe(10);
    expect(variaveis(analisarModelo(decomposto).partes)[0]?.posicao).toBe(12);
  });

  it('o erro aponta o trecho certo mesmo depois de emojis', () => {
    const texto = '🎉🎉 {inexistente} e 🎉 {link}';
    const resultado = validarModelo(texto, 'marketing');

    expect(
      resultado.erros.map((erro) => texto.slice(erro.posicao, erro.posicao + erro.comprimento)),
    ).toEqual(['{inexistente}', '{link}']);
    expect(resultado.erros.map((erro) => erro.codigo)).toEqual([
      'variavel-desconhecida',
      'variavel-fora-do-contexto',
    ]);
  });

  it('chave solta depois de emoji aponta para a própria chave', () => {
    const texto = '😀😀 {nome';
    const [erro] = analisarModelo(texto).erros;

    expect(erro).toMatchObject({ codigo: 'chave-sem-fechamento', posicao: 5, comprimento: 1 });
    expect(texto[erro?.posicao ?? -1]).toBe('{');
  });
});

describe('textos longos', () => {
  it('um texto de 200 mil caracteres com variáveis espalhadas mantém posições e reconstrói o original', () => {
    const bloco = 'Olá 😀 aluno, sua mensalidade vence logo. ';
    const texto = `${bloco.repeat(2500)}{nome}${bloco.repeat(2500)}{valor}${bloco.repeat(100)}`;
    const { partes, erros } = analisarModelo(texto);

    expect(erros).toEqual([]);
    expect(variaveis(partes).map((v) => v.posicao)).toEqual([
      bloco.length * 2500,
      bloco.length * 5000 + 6,
    ]);
    const juntas = partes.map((p) => (p.tipo === 'texto' ? p.texto : `{${p.nome}}`)).join('');
    expect(juntas).toBe(texto);
  });

  it('muitas variáveis repetidas aparecem uma vez em `variaveis`', () => {
    const texto = '{nome} '.repeat(5000);
    const resultado = validarModelo(texto, 'cobranca');

    expect(resultado.valido).toBe(true);
    expect(resultado.variaveis).toEqual(['nome']);
    expect(variaveis(resultado.partes)).toHaveLength(5000);
  });
});

describe('variável colada em pontuação e em outras chaves', () => {
  it.each([
    ['{nome},{plano}.{valor}!', ['nome', 'plano', 'valor']],
    ['({nome})', ['nome']],
    ['"{nome}"', ['nome']],
    ['{nome}{plano}', ['nome', 'plano']],
    ['R${valor}', ['valor']],
    ['{nome}…{plano}—{valor}', ['nome', 'plano', 'valor']],
  ])('%j reconhece as variáveis coladas', (texto, esperado) => {
    const resultado = validarModelo(texto, 'cobranca');

    expect(resultado.erros).toEqual([]);
    expect(resultado.variaveis).toEqual(esperado);
  });

  it('{{nome}} é uma variável cercada por duas chaves soltas', () => {
    const { partes, erros } = analisarModelo('{{nome}}');

    expect(erros.map((erro) => [erro.codigo, erro.posicao])).toEqual([
      ['chave-sem-fechamento', 0],
      ['chave-sem-abertura', 7],
    ]);
    expect(variaveis(partes)).toEqual([
      { tipo: 'variavel', nome: 'nome', posicao: 1, comprimento: 6 },
    ]);
  });

  it('{} vazio é variável desconhecida, e nome com espaço também', () => {
    expect(validarModelo('{}', 'cobranca').erros[0]?.codigo).toBe('variavel-desconhecida');
    expect(validarModelo('{ nome }', 'cobranca').erros[0]?.codigo).toBe('variavel-desconhecida');
  });

  it('maiúscula não vale: {Nome} é desconhecida', () => {
    expect(validarModelo('{Nome}', 'cobranca').erros[0]?.codigo).toBe('variavel-desconhecida');
  });
});
