import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import type { Client } from 'pg';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../../app/configure-app';
import { AutenticacaoModule } from '../../../autenticacao/autenticacao.module';
import { LocalizadorDeAlunoPorCpf } from '../../../autenticacao/application/portas';
import {
  CONFIGURACAO_DA_AUTENTICACAO,
  type ConfiguracaoDaAutenticacao,
} from '../../../autenticacao/infra/configuracao';
import { LocalizadorDeAlunoEmMemoria } from '../../../autenticacao/infra/localizador-de-aluno';
import { criarTiposPadrao, criarUsuario } from '../../../autenticacao/testing/fabricas';
import { tokenDeAcesso } from '../../../autenticacao/testing/sessao';
import { AcessoModule } from '../../../acesso/acesso.module';
import { AlunosModule } from '../../../alunos/alunos.module';
import { AuditoriaModule } from '../../../platform/auditoria.module';
import { EventosModule } from '../../../platform/eventos.module';
import {
  CONFIGURACAO_DA_PLATAFORMA,
  type ConfiguracaoDaPlataforma,
} from '../../../platform/infra/configuracao';
import {
  CONFIGURACAO_DAS_FILAS,
  type ConfiguracaoDasFilas,
} from '../../../platform/infra/filas/configuracao-das-filas';
import {
  CONFIGURACAO_DA_CIFRA,
  type ConfiguracaoDaCifra,
} from '../../../platform/infra/protecao-de-dados/configuracao';
import { PlatformModule } from '../../../platform/platform.module';
import { ProtecaoDeDadosModule } from '../../../platform/protecao-de-dados.module';
import { AvisosModule } from '../../../avisos/avisos.module';
import {
  CHAVE_DE_OPERACAO_DE_TESTE,
  SEGREDO_DO_JWT_DE_TESTE,
} from '../../../platform/testing/app-de-teste';
import { usarBancoDeTeste } from '../../../platform/testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../../platform/testing/fabricas';
import { CHAVE_MESTRA_DE_TESTE } from '../../../platform/testing/protecao-de-dados-de-teste';
import { usarRedisDeTeste } from '../../../platform/testing/redis-de-teste';
import { FuncionariosModule } from '../../../funcionarios/funcionarios.module';
import { DispositivosModule } from '../../dispositivos.module';

// HTTP do T23b: a credencial do agente (pareamento, revogação, 401) e o SSE autenticado, que não pode
// ficar preso à transação por requisição.
describe('API do agente e SSE (HTTP)', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let app: INestApplication;
  let conexao: Client;
  let academia: TenantCriado;
  let staff: string;
  const host = (): string => `${academia.slug}.localhost:3000`;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [
        PlatformModule,
        AutenticacaoModule,
        EventosModule,
        ProtecaoDeDadosModule,
        AuditoriaModule,
        AlunosModule,
        FuncionariosModule,
        AvisosModule,
        AcessoModule,
        DispositivosModule,
      ],
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
        processar: true,
        painel: false,
        tentativas: 5,
        atrasoInicialMs: 10,
        intervaloDoDespachoMs: 100,
        tamanhoDoLote: 50,
      } satisfies ConfiguracaoDasFilas)
      .overrideProvider(CONFIGURACAO_DA_CIFRA)
      .useValue({ chaveMestraLocal: CHAVE_MESTRA_DE_TESTE } satisfies ConfiguracaoDaCifra)
      .compile();
    app = modulo.createNestApplication({ logger: false });
    app.setGlobalPrefix(GLOBAL_PREFIX);
    await app.init();
    await app.listen(0);
    banco.aoFinal(() => app.close());
    conexao = await banco.conectarComoApp();
    academia = await criarTenant(conexao);
    await criarTiposPadrao(conexao, academia.id);
    const usuarioId = await criarUsuario(conexao, academia.id, {
      chave: 'administrador',
      email: 'adm@academia.com',
      senha: 'senha-forte-123',
    });
    staff = tokenDeAcesso(app, { publico: 'staff', sujeitoId: usuarioId, tenantId: academia.id });
  });

  it('pareia, bate, sincroniza e perde o acesso quando a credencial é revogada', async () => {
    const codigo = await http()
      .post('/api/agentes-da-catraca/codigos')
      .set('Host', host())
      .auth(staff, { type: 'bearer' })
      .expect(201);
    const { credencial, agenteId } = (
      await http()
        .post('/api/agente/pareamento')
        .set('Host', host())
        .send({ codigo: codigo.body.codigoFormatado, nome: 'PC da recepção' })
        .expect(200)
    ).body as { credencial: string; agenteId: string };
    await http()
      .post('/api/agente/pareamento')
      .set('Host', host())
      .send({ codigo: codigo.body.codigo })
      .expect(400);

    await http().post('/api/agente/batimento').set('Host', host()).send({}).expect(401);
    await http()
      .post('/api/agente/batimento')
      .set('Host', host())
      .auth(staff, { type: 'bearer' })
      .send({})
      .expect(401);
    const batimento = await http()
      .post('/api/agente/batimento')
      .set('Host', host())
      .auth(credencial, { type: 'bearer' })
      .send({})
      .expect(200);
    const lote = await http()
      .post('/api/agente/acessos')
      .set('Host', host())
      .auth(credencial, { type: 'bearer' })
      .send({ registros: [], unidadeId: '00000000-0000-4000-8000-000000000001' })
      .expect(200);

    await http()
      .post(`/api/agentes-da-catraca/${agenteId}/revogar`)
      .set('Host', host())
      .auth(staff, { type: 'bearer' })
      .expect(204);
    await http()
      .post('/api/agente/acessos')
      .set('Host', host())
      .auth(credencial, { type: 'bearer' })
      .send({ registros: [], unidadeId: '00000000-0000-4000-8000-000000000001' })
      .expect(401);

    expect(batimento.body).toMatchObject({ comandos: [], versaoDoCache: expect.any(Number) });
    expect(lote.body).toEqual({ gravados: 0, repetidos: 0, qrRepetidos: 0 });
  });

  it('o SSE autenticado entrega o evento do tenant sem segurar transação', async () => {
    const porta = (app.getHttpServer().address() as AddressInfo).port;
    const controle = new AbortController();
    const resposta = await fetch(`http://127.0.0.1:${porta}/api/acesso/ao-vivo/stream`, {
      headers: {
        'x-tenant': academia.slug,
        authorization: `Bearer ${staff}`,
        accept: 'text/event-stream',
      },
      signal: controle.signal,
    });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('content-type')).toContain('text/event-stream');

    try {
      const semSessao = await http().get('/api/acesso/ao-vivo/stream').set('Host', host());
      expect(semSessao.status).toBe(401);

      // Um acesso sem aluno (rosto não reconhecido) passa pelo outbox, pelo worker e pelo canal.
      const leitor = resposta.body?.getReader();
      const decoder = new TextDecoder();
      await http()
        .post('/api/acesso/check-in')
        .set('Host', host())
        .auth(staff, { type: 'bearer' })
        .send({
          alunoId: '00000000-0000-4000-8000-000000000000',
          unidadeId: '00000000-0000-4000-8000-000000000001',
        })
        .expect(200);
      let texto = '';
      const limite = Date.now() + 8_000;
      while (!texto.includes('"tipo":"acesso"') && Date.now() < limite && leitor) {
        const { value, done } = await leitor.read();
        if (done) {
          break;
        }
        texto += decoder.decode(value);
      }
      expect(texto).toContain('"tipo":"acesso"');
      expect(texto).toContain('aluno_nao_encontrado');
    } finally {
      controle.abort();
    }
  });
});
