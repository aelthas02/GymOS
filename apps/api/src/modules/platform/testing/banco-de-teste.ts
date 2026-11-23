import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { inject } from 'vitest';
import {
  apagarBanco,
  concederAcesso,
  credenciaisDaUrl,
  criarBanco,
  urlComBanco,
} from '../infra/database/preparar-banco';

export interface BancoDeTeste {
  readonly nome: string;
  readonly urlApp: string;
  readonly urlMigrador: string;
  /** Conexão como gymos_app (sujeita a RLS), fechada no afterAll. */
  conectarComoApp(): Promise<Client>;
  /** Conexão como gymos_migrator (dono das tabelas), fechada no afterAll. */
  conectarComoMigrador(): Promise<Client>;
  /** Registra um recurso para fechar no afterAll, antes de apagar o banco. */
  aoFinal(fechar: () => Promise<unknown>): void;
}

// Banco próprio do arquivo de teste, clonado do modelo migrado pelo globalSetup.
export function usarBancoDeTeste(): BancoDeTeste {
  const config = inject('bancoDeTeste');
  const nome = `${config.prefixo}_${randomBytes(3).toString('hex')}`;
  const finais: Array<() => Promise<unknown>> = [];

  beforeAll(async () => {
    await criarBanco(config.urlAdmin, nome, { modelo: config.modelo });
    await concederAcesso(config.urlAdmin, nome, {
      migrador: credenciaisDaUrl(config.urlMigrador),
      app: credenciaisDaUrl(config.urlApp),
    });
  }, 60_000);

  afterAll(async () => {
    for (const fechar of finais.reverse()) {
      await fechar();
    }
    await apagarBanco(config.urlAdmin, nome);
  }, 60_000);

  const conectar = async (url: string): Promise<Client> => {
    const client = new Client({ connectionString: url });
    await client.connect();
    finais.push(() => client.end());
    return client;
  };

  return {
    nome,
    urlApp: urlComBanco(config.urlApp, nome),
    urlMigrador: urlComBanco(config.urlMigrador, nome),
    conectarComoApp: () => conectar(urlComBanco(config.urlApp, nome)),
    conectarComoMigrador: () => conectar(urlComBanco(config.urlMigrador, nome)),
    aoFinal: (fechar) => finais.push(fechar),
  };
}
