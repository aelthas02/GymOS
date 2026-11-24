import {
  ACOES_DA_AUDITORIA,
  type ChaveDaAcao,
  codificarCursor,
  CursorInvalidoError,
  decodificarCursor,
  limiteDaRetencao,
  moduloDaAuditoria,
  resolverAtividade,
  textoDoModulo,
} from './atividade';

describe('catálogo de ações', () => {
  it('traz os oito exemplos de Log.html com texto, módulo e etiqueta da tela', () => {
    const esperado: Array<[ChaveDaAcao, string, string, boolean]> = [
      ['alterou-valor', 'Alterou valor', 'planos', true],
      ['alterou-permissao', 'Alterou permissão', 'permissoes', true],
      ['cadastrou-aluno', 'Cadastrou aluno', 'alunos', false],
      ['enviou-cobranca-em-lote', 'Enviou cobrança em lote', 'alunos', false],
      ['alterou-configuracao-financeira', 'Alterou configuração financeira', 'configuracoes', true],
      ['editou-ficha-de-treino', 'Editou ficha de treino', 'treinos', false],
      ['excluiu-aluno', 'Excluiu aluno', 'alunos', true],
      ['trocou-cor-do-app', 'Trocou a cor do app', 'configuracoes', false],
    ];
    for (const [chave, texto, modulo, sensivel] of esperado) {
      expect(ACOES_DA_AUDITORIA[chave]).toEqual({ texto, modulo, sensivel });
    }
  });

  it('a tentativa negada é uma ação sensível', () => {
    expect(ACOES_DA_AUDITORIA['tentativa-negada']).toMatchObject({
      texto: 'Tentativa negada',
      sensivel: true,
    });
  });

  it('o módulo de cada ação existe no catálogo de módulos do T12', () => {
    for (const { modulo } of Object.values(ACOES_DA_AUDITORIA)) {
      expect(textoDoModulo(modulo)).not.toBe(modulo);
    }
  });
});

describe('módulo da auditoria', () => {
  it('as seções de Configurações contam como Configurações', () => {
    expect(moduloDaAuditoria('configuracoes.identidade:editar')).toBe('configuracoes');
    expect(moduloDaAuditoria('alunos:excluir')).toBe('alunos');
  });

  it('o texto vem do catálogo; chave desconhecida volta como está', () => {
    expect(textoDoModulo('permissoes')).toBe('Permissões');
    expect(textoDoModulo('modulo-antigo')).toBe('modulo-antigo');
  });
});

describe('resolverAtividade', () => {
  const base = {
    quem: { id: null, nome: 'Administrador' },
    papel: 'Administrador',
    detalhe: 'x',
  } as const;

  it('usa módulo e sensibilidade do catálogo quando o chamador não informa', () => {
    expect(resolverAtividade({ ...base, acao: 'excluiu-aluno' })).toMatchObject({
      modulo: 'alunos',
      sensivel: true,
    });
  });

  it('o chamador pode marcar sensível uma ação comum e trocar o módulo', () => {
    expect(
      resolverAtividade({ ...base, acao: 'cadastrou-aluno', sensivel: true, modulo: 'planos' }),
    ).toMatchObject({ modulo: 'planos', sensivel: true });
  });

  it('recusa ação fora do catálogo e detalhe vazio', () => {
    expect(() => resolverAtividade({ ...base, acao: 'inventada' as ChaveDaAcao })).toThrow(
      /Ação de auditoria desconhecida: inventada/,
    );
    expect(() => resolverAtividade({ ...base, acao: 'excluiu-aluno', detalhe: '  ' })).toThrow(
      /detalhe/,
    );
  });

  it('recusa módulo informado fora do catálogo', () => {
    expect(() =>
      resolverAtividade({ ...base, acao: 'excluiu-aluno', modulo: 'inexistente' }),
    ).toThrow(/Módulo de auditoria desconhecido/);
  });
});

describe('limiteDaRetencao', () => {
  it('é o mesmo instante, 12 meses antes', () => {
    expect(limiteDaRetencao(new Date('2026-11-23T12:00:00.000Z')).toISOString()).toBe(
      '2025-11-23T12:00:00.000Z',
    );
  });

  it('29 de fevereiro cai em 28 de fevereiro, sem escorregar para março', () => {
    expect(limiteDaRetencao(new Date('2028-02-29T10:00:00.000Z')).toISOString()).toBe(
      '2027-02-28T10:00:00.000Z',
    );
  });
});

describe('cursor', () => {
  const posicao = { sensivel: true, ocorridoEm: new Date('2026-11-19T12:41:00.123Z'), ordem: 42n };

  it('é opaco e volta idêntico', () => {
    const cursor = codificarCursor(posicao);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodificarCursor(cursor)).toEqual(posicao);
  });

  it.each(['', 'lixo', 'e30', Buffer.from('[1,2]').toString('base64url')])(
    'recusa cursor adulterado (%j)',
    (cursor) => {
      expect(() => decodificarCursor(cursor)).toThrow(CursorInvalidoError);
    },
  );
});
