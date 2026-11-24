import { celulaDoCsv, descricaoDeQuem, linhaDoCsv } from './atividade-csv';

describe('csv do log', () => {
  it.each([
    ['simples', 'simples'],
    ['com; ponto e vírgula', '"com; ponto e vírgula"'],
    ['com "aspas"', '"com ""aspas"""'],
    ['duas\nlinhas', '"duas\nlinhas"'],
    ['=SOMA(A1)', "'=SOMA(A1)"],
    ['+1', "'+1"],
    ['-1', "'-1"],
    ['@cmd', "'@cmd"],
    ['\t=x', "'\t=x"],
    ['=a;b', '"\'=a;b"'],
    ['meio = fórmula', 'meio = fórmula'],
  ])('célula %j vira %j', (entrada, esperado) => {
    expect(celulaDoCsv(entrada)).toBe(esperado);
  });

  it('descreve quem como na tela: nome e papel, ou só o administrador', () => {
    expect(descricaoDeQuem('Carla Menezes', 'Gerente')).toBe('Carla Menezes (Gerente)');
    expect(descricaoDeQuem('Administrador', 'Administrador')).toBe('Administrador');
  });

  it('formata a data em São Paulo e a etiqueta em texto', () => {
    expect(
      linhaDoCsv({
        ocorridoEm: new Date('2026-11-19T12:41:00Z'),
        quem: 'Carla Menezes',
        papel: 'Gerente',
        acao: 'alterou-valor',
        modulo: 'planos',
        detalhe: 'Plano Mensal: R$ 109,00 para R$ 119,00',
        sensivel: true,
      }),
    ).toBe(
      '19/11/2026 09:41;Carla Menezes (Gerente);Alterou valor;Planos;Sim;Plano Mensal: R$ 109,00 para R$ 119,00',
    );
  });
});
