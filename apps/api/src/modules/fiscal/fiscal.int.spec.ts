import type { INestApplicationContext } from '@nestjs/common';
import type { PayloadDoEvento } from '@gymos/shared-events';
import { randomUUID } from 'node:crypto';
import { AlunosModule } from '../alunos/alunos.module';
import { Alunos } from '../alunos/application/alunos';
import { RepositorioDeTenants } from '../platform/application/portas';
import type { Tenant } from '../platform/domain/tenant';
import { ExecutorDeTenant } from '../platform/infra/contexto/executor-de-tenant';
import { ProtecaoDeDadosModule } from '../platform/protecao-de-dados.module';
import { usarBancoDeTeste } from '../platform/testing/banco-de-teste';
import { criarModuloDeEventos } from '../platform/testing/eventos-de-teste';
import { criarTenant, criarUnidade } from '../platform/testing/fabricas';
import { usarRedisDeTeste } from '../platform/testing/redis-de-teste';
import { ExportacaoParaOContador } from './application/exportacao';
import { NotasFiscais } from './application/notas-fiscais';
import { RepositorioDaConfiguracaoFiscal } from './application/portas';
import type { Competencia } from './domain/nota-fiscal';
import { FiscalModule } from './fiscal.module';
import { EmissorFiscalFake } from './infra/emissor.fake';
import { DADOS_FISCAIS_DO_SEED } from '../../seed/notas';

