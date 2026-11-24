import { randomUUID } from 'node:crypto';
import {
  CONFIGURACAO_DE_ACESSO_PADRAO,
  type PedidoDeAcesso,
  avaliarAcesso,
  consolidarAcessosOffline,
  emitirQr,
  gerarParDeChavesDoQr,
  NoncesEmMemoria,
  validarQrOffline,
  verificarQr,
} from '../index';

// Casos do ticket T23a. ADR-018: com bloqueio após 7 dias, a catraca nega com diasDeAtraso ≥ 6.

const sp = (texto: string): Date => new Date(`${texto}-03:00`);

const pedido = (extra: Partial<PedidoDeAcesso> = {}): PedidoDeAcesso => ({
  direcao: 'entrada',
  instante: sp('2026-11-19T10:00:00'),
  modalidade: null,
  contrato: 'ativo',
  diasDeAtraso: 0,
  modalidadesDoPlano: ['Musculação'],
  acessosPorSemana: null,
  passagens: [],
  configuracao: CONFIGURACAO_DE_ACESSO_PADRAO,
  ...extra,
});

describe('regras de acesso (ADR-018)', () => {
  it.each([
    [0, 'liberado'],
    [2, 'tolerancia'],
    [5, 'tolerancia'],
    [6, 'negado'],
    [7, 'negado'],
  ])('bloqueio após 7 dias: %i dias de atraso → %s', (dias, esperado) => {
    expect(avaliarAcesso(pedido({ diasDeAtraso: dias })).resultado).toBe(esperado);
  });

  it('contrato trancado e encerrado negam', () => {
    expect(avaliarAcesso(pedido({ contrato: 'trancado' }))).toEqual({
      resultado: 'negado',
      motivo: 'plano_trancado',
    });
    expect(avaliarAcesso(pedido({ contrato: 'encerrado' }))).toEqual({
      resultado: 'negado',
      motivo: 'contrato_encerrado',
    });
  });

  it.each([
    ['2026-11-19T04:59:00', 'negado'],
    ['2026-11-19T05:00:00', 'liberado'],
    ['2026-11-19T22:59:00', 'liberado'],
    ['2026-11-19T23:00:00', 'negado'],
  ])('horário em São Paulo: %s → %s', (instante, esperado) => {
    expect(avaliarAcesso(pedido({ instante: sp(instante) })).resultado).toBe(esperado);
  });

  it('limite diário conta nova entrada após sair, e zera à meia-noite de São Paulo', () => {
    const passagens = [
      { direcao: 'entrada' as const, registradoEm: sp('2026-11-19T07:00:00') },
      { direcao: 'saida' as const, registradoEm: sp('2026-11-19T08:00:00') },
    ];
    expect(avaliarAcesso(pedido({ passagens }))).toEqual({
      resultado: 'negado',
      motivo: 'limite_diario',
    });
    expect(
      avaliarAcesso(pedido({ passagens, instante: sp('2026-11-20T05:00:00') })).resultado,
    ).toBe('liberado');
  });

  it('anti-passback nega entrada sem saída', () => {
    const passagens = [{ direcao: 'entrada' as const, registradoEm: sp('2026-11-19T07:00:00') }];
    const configuracao = { ...CONFIGURACAO_DE_ACESSO_PADRAO, limitePorDia: null };
    expect(avaliarAcesso(pedido({ passagens, configuracao }))).toEqual({
      resultado: 'negado',
      motivo: 'anti_passback',
    });
  });

  it('luta com plano só de musculação nega; saída nunca é barrada', () => {
    expect(avaliarAcesso(pedido({ modalidade: 'Lutas' }))).toEqual({
      resultado: 'negado',
      motivo: 'modalidade_fora_do_plano',
    });
    expect(avaliarAcesso(pedido({ direcao: 'saida', contrato: 'encerrado' })).resultado).toBe(
      'liberado',
    );
  });

  it('acessos por semana contam dias com entrada, de segunda a domingo', () => {
    const entradas = ['2026-11-16', '2026-11-17'].map((dia) => ({
      direcao: 'entrada' as const,
      registradoEm: sp(`${dia}T07:00:00`),
    }));
    expect(avaliarAcesso(pedido({ passagens: entradas, acessosPorSemana: 2 }))).toEqual({
      resultado: 'negado',
      motivo: 'limite_semanal',
    });
    expect(avaliarAcesso(pedido({ passagens: entradas, acessosPorSemana: 3 })).resultado).toBe(
      'liberado',
    );
  });
});

