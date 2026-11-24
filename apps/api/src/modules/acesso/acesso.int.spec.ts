import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import { ACADEMIA_RITMO } from '../../seed/plataforma';
import { MODULOS_DE_SEED } from '../../seed/modulos';
import { executarSeed } from '../../seed/runner';
import { AlunosModule } from '../alunos/alunos.module';
import { RepositorioDeAlunos } from '../alunos/application/portas';
import { AvisosModule } from '../avisos/avisos.module';
import { FuncionariosModule } from '../funcionarios/funcionarios.module';
import { RepositorioDeTenants } from '../platform/application/portas';
import { Relogio } from '../platform/domain/relogio';
import { ExecutorDeTenant } from '../platform/infra/contexto/executor-de-tenant';
import { ProtecaoDeDadosModule } from '../platform/protecao-de-dados.module';
import { usarBancoDeTeste } from '../platform/testing/banco-de-teste';
import { criarModuloDeEventos } from '../platform/testing/eventos-de-teste';
import { usarRedisDeTeste } from '../platform/testing/redis-de-teste';
import { AcessoModule } from './acesso.module';
import { Acessos } from './application/acessos';
import { AlertasDeFrequencia } from './application/alertas';
import { Frequencia } from './application/frequencia';
import { QrDeCheckin } from './application/qr';

