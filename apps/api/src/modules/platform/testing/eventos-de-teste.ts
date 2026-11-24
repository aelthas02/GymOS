import type { INestApplicationContext, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NovoEvento, PayloadDoEvento } from '@gymos/shared-events';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import type { Tenant } from '../domain/tenant';
import { AuditoriaModule } from '../auditoria.module';
import { EventosModule } from '../eventos.module';
import { CONFIGURACAO_DA_PLATAFORMA, type ConfiguracaoDaPlataforma } from '../infra/configuracao';
import {
  CONFIGURACAO_DAS_FILAS,
  type ConfiguracaoDasFilas,
} from '../infra/filas/configuracao-das-filas';
import { PlatformModule } from '../platform.module';
import { LocalizadorDeAlunoPorCpf } from '../../autenticacao/application/portas';
import { AutenticacaoModule } from '../../autenticacao/autenticacao.module';
import {
  CONFIGURACAO_DA_AUTENTICACAO,
  type ConfiguracaoDaAutenticacao,
} from '../../autenticacao/infra/configuracao';
import { LocalizadorDeAlunoEmMemoria } from '../../autenticacao/infra/localizador-de-aluno';
import {
  CONFIGURACAO_DA_CIFRA,
  type ConfiguracaoDaCifra,
} from '../infra/protecao-de-dados/configuracao';
import { CHAVE_DE_OPERACAO_DE_TESTE, SEGREDO_DO_JWT_DE_TESTE } from './app-de-teste';
import { CHAVE_MESTRA_DE_TESTE } from './protecao-de-dados-de-teste';
import type { BancoDeTeste } from './banco-de-teste';
import { comTenant } from './fabricas';
import type { RedisDeTeste } from './redis-de-teste';

/**
 * Um "processo" da API com a plataforma e o módulo de eventos, ligado ao banco e ao Redis do arquivo
 * de teste. Dois módulos sobre o mesmo banco e prefixo fazem o papel de dois workers. Os workers não
 * sobem sozinhos: o teste inicia os que precisa. `modulos` acrescenta módulos de domínio (ex.: o
 * ProtecaoDeDadosModule e o AlunosModule no seed).
 */
export async function criarModuloDeEventos(
  banco: BancoDeTeste,
  redis: RedisDeTeste,
  configuracao: Partial<ConfiguracaoDasFilas> = {},
  modulos: NonNullable<ModuleMetadata['imports']> = [],
): Promise<INestApplicationContext> {
  // A autenticação (T12) fornece o ConviteDoAdministrador que a plataforma exige.
  const modulo = await Test.createTestingModule({
    imports: [PlatformModule, AutenticacaoModule, EventosModule, AuditoriaModule, ...modulos],
  })
    .overrideProvider(CONFIGURACAO_DA_AUTENTICACAO)
    .useValue({
      segredoDoJwt: SEGREDO_DO_JWT_DE_TESTE,
      urlDoRedis: redis.url,
      prefixoDoRedis: `${redis.prefixo}:autenticacao`,
      urlDoApp: 'http://{tenant}.localhost:4300',
      transporteDeEmail: 'fake',
      smtp: { host: 'localhost', porta: 1025 },
      remetente: 'GymOS <teste@gymos.app>',
    } satisfies ConfiguracaoDaAutenticacao)
    .overrideProvider(LocalizadorDeAlunoPorCpf)
    .useClass(LocalizadorDeAlunoEmMemoria)
    .overrideProvider(CONFIGURACAO_DA_PLATAFORMA)
    .useValue({
      ambiente: 'test',
      urlDoBanco: banco.urlApp,
      dominioBase: 'localhost',
      chaveDeOperacao: CHAVE_DE_OPERACAO_DE_TESTE,
      urlDoPainel: 'http://{tenant}.localhost:4200',
    } satisfies ConfiguracaoDaPlataforma)
    .overrideProvider(CONFIGURACAO_DAS_FILAS)
    .useValue({
      urlDoRedis: redis.url,
      prefixo: redis.prefixo,
      processar: false,
      painel: false,
      tentativas: 5,
      atrasoInicialMs: 10,
      intervaloDoDespachoMs: 100,
      tamanhoDoLote: 50,
      ...configuracao,
    } satisfies ConfiguracaoDasFilas)
    .overrideProvider(CONFIGURACAO_DA_CIFRA)
    .useValue({ chaveMestraLocal: CHAVE_MESTRA_DE_TESTE } satisfies ConfiguracaoDaCifra)
    .compile();
  modulo.useLogger(false);
  await modulo.init();
  banco.aoFinal(() => modulo.close());
  return modulo;
}

export function pagamentoConfirmado(
  payload: Partial<PayloadDoEvento<'PagamentoConfirmado'>> = {},
): NovoEvento<'PagamentoConfirmado'> {
  return {
    tipo: 'PagamentoConfirmado',
    payload: {
      pagamentoId: randomUUID(),
      cobrancaId: randomUUID(),
      parcelaId: randomUUID(),
      contratoId: randomUUID(),
      alunoId: randomUUID(),
      valorEmCentavos: 14_990,
      taxaEmCentavos: 148,
      meio: 'pix',
      origem: 'mensalidade',
      setor: 'academia',
      confirmadoEm: '2026-11-23T14:00:00.000Z',
      ...payload,
    },
  };
}

/** Tenant só em memória, para testes que não tocam o banco (cache e tempo real). */
export function tenantFicticio(slug: string): Tenant {
  return {
    id: randomUUID(),
    slug,
    nome: `Academia ${slug}`,
    corDestaque: '#22C98A',
    logotipoUrl: null,
    plano: 'base',
    configurada: true,
  };
}

/** Quantas vezes o efeito de teste (uma unidade com o nome `efeito:<evento>`) aconteceu. */
export function contarEfeitos(app: Client, tenantId: string, eventoId: string): Promise<number> {
  return comTenant(app, tenantId, async () => {
    const { rows } = await app.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM unidade WHERE nome = $1',
      [`efeito:${eventoId}`],
    );
    return rows[0]?.total ?? 0;
  });
}

/** Eventos do tenant no outbox, lidos como o dono da tabela (a política do despachante). */
export async function eventosNoOutbox(
  migrador: Client,
  tenantId: string,
): Promise<Array<{ id: string; publicado: boolean }>> {
  const { rows } = await migrador.query<{ id: string; publicado: boolean }>(
    'SELECT id, publicado_em IS NOT NULL AS publicado FROM evento_outbox WHERE tenant_id = $1',
    [tenantId],
  );
  return rows;
}