describe('QR de check-in', () => {
  const chaveId = randomUUID();
  const tenantId = randomUUID();
  const alunoId = randomUUID();
  const par = gerarParDeChavesDoQr();
  const chavesPublicas = { [chaveId]: par.chavePublica };
  const emissao = new Date('2026-11-19T13:00:00.000Z');
  const emitir = () =>
    emitirQr({ chavePrivada: par.chavePrivada, chaveId, tenantId, alunoId, agora: emissao });
  const em = (segundos: number): Date => new Date(emissao.getTime() + segundos * 1000);

  it('aceita uma vez e recusa o mesmo token de novo', () => {
    const { token } = emitir();
    const nonces = new NoncesEmMemoria();
    const conferencia = { chavesPublicas, tenantId, agora: em(10), nonces };
    expect(validarQrOffline(token, conferencia)).toMatchObject({ ok: true });
    expect(validarQrOffline(token, conferencia)).toEqual({ ok: false, motivo: 'ja_usado' });
  });

  it('60 s ainda vale; 61 s expira', () => {
    const { token } = emitir();
    expect(verificarQr(token, { chavesPublicas, tenantId, agora: em(60) }).ok).toBe(true);
    expect(verificarQr(token, { chavesPublicas, tenantId, agora: em(61) })).toEqual({
      ok: false,
      motivo: 'expirado',
    });
  });

  it('recusa token emitido no futuro além da tolerância do relógio', () => {
    const { token } = emitir();
    expect(verificarQr(token, { chavesPublicas, tenantId, agora: em(-6) })).toEqual({
      ok: false,
      motivo: 'emitido_no_futuro',
    });
  });

  it('recusa assinatura alterada, payload adulterado e outra academia', () => {
    const { token } = emitir();
    const [prefixo, kid, payload, assinatura] = token.split('.') as [
      string,
      string,
      string,
      string,
    ];
    const trocada = (assinatura.startsWith('A') ? 'B' : 'A') + assinatura.slice(1);
    const outroPayload = Buffer.from(
      JSON.stringify({
        v: 1,
        tid: tenantId,
        aid: randomUUID(),
        nonce: 'AAAAAAAAAAAAAAAAAAAAAA',
        iat: 1,
      }),
    ).toString('base64url');
    const conferencia = { chavesPublicas, tenantId, agora: em(1) };
    expect(verificarQr([prefixo, kid, payload, trocada].join('.'), conferencia)).toEqual({
      ok: false,
      motivo: 'assinatura',
    });
    expect(verificarQr([prefixo, kid, outroPayload, assinatura].join('.'), conferencia)).toEqual({
      ok: false,
      motivo: 'assinatura',
    });
    expect(verificarQr(token, { ...conferencia, tenantId: randomUUID() })).toEqual({
      ok: false,
      motivo: 'tenant',
    });
  });

  it('recusa chave desconhecida, de outro par e lixo', () => {
    const { token } = emitir();
    const outro = gerarParDeChavesDoQr();
    const agora = em(1);
    expect(verificarQr(token, { chavesPublicas: {}, tenantId, agora })).toMatchObject({
      motivo: 'chave_desconhecida',
    });
    expect(
      verificarQr(token, { chavesPublicas: { [chaveId]: outro.chavePublica }, tenantId, agora }),
    ).toMatchObject({ motivo: 'assinatura' });
    for (const lixo of ['', 'a.b.c', 'gq1.x.y.z', `${token}.extra`, 'gq1.__proto__.a.b']) {
      expect(verificarQr(lixo, { chavesPublicas, tenantId, agora })).toMatchObject({
        ok: false,
        motivo: 'formato',
      });
    }
  });
});

describe('acessos offline', () => {
  it('grava cada um uma vez, ordenados pelo horário de origem', () => {
    const a = { idDeOrigem: 'a', registradoEm: sp('2026-11-19T10:05:00') };
    const b = { idDeOrigem: 'b', registradoEm: sp('2026-11-19T10:01:00') };
    const c = { idDeOrigem: 'c', registradoEm: sp('2026-11-19T10:03:00') };
    expect(consolidarAcessosOffline([a, c, b, a, c]).map((r) => r.idDeOrigem)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });
});
