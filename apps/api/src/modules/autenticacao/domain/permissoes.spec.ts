import { modulosAtivos, PLANOS } from './modulos-do-plano';
import {
  CATALOGO_DE_MODULOS,
  ehModuloExtra,
  ehPermissao,
  MODULOS_EXTRAS,
  moduloDa,
  TODAS_AS_PERMISSOES,
  todasAsAcoes,
} from './permissoes';
import {
  permissoesEfetivas,
  podeEntrarNoPainel,
  temPermissao,
  TIPOS_PADRAO,
} from './tipos-de-acesso';

describe('catálogo de permissões', () => {
  it('tem os módulos da tela Permissões, as seções de Configurações e os extras', () => {
    const chaves = CATALOGO_DE_MODULOS.map((modulo) => modulo.chave);
    expect(chaves).toEqual(
      expect.arrayContaining([
        'inicio',
        'recepcao',
        'alunos',
        'planos',
        'financeiro',
        'crm',
        'acesso',
        'treinos',
        'relatorios',
        'equipe',
        'permissoes',
        'configuracoes',
        'configuracoes.identidade',
        'configuracoes.catraca',
        'configuracoes.contratos',
        'configuracoes.senha',
        ...MODULOS_EXTRAS,
      ]),
    );
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(TODAS_AS_PERMISSOES).toHaveLength(chaves.length * 4);
  });

  it.each([
    ['alunos:excluir', true],
    ['configuracoes.catraca:editar', true],
    ['loja:ver', true],
    ['alunos:apagar', false],
    ['inexistente:ver', false],
    ['alunos', false],
    ['alunos:ver:extra', false],
    ['', false],
  ])('ehPermissao(%j) é %s', (valor, esperado) => {
    expect(ehPermissao(valor)).toBe(esperado);
  });

  it('reconhece só os módulos extras', () => {
    expect(ehModuloExtra('loja')).toBe(true);
    expect(ehModuloExtra('alunos')).toBe(false);
  });

  it('todasAsAcoes e moduloDa', () => {
    expect(todasAsAcoes('treinos')).toEqual([
      'treinos:ver',
      'treinos:criar',
      'treinos:editar',
      'treinos:excluir',
    ]);
    expect(moduloDa('configuracoes.senha:editar')).toBe('configuracoes.senha');
  });
});

describe('tipos de acesso padrão', () => {
  const tipo = (chave: string) => {
    const encontrado = TIPOS_PADRAO.find((padrao) => padrao.chave === chave);
    if (!encontrado) {
      throw new Error(chave);
    }
    return encontrado;
  };

  it('só usam permissões do catálogo', () => {
    for (const padrao of TIPOS_PADRAO) {
      expect(padrao.permissoes.filter((p) => !ehPermissao(p))).toEqual([]);
    }
  });

  it('o Administrador tem todas, até as que não estão gravadas', () => {
    expect(permissoesEfetivas({ chave: 'administrador', permissoes: [] })).toEqual([
      ...TODAS_AS_PERMISSOES,
    ]);
    expect(temPermissao({ chave: 'administrador', permissoes: [] }, 'permissoes:editar')).toBe(
      true,
    );
  });

  it('a Recepção não exclui alunos e o Gerente não mexe em Permissões', () => {
    expect(temPermissao(tipo('recepcao'), 'alunos:editar')).toBe(true);
    expect(temPermissao(tipo('recepcao'), 'alunos:excluir')).toBe(false);
    expect(tipo('gerente').permissoes.some((p) => p.startsWith('permissoes:'))).toBe(false);
  });

  it('em Configurações, o Gerente edita identidade, catraca, atraso e a própria senha', () => {
    const edita = tipo('gerente')
      .permissoes.filter((p) => p.startsWith('configuracoes.') && p.endsWith(':editar'))
      .sort();
    expect(edita).toEqual([
      'configuracoes.catraca:editar',
      'configuracoes.contratos:editar',
      'configuracoes.identidade:editar',
      'configuracoes.senha:editar',
    ]);
  });

  it('tipo criado pela academia vale pelo que foi gravado', () => {
    const personalizado = { chave: null, permissoes: ['alunos:ver' as const] };
    expect(permissoesEfetivas(personalizado)).toEqual(['alunos:ver']);
    expect(temPermissao(personalizado, 'alunos:criar')).toBe(false);
  });

  it('"Sem acesso" não entra no painel', () => {
    expect(podeEntrarNoPainel({ chave: 'sem-acesso' })).toBe(false);
    expect(podeEntrarNoPainel({ chave: 'professor' })).toBe(true);
    expect(podeEntrarNoPainel({ chave: null })).toBe(true);
    expect(tipo('sem-acesso').permissoes).toEqual([]);
  });
});

describe('módulos extras por plano', () => {
  it('o plano base não dá módulo extra e o completo dá todos', () => {
    expect(modulosAtivos('base')).toEqual([]);
    expect(modulosAtivos('completo')).toEqual([...MODULOS_EXTRAS]);
    expect([...PLANOS.keys()]).toEqual(['base', 'completo']);
  });

  it('plano desconhecido não dá nada, nem por herança de Object', () => {
    expect(modulosAtivos('premium')).toEqual([]);
    expect(modulosAtivos('toString')).toEqual([]);
  });

  it('a sobrescrita manual liga ou desliga por cima do plano', () => {
    expect(modulosAtivos('base', { loja: true })).toEqual(['loja']);
    expect(modulosAtivos('completo', { loja: false, aulas: true })).toEqual([
      'aulas',
      'marketing',
      'saude',
    ]);
  });
});