// Fluxo do T23a com o seed de 19/11/2026: ADR-018 (Rafael com 6 dias é negado, Juliana com 2 é liberada
// na tolerância), QR de uso único, acessos offline e alertas de frequência.
describe('Acesso (regras, QR, offline e alertas)', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let app: INestApplicationContext;
  let tenantId: string;
  const quinta = (hora: string): Date => new Date(`2026-11-19T${hora}:00-03:00`);
  let agora = quinta('10:00');

  const noTenant = <T>(corpo: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenantId, corpo);
  const alunoId = (cpf: string): Promise<string | null> =>
    noTenant(() => app.get(RepositorioDeAlunos).idPorCpf(cpf));

  beforeAll(async () => {
    app = await criarModuloDeEventos(banco, redis, {}, [
      ProtecaoDeDadosModule,
      AlunosModule,
      FuncionariosModule,
      AvisosModule,
      AcessoModule,
    ]);
    vi.spyOn(app.get(Relogio), 'agora').mockImplementation(() => new Date(agora));
    await executarSeed(app, MODULOS_DE_SEED);
    const tenant = await app.get(RepositorioDeTenants).porSlug(ACADEMIA_RITMO.slug);
    tenantId = tenant?.id ?? '';
  });

  it('ADR-018: 6 dias de atraso é negado; 2 dias é liberado na tolerância', async () => {
    agora = quinta('08:00'); // antes das passagens de hoje gravadas pelo seed
    const rafael = (await alunoId('52998224725')) ?? '';
    const juliana = (await alunoId('39053344705')) ?? '';

    const negado = await noTenant(() =>
      app.get(Acessos).registrar({ alunoId: rafael, metodo: 'biometria', direcao: 'entrada' }),
    );
    const tolerancia = await noTenant(() =>
      app.get(Acessos).registrar({ alunoId: juliana, metodo: 'biometria', direcao: 'entrada' }),
    );

    expect(negado.acesso).toMatchObject({ resultado: 'negado', motivo: 'mensalidade_em_atraso' });
    expect(negado.motivoTexto).toBe('Mensalidade em atraso');
    expect(tolerancia.acesso).toMatchObject({ resultado: 'tolerancia', motivo: null });
  });

  it('QR: vale uma vez, o mesmo token de novo é "QR já usado" e 61 s expira', async () => {
    const pedro = (await alunoId('12345678909')) ?? '';
    agora = quinta('10:00');
    const qr = await noTenant(() => app.get(QrDeCheckin).emitir(pedro));
    agora = quinta('11:00');
    const emitido = await noTenant(() => app.get(QrDeCheckin).emitir(pedro));

    agora = new Date(agora.getTime() + 10_000);
    const primeira = await noTenant(() => app.get(Acessos).registrarPorQr(emitido.token, {}));
    const repetida = await noTenant(() => app.get(Acessos).registrarPorQr(emitido.token, {}));
    agora = new Date(quinta('12:00').getTime());
    const antigo = await noTenant(() => app.get(Acessos).registrarPorQr(qr.token, {}));

    expect(primeira.acesso).toMatchObject({ metodo: 'qr_code', resultado: 'liberado' });
    expect(repetida.acesso).toMatchObject({ resultado: 'negado', motivo: 'qr_ja_usado' });
    expect(antigo.acesso).toMatchObject({ resultado: 'negado', motivo: 'qr_expirado' });
  });

  it('acessos offline repetidos e fora de ordem são gravados uma vez, e o QR usado offline vale como usado', async () => {
    const larissa = (await alunoId('45678901249')) ?? '';
    agora = quinta('13:00');
    const a = {
      idDeOrigem: randomUUID(),
      alunoId: larissa,
      metodo: 'facial' as const,
      direcao: 'entrada' as const,
      resultado: 'liberado' as const,
      registradoEm: quinta('12:05'),
    };
    const b = {
      ...a,
      idDeOrigem: randomUUID(),
      direcao: 'saida' as const,
      registradoEm: quinta('12:50'),
    };

    const resultado = await noTenant(() => app.get(Acessos).sincronizar([b, a, a, b]));
    const reenvio = await noTenant(() => app.get(Acessos).sincronizar([a]));

    expect(resultado).toEqual({ gravados: 2, repetidos: 2, qrRepetidos: 0 });
    expect(reenvio).toEqual({ gravados: 0, repetidos: 1, qrRepetidos: 0 });
  });

  it('limite de 1 entrada por dia: a segunda é "limite diário"', async () => {
    const bruno = (await alunoId('87654321007')) ?? '';
    agora = quinta('09:00');
    const entrar = () =>
      noTenant(() =>
        app.get(Acessos).registrar({ alunoId: bruno, metodo: 'facial', direcao: 'entrada' }),
      );
    const sair = () =>
      noTenant(() =>
        app.get(Acessos).registrar({ alunoId: bruno, metodo: 'facial', direcao: 'saida' }),
      );

    expect((await entrar()).acesso.resultado).toBe('liberado');
    agora = quinta('09:30');
    expect((await entrar()).acesso).toMatchObject({ resultado: 'negado', motivo: 'anti_passback' });
    await sair();
    agora = quinta('10:00');
    expect((await entrar()).acesso).toMatchObject({ resultado: 'negado', motivo: 'limite_diario' });
  });

  it('frequência por horário, presenças do mês e alertas (Camila, 15 dias sem vir, é urgente)', async () => {
    agora = quinta('14:00');
    const frequencia = await noTenant(() => app.get(Frequencia).frequenciaPorHorario());
    const presencas = await noTenant(() => app.get(Frequencia).presencasDoMes('2026-11'));
    const camila = (await alunoId('11144477735')) ?? '';
    const resultado = await noTenant(() => app.get(AlertasDeFrequencia).verificar());
    const repetido = await noTenant(() => app.get(AlertasDeFrequencia).verificar());
    const risco = await noTenant(() => app.get(AlertasDeFrequencia).emRisco({ limite: 50 }));

    expect(frequencia.faixas).toHaveLength(24);
    expect(presencas.total).toBeGreaterThan(0);
    expect(resultado.abertos).toBeGreaterThan(0);
    expect(repetido).toMatchObject({ abertos: 0, resolvidos: 0 });
    expect(risco.itens.find((item) => item.alunoId === camila)).toMatchObject({
      nivel: 'urgente',
      tipo: 'sem_treinar',
    });
  });
});
