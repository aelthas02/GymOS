import type { INestApplicationContext } from '@nestjs/common';
import { AcessoModule } from '../modules/acesso/acesso.module';
import { AlunosModule } from '../modules/alunos/alunos.module';
import { AvisosModule } from '../modules/avisos/avisos.module';
import { FiscalModule } from '../modules/fiscal/fiscal.module';
import { FuncionariosModule } from '../modules/funcionarios/funcionarios.module';
import { ProtecaoDeDadosModule } from '../modules/platform/protecao-de-dados.module';
import { criarModuloDeEventos } from '../modules/platform/testing/eventos-de-teste';
import { usarBancoDeTeste } from '../modules/platform/testing/banco-de-teste';
import { comTenant } from '../modules/platform/testing/fabricas';
import { usarRedisDeTeste } from '../modules/platform/testing/redis-de-teste';
import type { ModuloDeSeed } from './modulo-de-seed';
import { MODULOS_DE_SEED } from './modulos';
import { ACADEMIA_RITMO } from './plataforma';
import { executarSeed } from './runner';

describe('runner de seed', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let app: INestApplicationContext;

  beforeAll(async () => {
    app = await criarModuloDeEventos(banco, redis, {}, [
      ProtecaoDeDadosModule,
      AlunosModule,
      FuncionariosModule,
      AvisosModule,
      AcessoModule,
      FiscalModule,
    ]);
  });

  it('roda os módulos registrados duas vezes sem duplicar dados', async () => {
    const dentroDoTenant: string[] = [];
    const sonda: ModuloDeSeed = {
      nome: 'sonda',
      dependeDe: ['autenticacao'],
      executar: (_app, contexto) =>
        contexto.noTenant(async (tenantId) => {
          dentroDoTenant.push(tenantId);
        }),
    };
    const modulos = [...MODULOS_DE_SEED, sonda];

    expect(await executarSeed(app, modulos)).toEqual([
      'plataforma',
      'autenticacao',
      'funcionarios',
      'alunos',
      'parcelas',
      'pagamentos',
      'acesso',
      'notas',
      'avisos',
      'sonda',
    ]);
    await executarSeed(app, modulos);

    const conexao = await banco.conectarComoApp();
    const { rows } = await conexao.query<{ id: string }>(
      'SELECT id FROM gymos_tenant_por_slug($1)',
      [ACADEMIA_RITMO.slug],
    );
    expect(rows).toHaveLength(1);
    expect(dentroDoTenant).toEqual([rows[0]?.id, rows[0]?.id]);
    const total = await comTenant(conexao, rows[0]?.id ?? '', async () => {
      const contagens = await Promise.all(
        [
          'unidade',
          'usuario',
          'plano',
          'aluno',
          'contrato',
          'funcionario',
          'parcela',
          'pagamento',
          'aviso',
          'nota_fiscal',
        ].map((tabela) => conexao.query<{ n: string }>(`SELECT count(*) AS n FROM ${tabela}`)),
      );
      return contagens.map((contagem) => contagem.rows[0]?.n);
    });
    expect(total).toEqual(['1', '4', '6', '8', '8', '8', '25', '19', '5', '7']);
  });
});
