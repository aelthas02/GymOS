import type { Client } from 'pg';
import { comTenant } from '../../platform/testing/fabricas';
import type { ModuloExtra } from '../domain/permissoes';
import { type ChaveDoTipoPadrao, TIPOS_PADRAO } from '../domain/tipos-de-acesso';
import { CifraDeSenhaArgon2 } from '../infra/seguranca';

// Fábricas de autenticação para testes de integração, pela conexão do gymos_app (com RLS).

const cifra = new CifraDeSenhaArgon2();

/** Cria os tipos padrão que faltarem e devolve o id de cada um pela chave. */
export async function criarTiposPadrao(
  app: Client,
  tenantId: string,
): Promise<Record<ChaveDoTipoPadrao, string>> {
  return comTenant(app, tenantId, async () => {
    for (const tipo of TIPOS_PADRAO) {
      await app.query(
        'INSERT INTO tipo_de_acesso (tenant_id, chave, nome, permissoes) VALUES ($1, $2, $3, $4) ' +
          'ON CONFLICT DO NOTHING',
        [tenantId, tipo.chave, tipo.nome, tipo.permissoes],
      );
    }
    const { rows } = await app.query<{ id: string; chave: ChaveDoTipoPadrao }>(
      'SELECT id, chave FROM tipo_de_acesso WHERE chave IS NOT NULL',
    );
    return Object.fromEntries(rows.map((linha) => [linha.chave, linha.id])) as Record<
      ChaveDoTipoPadrao,
      string
    >;
  });
}

export async function criarUsuario(
  app: Client,
  tenantId: string,
  dados: { chave: ChaveDoTipoPadrao; email: string; senha: string; nome?: string },
): Promise<string> {
  const tipos = await criarTiposPadrao(app, tenantId);
  const senhaHash = await cifra.cifrar(dados.senha);
  return comTenant(app, tenantId, async () => {
    const { rows } = await app.query<{ id: string }>(
      'INSERT INTO usuario (tenant_id, nome, email, senha_hash, tipo_de_acesso_id) ' +
        'VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [tenantId, dados.nome ?? dados.email, dados.email, senhaHash, tipos[dados.chave]],
    );
    return rows[0]?.id ?? '';
  });
}

export async function criarCredencialDeAluno(
  app: Client,
  tenantId: string,
  dados: { alunoId: string; email: string | null; senha: string },
): Promise<void> {
  const senhaHash = await cifra.cifrar(dados.senha);
  await comTenant(app, tenantId, () =>
    app.query(
      'INSERT INTO credencial_aluno (tenant_id, aluno_id, email, senha_hash) VALUES ($1, $2, $3, $4)',
      [tenantId, dados.alunoId, dados.email, senhaHash],
    ),
  );
}

/** Sobrescrita manual do módulo extra no tenant. */
export async function definirModulo(
  app: Client,
  tenantId: string,
  modulo: ModuloExtra,
  ativo: boolean,
): Promise<void> {
  await comTenant(app, tenantId, () =>
    app.query(
      'INSERT INTO modulo_do_tenant (tenant_id, modulo, ativo) VALUES ($1, $2, $3) ' +
        'ON CONFLICT (tenant_id, modulo) DO UPDATE SET ativo = EXCLUDED.ativo',
      [tenantId, modulo, ativo],
    ),
  );
}
