import { Controller, Delete, type INestApplication, Param, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import request from 'supertest';
import { RequirePermission } from '../../../autenticacao/interface/http/decoradores';
import { criarUsuario } from '../../../autenticacao/testing/fabricas';
import { Auditoria } from '../../application/auditoria';
import type { NovaAtividade } from '../../domain/atividade';
import { Publica } from '../../interface/http/acesso-publico';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { comTenant, criarTenant, type TenantCriado } from '../../testing/fabricas';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { LimpezaDaAuditoria } from './limpeza-da-auditoria';

const SENHA = 'senha-forte-123';
const AUTOR = { id: null, nome: 'Administrador' } as const;

@Controller('teste-auditoria')
class RotasDeTesteController {
  constructor(private readonly auditoria: Auditoria) {}

  /** Caso de uso que audita e conclui. */
  @Post('conclui')
  @Publica()
  async concluir(): Promise<{ ok: true }> {
    await this.auditoria.registrarAtividade({
      quem: AUTOR,
      papel: 'Administrador',
      acao: 'cadastrou-aluno',
      detalhe: 'Concluído',
    });
    return { ok: true };
  }

  /** Caso de uso que audita e depois falha: a transação inteira volta. */
  @Post('falha')
  @Publica()
  async falhar(): Promise<never> {
    await this.auditoria.registrarAtividade({
      quem: AUTOR,
      papel: 'Administrador',
      acao: 'excluiu-aluno',
      detalhe: 'Desfeito',
    });
    throw new Error('falha do caso de uso');
  }

  @Delete('alunos/:id')
  @RequirePermission('alunos:excluir')
  excluirAluno(@Param('id') id: string): { excluido: string } {
    return { excluido: id };
  }
}

interface Item {
  id: string;
  quando: string;
  quem: string;
  quemId: string | null;
  papel: string;
  acao: string;
  acaoTexto: string;
  modulo: string;
  moduloTexto: string;
  detalhe: string;
  sensivel: boolean;
  etiqueta: string | null;
}
interface Pagina {
  itens: Item[];
  proximoCursor: string | null;
}

describe('auditoria: log de atividades (T13b)', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;
  let a: TenantCriado;
  let b: TenantCriado;
  let tokenDoAdministrador: string;

  const hostDe = (tenant: TenantCriado): string => `${tenant.slug}.localhost:3000`;
  const http = (): ReturnType<typeof request> => request(app.getHttpServer());

  const tokenDe = async (tenant: TenantCriado, email: string): Promise<string> =>
    (
      (
        await http()
          .post('/api/auth/staff/login')
          .set('Host', hostDe(tenant))
          .send({ email, senha: SENHA })
          .expect(200)
      ).body as { accessToken: string }
    ).accessToken;

  const consultar = (
    consulta: Record<string, string | number> = {},
    tenant = a,
    token = tokenDoAdministrador,
  ): request.Test =>
    http()
      .get('/api/auditoria/atividades')
      .query(consulta)
      .set('Host', hostDe(tenant))
      .auth(token, { type: 'bearer' });

  const listar = async (
    consulta: Record<string, string | number> = {},
    tenant = a,
    token = tokenDoAdministrador,
  ): Promise<Pagina> => (await consultar(consulta, tenant, token).expect(200)).body as Pagina;

  /** Registra como o caso de uso de um dono faria, no tenant e no instante dados. */
  const registrar = (
    tenant: TenantCriado,
    instante: string,
    atividade: Partial<NovaAtividade> = {},
  ): Promise<void> =>
    app.get(ContextoDoTenant).executar({ instanteFixo: new Date(instante) }, () =>
      app.get(ExecutorDeTenant).runAsTenant(tenant.id, () =>
        app.get(Auditoria).registrarAtividade({
          quem: AUTOR,
          papel: 'Administrador',
          acao: 'cadastrou-aluno',
          detalhe: 'Larissa Nunes, plano Anual',
          ...atividade,
        }),
      ),
    );

  const contar = async (tenant: TenantCriado, filtro = 'TRUE'): Promise<number> =>
    comTenant(conexao, tenant.id, async () => {
      const { rows } = await conexao.query<{ n: string }>(
        `SELECT count(*) AS n FROM atividade WHERE ${filtro}`,
      );
      return Number(rows[0]?.n);
    });

  beforeAll(async () => {
    app = await criarAppDeTeste(banco, {}, { controllers: [RotasDeTesteController] });
    conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao);
    b = await criarTenant(conexao);
    await criarUsuario(conexao, a.id, {
      chave: 'administrador',
      email: 'adm@a.com',
      senha: SENHA,
      nome: 'Administrador',
    });
    await criarUsuario(conexao, a.id, {
      chave: 'gerente',
      email: 'carla@a.com',
      senha: SENHA,
      nome: 'Carla Menezes',
    });
    await criarUsuario(conexao, a.id, {
      chave: 'recepcao',
      email: 'joao@a.com',
      senha: SENHA,
      nome: 'João Batista',
    });
    await criarUsuario(conexao, b.id, {
      chave: 'administrador',
      email: 'adm@b.com',
      senha: SENHA,
      nome: 'Administrador B',
    });
    tokenDoAdministrador = await tokenDe(a, 'adm@a.com');
  });

  it('1. rollback do caso de uso não deixa registro de atividade', async () => {
    const antes = await contar(a);

    await http().post('/api/teste-auditoria/falha').set('Host', hostDe(a)).expect(500);
    expect(await contar(a)).toBe(antes);

    // Controle: o caso de uso que conclui deixa o registro, na mesma transação.
    await http().post('/api/teste-auditoria/conclui').set('Host', hostDe(a)).expect(201);
    expect(await contar(a)).toBe(antes + 1);
    expect(await contar(a, "detalhe = 'Desfeito'")).toBe(0);
  });

  it('2. ação sensível vem primeiro em "sensíveis em destaque" e tem a etiqueta', async () => {
    await registrar(a, '2026-03-01T10:00:00Z', { acao: 'cadastrou-aluno', detalhe: 'T2 comum' });
    await registrar(a, '2026-03-01T09:00:00Z', {
      acao: 'alterou-valor',
      detalhe: 'T2 sensível: R$ 109,00 para R$ 119,00',
    });

    const emDestaque = await listar({ tipo: 'destaque', de: '2026-03-01T00:00:00Z' });
    const cronologico = await listar({ tipo: 'todos', de: '2026-03-01T00:00:00Z' });

    expect(emDestaque.itens.map((i) => i.detalhe)).toEqual([
      'T2 sensível: R$ 109,00 para R$ 119,00',
      'T2 comum',
    ]);
    expect(emDestaque.itens[0]).toMatchObject({
      acao: 'alterou-valor',
      acaoTexto: 'Alterou valor',
      modulo: 'planos',
      moduloTexto: 'Planos',
      sensivel: true,
      etiqueta: 'Sensível',
    });
    expect(emDestaque.itens[1]).toMatchObject({ sensivel: false, etiqueta: null });
    // Sem o destaque, a ordem é a do tempo: o comum, mais recente, vem antes.
    expect(cronologico.itens.map((i) => i.detalhe)).toEqual([
      'T2 comum',
      'T2 sensível: R$ 109,00 para R$ 119,00',
    ]);
  });

  it('3. registro com 12 meses e 1 dia é removido pelo job; com 12 meses exatos, fica', async () => {
    const agora = '2026-11-23T12:00:00.000Z';
    await registrar(a, '2025-11-22T12:00:00.000Z', { detalhe: 'T3 doze meses e um dia' });
    await registrar(a, '2025-11-23T12:00:00.000Z', { detalhe: 'T3 doze meses exatos' });
    await registrar(a, '2025-11-23T12:00:00.001Z', { detalhe: 'T3 um pouco menos' });
    await registrar(b, '2025-11-01T12:00:00.000Z', { detalhe: 'T3 de outra academia' });

    const removidos = await app
      .get(ContextoDoTenant)
      .executar({ instanteFixo: new Date(agora) }, () => app.get(LimpezaDaAuditoria).executar());

    expect(removidos).toBeGreaterThanOrEqual(2);
    expect(await contar(a, "detalhe = 'T3 doze meses e um dia'")).toBe(0);
    expect(await contar(a, "detalhe = 'T3 doze meses exatos'")).toBe(1);
    expect(await contar(a, "detalhe = 'T3 um pouco menos'")).toBe(1);
    // O job passa por todos os tenants, cada um em runAsTenant.
    expect(await contar(b, "detalhe = 'T3 de outra academia'")).toBe(0);
  });

  it('4. Recepção recebendo 403 em alunos:excluir gera "Tentativa negada" com a permissão', async () => {
    const recepcao = await tokenDe(a, 'joao@a.com');

    await http()
      .delete(`/api/teste-auditoria/alunos/${randomUUID()}`)
      .set('Host', hostDe(a))
      .auth(recepcao, { type: 'bearer' })
      .expect(403);

    const { itens } = await listar({ modulo: 'alunos', tipo: 'sensiveis' });
    const negada = itens.find((i) => i.acao === 'tentativa-negada');
    expect(negada).toMatchObject({
      quem: 'João Batista',
      papel: 'Recepção',
      acaoTexto: 'Tentativa negada',
      modulo: 'alunos',
      sensivel: true,
      etiqueta: 'Sensível',
    });
    expect(negada?.detalhe).toContain('alunos:excluir');
    expect(negada?.detalhe).toContain('DELETE /api/teste-auditoria/alunos/:id');
  });

  it('5. Gerente sem permissoes:log recebe 403 na consulta e na exportação', async () => {
    const gerente = await tokenDe(a, 'carla@a.com');

    await consultar({}, a, gerente).expect(403);
    await http()
      .get('/api/auditoria/atividades/exportar')
      .set('Host', hostDe(a))
      .auth(gerente, { type: 'bearer' })
      .expect(403);
    await http().get('/api/auditoria/atividades').set('Host', hostDe(a)).expect(401);
  });

  it('6. paginação por cursor estável com registros no mesmo milissegundo', async () => {
    const instante = '2026-04-10T15:00:00.000Z';
    const periodo = { de: '2026-04-10T00:00:00Z', ate: '2026-04-11T00:00:00Z' };
    for (let i = 1; i <= 7; i++) {
      await registrar(a, instante, { detalhe: `T6 registro ${i}` });
    }

    const primeira = await listar({ ...periodo, limite: 3 });
    // Um registro novo no mesmo milissegundo entre as páginas não repete nem derruba ninguém.
    await registrar(a, instante, { detalhe: 'T6 registro 8' });
    const segunda = await listar({ ...periodo, limite: 3, cursor: primeira.proximoCursor ?? '' });
    const terceira = await listar({ ...periodo, limite: 3, cursor: segunda.proximoCursor ?? '' });

    const vistos = [...primeira.itens, ...segunda.itens, ...terceira.itens].map((i) => i.detalhe);
    expect(vistos).toEqual([
      'T6 registro 7',
      'T6 registro 6',
      'T6 registro 5',
      'T6 registro 4',
      'T6 registro 3',
      'T6 registro 2',
      'T6 registro 1',
    ]);
    expect(terceira.proximoCursor).toBeNull();
    expect(primeira.proximoCursor).not.toBeNull();
  });

  describe('bordas', () => {
    it('paginação também é estável com o destaque dos sensíveis', async () => {
      const periodo = { de: '2026-05-10T00:00:00Z', ate: '2026-05-11T00:00:00Z' };
      for (let i = 1; i <= 4; i++) {
        await registrar(a, '2026-05-10T10:00:00Z', {
          acao: i % 2 ? 'alterou-valor' : 'cadastrou-aluno',
          detalhe: `T6b ${i}`,
        });
      }

      const primeira = await listar({ ...periodo, tipo: 'destaque', limite: 3 });
      const segunda = await listar({
        ...periodo,
        tipo: 'destaque',
        limite: 3,
        cursor: primeira.proximoCursor ?? '',
      });

      expect([...primeira.itens, ...segunda.itens].map((i) => i.detalhe)).toEqual([
        'T6b 3',
        'T6b 1',
        'T6b 4',
        'T6b 2',
      ]);
      expect(segunda.proximoCursor).toBeNull();
    });

    it('filtra por usuário, módulo e período, e "sensíveis" mostra só os sensíveis', async () => {
      const carla = randomUUID();
      await registrar(a, '2026-06-02T10:00:00Z', {
        quem: { id: carla, nome: 'Carla Menezes' },
        papel: 'Gerente',
        acao: 'trocou-cor-do-app',
        detalhe: 'T7 Verde para azul',
      });
      await registrar(a, '2026-06-03T10:00:00Z', {
        acao: 'alterou-configuracao-financeira',
        detalhe: 'T7 Tolerância de atraso: 3 para 7 dias',
      });
      const periodo = { de: '2026-06-01T00:00:00Z', ate: '2026-06-04T00:00:00Z' };

      expect((await listar({ ...periodo, usuarioId: carla })).itens.map((i) => i.detalhe)).toEqual([
        'T7 Verde para azul',
      ]);
      expect(
        (await listar({ ...periodo, modulo: 'configuracoes' })).itens.map((i) => i.moduloTexto),
      ).toEqual(['Configurações', 'Configurações']);
      expect((await listar({ ...periodo, tipo: 'sensiveis' })).itens.map((i) => i.detalhe)).toEqual(
        ['T7 Tolerância de atraso: 3 para 7 dias'],
      );
      expect(
        (await listar({ de: '2026-06-03T00:00:00Z', ate: '2026-06-04T00:00:00Z' })).itens,
      ).toHaveLength(1);
    });

    it('não vaza registros de outra academia', async () => {
      await registrar(b, '2026-07-01T10:00:00Z', { detalhe: 'T8 só da academia B' });

      const daA = await listar({ de: '2026-07-01T00:00:00Z', ate: '2026-07-02T00:00:00Z' });
      const tokenB = await tokenDe(b, 'adm@b.com');
      const daB = await listar(
        { de: '2026-07-01T00:00:00Z', ate: '2026-07-02T00:00:00Z' },
        b,
        tokenB,
      );

      expect(daA.itens).toEqual([]);
      expect(daB.itens.map((i) => i.detalhe)).toEqual(['T8 só da academia B']);
    });

    it('recusa cursor adulterado, limite fora da faixa, tipo e datas inválidos com 400', async () => {
      await consultar({ cursor: 'lixo' }).expect(400);
      await consultar({ limite: 0 }).expect(400);
      await consultar({ limite: 101 }).expect(400);
      await consultar({ tipo: 'qualquer' }).expect(400);
      await consultar({ de: 'ontem' }).expect(400);
      await consultar({ usuarioId: 'não-é-uuid' }).expect(400);
    });

    it('recusa ação desconhecida e detalhe vazio ao registrar', async () => {
      await expect(
        registrar(a, '2026-08-01T10:00:00Z', { acao: 'inventada' as never }),
      ).rejects.toThrow(/Ação de auditoria desconhecida/);
      await expect(registrar(a, '2026-08-01T10:00:00Z', { detalhe: ' ' })).rejects.toThrow(
        /precisa de detalhe/,
      );
    });

    it('exporta CSV com os filtros, datas de São Paulo e proteção contra fórmula', async () => {
      await registrar(a, '2026-09-01T12:41:00Z', {
        acao: 'alterou-valor',
        detalhe: 'Plano "Mensal"; =HYPERLINK("http://x")',
      });
      await registrar(a, '2026-09-01T12:00:00Z', { detalhe: 'linha 1\nlinha 2, com vírgula' });
      await registrar(a, '2026-09-01T11:00:00Z', { detalhe: '=1+1' });

      const resposta = await http()
        .get('/api/auditoria/atividades/exportar')
        .query({ de: '2026-09-01T00:00:00Z', ate: '2026-09-02T00:00:00Z' })
        .set('Host', hostDe(a))
        .auth(tokenDoAdministrador, { type: 'bearer' })
        .expect(200);

      expect(resposta.headers['content-type']).toMatch(/text\/csv/);
      expect(resposta.headers['content-disposition']).toMatch(/attachment; filename="log-de-/);
      const linhas = (resposta.text as string).replace(/^FEFF/, '').split('\r\n');
      expect(linhas[0]).toBe('Quando;Quem;Ação;Módulo;Sensível;Detalhe');
      expect(linhas[1]).toBe(
        '01/09/2026 09:41;Administrador;Alterou valor;Planos;Sim;' +
          '"Plano ""Mensal""; =HYPERLINK(""http://x"")"',
      );
      expect(linhas[2]).toContain('"linha 1\nlinha 2, com vírgula"');
      expect(linhas[3]).toBe("01/09/2026 08:00;Administrador;Cadastrou aluno;Alunos;Não;'=1+1");
    });
  });
});
