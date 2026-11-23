import { CATALOGO_POR_CONTEXTO, VARIAVEIS_DE_MENSAGEM } from './catalogo';
import { analisarModelo, validarModelo } from './modelo';

describe('catálogo de variáveis', () => {
  it('cobrança aceita {link}; marketing não', () => {
    expect(CATALOGO_POR_CONTEXTO.cobranca).toContain('link');
    expect(CATALOGO_POR_CONTEXTO.marketing).not.toContain('link');
  });

  it('as seis variáveis das telas têm descrição', () => {
    expect(Object.keys(VARIAVEIS_DE_MENSAGEM)).toEqual([
      'nome',
      'plano',
      'vencimento',
      'professor',
      'valor',
      'link',
    ]);
    expect(VARIAVEIS_DE_MENSAGEM.link).toBe('Link de pagamento');
  });
});

describe('analisarModelo', () => {
  it('separa texto e variáveis com a posição de cada parte', () => {
    expect(analisarModelo('Olá, {nome}!').partes).toEqual([
      { tipo: 'texto', texto: 'Olá, ', posicao: 0 },
      { tipo: 'variavel', nome: 'nome', posicao: 5, comprimento: 6 },
      { tipo: 'texto', texto: '!', posicao: 11 },
    ]);
  });

  it('as partes, juntas, reconstroem o texto, inclusive com chaves soltas', () => {
    const texto = 'Oi {nome {plano} } fim';
    const juntas = analisarModelo(texto)
      .partes.map((parte) => (parte.tipo === 'texto' ? parte.texto : `{${parte.nome}}`))
      .join('');

    expect(juntas).toBe(texto);
  });

  it('texto sem variáveis e texto vazio não têm erro', () => {
    expect(analisarModelo('Bom treino!')).toEqual({
      partes: [{ tipo: 'texto', texto: 'Bom treino!', posicao: 0 }],
      erros: [],
    });
    expect(analisarModelo('')).toEqual({ partes: [], erros: [] });
  });
});

describe('validarModelo', () => {
  it('"Olá, {nome}! {link}" é válido em cobrança', () => {
    expect(validarModelo('Olá, {nome}! {link}', 'cobranca')).toMatchObject({
      valido: true,
      variaveis: ['nome', 'link'],
      erros: [],
    });
  });

  it('"Olá, {nome}! {link}" é inválido em marketing: {link} está fora do catálogo', () => {
    const resultado = validarModelo('Olá, {nome}! {link}', 'marketing');

    expect(resultado.valido).toBe(false);
    expect(resultado.erros).toEqual([
      {
        codigo: 'variavel-fora-do-contexto',
        posicao: 13,
        comprimento: 6,
        mensagem: '{link} não pode ser usada em mensagens de marketing.',
      },
    ]);
  });

  it('{nme} é inválido e o erro aponta a posição', () => {
    expect(validarModelo('Oi, {nme}!', 'marketing').erros).toEqual([
      {
        codigo: 'variavel-desconhecida',
        posicao: 4,
        comprimento: 5,
        mensagem: 'A variável {nme} não existe.',
      },
    ]);
  });

  it('chave sem fechamento é inválida', () => {
    expect(validarModelo('Oi, {nome', 'cobranca')).toMatchObject({
      valido: false,
      erros: [
        {
          codigo: 'chave-sem-fechamento',
          posicao: 4,
          comprimento: 1,
          mensagem: 'Falta fechar esta chave.',
        },
      ],
    });
  });

  it('uma chave aberta antes de outra variável não engole a variável', () => {
    const resultado = validarModelo('{nome {plano}', 'marketing');

    expect(resultado.erros.map((erro) => [erro.codigo, erro.posicao])).toEqual([
      ['chave-sem-fechamento', 0],
    ]);
    expect(resultado.variaveis).toEqual(['plano']);
  });

  it('chave fechada sem abertura é inválida', () => {
    expect(validarModelo('Promo }', 'marketing').erros).toEqual([
      {
        codigo: 'chave-sem-abertura',
        posicao: 6,
        comprimento: 1,
        mensagem: 'Esta chave fecha sem ter sido aberta.',
      },
    ]);
  });

  it.each(['{}', '{ nome }', '{Nome}', '{toString}', '{__proto__}'])(
    '%s não é variável do catálogo',
    (texto) => {
      expect(validarModelo(texto, 'cobranca').erros.map((erro) => erro.codigo)).toEqual([
        'variavel-desconhecida',
      ]);
    },
  );

  it('junta todos os erros em ordem de posição', () => {
    const resultado = validarModelo('} {nme} {link} {nome', 'marketing');

    expect(resultado.erros.map((erro) => [erro.codigo, erro.posicao])).toEqual([
      ['chave-sem-abertura', 0],
      ['variavel-desconhecida', 2],
      ['variavel-fora-do-contexto', 8],
      ['chave-sem-fechamento', 15],
    ]);
  });

  it('lista cada variável usada uma vez, na ordem em que aparece', () => {
    expect(validarModelo('{plano} {nome} {plano}', 'cobranca').variaveis).toEqual([
      'plano',
      'nome',
    ]);
  });

  it('aceita os modelos das telas Marketing e Alunos em lote', () => {
    const marketing =
      'Oi, {nome}! Seu plano {plano} vence em {vencimento}. Quer renovar agora? É só responder aqui. 💪';
    const cobranca =
      'Olá, {nome}! Sua mensalidade do plano {plano} está em aberto. Pague pelo app ou pelo PIX: {link}';

    expect(validarModelo(marketing, 'marketing').valido).toBe(true);
    expect(validarModelo(cobranca, 'cobranca').valido).toBe(true);
    expect(validarModelo('{professor} {valor}', 'marketing').valido).toBe(true);
  });
});