// Casos de maior risco do T20: nota em duplicidade no emissor, resposta perdida, rejeição e
// correção, estorno e a exportação por tenant.
describe('Notas fiscais (emissão idempotente, rejeição, estorno e exportação)', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let app: INestApplicationContext;
  let tenantA: Tenant;
  let tenantB: Tenant;
  const executor = { usuarioId: '00000000-0000-4000-8000-000000000001' };
  const novembro = '2026-11' as Competencia;

  const noTenant = <T>(tenant: Tenant, corpo: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenant.id, corpo);
  const emissor = () => app.get(EmissorFiscalFake);
  const notas = () => app.get(NotasFiscais);

  async function criar(): Promise<Tenant> {
    const conexao = await banco.conectarComoApp();
    const criado = await criarTenant(conexao);
    await criarUnidade(conexao, criado.id, 'Centro');
    const achado = await app.get(RepositorioDeTenants).porSlug(criado.slug);
    if (!achado) {
      throw new Error('tenant do teste não encontrado');
    }
    await app
      .get(ExecutorDeTenant)
      .runAsTenant(achado.id, () =>
        app.get(RepositorioDaConfiguracaoFiscal).salvar(DADOS_FISCAIS_DO_SEED),
      );
    return achado;
  }

  const aluno = (tenant: Tenant, cpf: string) =>
    noTenant(
      tenant,
      async () =>
        (
          await app.get(Alunos).cadastrar(null, {
            nome: `Aluno ${cpf}`,
            cpf,
            telefone: null,
            email: null,
            dataNascimento: null,
            professorId: null,
            meta: null,
            restricoes: null,
            leadId: null,
          })
        ).id,
    );

  const pagamento = (
    alunoId: string,
    extra: Partial<PayloadDoEvento<'PagamentoConfirmado'>> = {},
  ): PayloadDoEvento<'PagamentoConfirmado'> => ({
    pagamentoId: randomUUID(),
    cobrancaId: null,
    parcelaId: null,
    contratoId: null,
    alunoId,
    valorEmCentavos: 11900,
    taxaEmCentavos: 0,
    meio: 'pix',
    origem: 'mensalidade',
    setor: 'academia',
    confirmadoEm: '2026-11-10T13:00:00.000Z',
    ...extra,
  });

  beforeAll(async () => {
    app = await criarModuloDeEventos(banco, redis, {}, [
      ProtecaoDeDadosModule,
      AlunosModule,
      FiscalModule,
    ]);
    tenantA = await criar();
    tenantB = await criar();
  });

  beforeEach(() => emissor().limpar());

  it('PagamentoConfirmado entregue duas vezes, inclusive em paralelo, gera uma NFS-e com ISS de R$ 2,98', async () => {
    const alunoId = await aluno(tenantA, '11144477735');
    const confirmado = pagamento(alunoId);
    const entregar = () =>
      noTenant(tenantA, () => notas().registrarDoPagamento(tenantA.id, confirmado));

    await Promise.all([entregar(), entregar()]);
    await entregar();

    const doPagamento = await noTenant(tenantA, () => notas().listar({ alunoId }, { limite: 10 }));
    expect(doPagamento.itens).toHaveLength(1);
    expect(doPagamento.itens[0]).toMatchObject({
      tipo: 'nfse',
      situacao: 'emitida',
      issCentavos: 298,
      valorCentavos: 11900,
      competencia: novembro,
    });
    expect([...emissor().emissoes.values()]).toEqual([1]);
  });

  it('resposta perdida: fica processando e a conferência acha a nota no emissor sem emitir de novo', async () => {
    const alunoId = await aluno(tenantA, '87654321007');
    emissor().programar('resposta-perdida');

    const nota = await noTenant(tenantA, () =>
      notas().registrarDoPagamento(tenantA.id, pagamento(alunoId)),
    );
    expect(nota?.situacao).toBe('processando');

    const conferida = await noTenant(tenantA, () => notas().processar(nota?.id ?? ''));
    expect(conferida).toMatchObject({ situacao: 'emitida', numero: expect.any(String) });
    expect(emissor().emissoes.get(nota?.id ?? '')).toBe(1);
  });

  it('venda da Loja gera NFC-e', async () => {
    const alunoId = await aluno(tenantA, '23456789092');
    const nota = await noTenant(tenantA, () =>
      notas().registrarDoPagamento(tenantA.id, pagamento(alunoId, { origem: 'loja' })),
    );
    expect(nota).toMatchObject({ tipo: 'nfce', situacao: 'emitida' });
  });

  it('CPF não encontrado fica rejeitada; corrigir o CPF e reenviar emite', async () => {
    const alunoId = await aluno(tenantA, '52998224725');
    const nota = await noTenant(tenantA, () =>
      notas().registrarDoPagamento(tenantA.id, pagamento(alunoId)),
    );
    expect(nota).toMatchObject({
      situacao: 'rejeitada',
      motivoDaRejeicao: 'CPF não encontrado na Receita Federal',
    });

    const corrigida = await noTenant(tenantA, () =>
      notas().corrigir(executor, nota?.id ?? '', { cpf: '345.678.901-75' }),
    );
    expect(corrigida).toMatchObject({ situacao: 'emitida', tomadorCpf: '34567890175' });
  });

  it('PagamentoEstornado cancela a nota emitida; a cancelada recusa novo cancelamento', async () => {
    const alunoId = await aluno(tenantA, '45678901249');
    const confirmado = pagamento(alunoId);
    const nota = await noTenant(tenantA, () =>
      notas().registrarDoPagamento(tenantA.id, confirmado),
    );
    const estorno = {
      pagamentoId: confirmado.pagamentoId,
      cobrancaId: null,
      parcelaId: null,
      alunoId,
      valorEmCentavos: 11900,
      total: true,
      estornadoEm: '2026-11-12T13:00:00.000Z',
    };

    expect(await noTenant(tenantA, () => notas().aoEstornar(estorno))).toBe(1);
    expect(await noTenant(tenantA, () => notas().aoEstornar(estorno))).toBe(0);
    await expect(
      noTenant(tenantA, () => notas().cancelar(executor, nota?.id ?? '', 'De novo')),
    ).rejects.toThrow('já está cancelada');
  });

  it('a exportação traz os XMLs do período e nenhum de outro tenant', async () => {
    const alunoDeB = await aluno(tenantB, '34567890175');
    await noTenant(tenantB, () => notas().registrarDoPagamento(tenantB.id, pagamento(alunoDeB)));

    const zip = await noTenant(tenantA, () => app.get(ExportacaoParaOContador).exportar(novembro));
    const texto = zip.conteudo.toString('latin1');
    const xmls = texto.match(/xml\/nfs?c?e-\d+\.xml/g) ?? [];
    expect(xmls.length).toBeGreaterThanOrEqual(3);
    expect(texto).toContain('notas-2026-11.csv');
    expect(texto).not.toContain('Aluno 34567890175');
  });
});
