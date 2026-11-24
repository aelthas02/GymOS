import type { INestApplicationContext } from '@nestjs/common';
import { RepositorioDeTenants } from '../platform/application/portas';
import type { Tenant } from '../platform/domain/tenant';
import { ExecutorDeTenant } from '../platform/infra/contexto/executor-de-tenant';
import { ProtecaoDeDadosModule } from '../platform/protecao-de-dados.module';
import { usarBancoDeTeste } from '../platform/testing/banco-de-teste';
import { criarModuloDeEventos } from '../platform/testing/eventos-de-teste';
import { criarTenant } from '../platform/testing/fabricas';
import { usarRedisDeTeste } from '../platform/testing/redis-de-teste';
import { AvisosModule } from './avisos.module';
import { CaixaDeAvisos, InscricoesDePush, PreferenciasDeAviso } from './application/caixa';
import { EnvioDePush } from './application/envio-de-push';
import { Notificador } from './application/notificador';
import { RepositorioDeAvisos, RepositorioDeInscricoes, WebPush } from './application/portas';
import type { Destinatario } from './domain/aviso';
import { WebPushFake } from './infra/push/web-push.fake';

describe('Avisos (notificar, push, preferências e agendamento)', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let app: INestApplicationContext;
  let tenantA: Tenant;
  let tenantB: Tenant;
  const aluno = (id: string): Destinatario => ({ tipo: 'aluno', id });
  const ANA = aluno('00000000-0000-4000-8000-0000000000a1');
  const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/dispositivo-da-ana';
  const chaves = { p256dh: 'chave-publica', auth: 'segredo' };

  const noTenant = <T>(tenant: Tenant, corpo: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenant.id, corpo);
  const push = () => app.get(WebPush) as WebPushFake;

  async function criar(): Promise<Tenant> {
    const criado = await criarTenant(await banco.conectarComoApp());
    const achado = await app.get(RepositorioDeTenants).porSlug(criado.slug);
    if (!achado) {
      throw new Error('tenant do teste não encontrado');
    }
    return achado;
  }

  beforeAll(async () => {
    app = await criarModuloDeEventos(banco, redis, {}, [ProtecaoDeDadosModule, AvisosModule]);
    tenantA = await criar();
    tenantB = await criar();
  });

  const aviso = (extra: object = {}) => ({
    destinatario: ANA,
    tipo: 'aula' as const,
    titulo: 'Zumba aos sábados, 9h',
    texto: 'Nova turma com a Profa. Camila.',
    link: '/aulas',
    ...extra,
  });

  it('push sem inscrição grava só o aviso', async () => {
    await noTenant(tenantA, async () => {
      const gravado = await app.get(Notificador).notificar(aviso({ push: true }));
      await app.get(EnvioDePush).enviar([gravado.id]);

      expect((await app.get(CaixaDeAvisos).listar(ANA)).itens).toHaveLength(1);
    });
    expect(push().enviados).toEqual([]);
  });

  it('inscrição expirada (410) é removida sem erro', async () => {
    await noTenant(tenantA, async () => {
      await app.get(InscricoesDePush).inscrever(ANA, { endpoint: ENDPOINT, ...chaves });
      push().expirar(ENDPOINT);
      const gravado = await app.get(Notificador).notificar(aviso({ push: true }));

      await expect(app.get(EnvioDePush).enviar([gravado.id])).resolves.toBeUndefined();

      expect(await app.get(RepositorioDeInscricoes).dosDestinatarios('aluno', [ANA.id])).toEqual(
        [],
      );
    });
  });

  it('push desligado para o tipo não envia, mas o aviso aparece na lista', async () => {
    await noTenant(tenantA, async () => {
      await app.get(InscricoesDePush).inscrever(ANA, {
        endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/ana',
        ...chaves,
      });
      await app.get(PreferenciasDeAviso).definir(ANA, 'aula', false);
      const antes = (await app.get(CaixaDeAvisos).listar(ANA)).itens.length;

      const lembrete = await app.get(Notificador).notificar(aviso({ push: true }));
      await app.get(EnvioDePush).enviar([lembrete.id]);
      expect(push().enviados).toEqual([]);
      expect((await app.get(CaixaDeAvisos).listar(ANA)).itens).toHaveLength(antes + 1);

      const plano = await app
        .get(Notificador)
        .notificar(aviso({ tipo: 'plano', titulo: 'Plano vence', push: true }));
      await app.get(EnvioDePush).enviar([plano.id]);
      expect(push().enviados).toHaveLength(1);
    });
  });

  it('notificarEm cancelado antes da hora não envia', async () => {
    await noTenant(tenantA, async () => {
      const antes = await app.get(CaixaDeAvisos).contarNaoLidos(ANA);
      const futuro = new Date(Date.now() + 3_600_000);
      const { id } = await app
        .get(Notificador)
        .notificarEm(futuro, aviso({ titulo: 'Lembrete' }), { chave: 'aula:1' });

      expect(await app.get(Notificador).cancelarAgendamentos('aula:1')).toBe(1);
      expect(await app.get(Notificador).enviarAgendado(id)).toBeNull();
      expect(await app.get(CaixaDeAvisos).contarNaoLidos(ANA)).toBe(antes);

      const outro = await app.get(Notificador).notificarEm(futuro, aviso({ titulo: 'Outro' }));
      expect(await app.get(Notificador).enviarAgendado(outro.id)).toMatchObject({
        titulo: 'Outro',
      });
      expect(await app.get(CaixaDeAvisos).contarNaoLidos(ANA)).toBe(antes + 1);
    });
  });

  it('o contador de não lidos muda ao marcar como lido', async () => {
    await noTenant(tenantA, async () => {
      const caixa = app.get(CaixaDeAvisos);
      const antes = await caixa.contarNaoLidos(ANA);
      const { itens } = await caixa.listar(ANA, { naoLidos: true });

      await caixa.marcarComoLido(ANA, itens[0]?.id ?? '');

      expect(await caixa.contarNaoLidos(ANA)).toBe(antes - 1);
      expect((await caixa.listar(ANA, { naoLidos: true })).itens).toHaveLength(antes - 1);
    });
  });

  it('aluno de uma academia não vê nem lê avisos de outra', async () => {
    await noTenant(tenantB, async () => {
      expect((await app.get(CaixaDeAvisos).listar(ANA)).itens).toEqual([]);
      const dela = await app.get(RepositorioDeAvisos).doDestinatario(ANA);
      expect(dela).toEqual([]);
    });
  });
});
