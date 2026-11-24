import { RepositorioDeTenants } from '../modules/platform/application/portas';
import { ExecutorDeTenant } from '../modules/platform/infra/contexto/executor-de-tenant';
import {
  CifraDeSenha,
  RepositorioDeTiposDeAcesso,
  RepositorioDeUsuarios,
} from '../modules/autenticacao/application/portas';
import {
  type ChaveDoTipoPadrao,
  TIPOS_PADRAO,
} from '../modules/autenticacao/domain/tipos-de-acesso';
import type { ModuloDeSeed } from './modulo-de-seed';
import { ACADEMIA_RITMO } from './plataforma';

/** Senha dos usuários do seed (só dev e E2E). */
export const SENHA_DO_SEED = 'gymos1234';

/** Equipe das telas. O vínculo de cada um a um Funcionário é do T26a. */
export const EQUIPE_DO_SEED: ReadonlyArray<{
  nome: string;
  email: string;
  tipo: ChaveDoTipoPadrao;
}> = [
  { nome: 'Administrador', email: 'admin@academiaritmo.com', tipo: 'administrador' },
  { nome: 'Carla Menezes', email: 'carla@academiaritmo.com', tipo: 'gerente' },
  { nome: 'João Batista', email: 'joao@academiaritmo.com', tipo: 'recepcao' },
  { nome: 'Diego Martins', email: 'diego@academiaritmo.com', tipo: 'professor' },
];

/** Tipos de acesso padrão e a equipe da Academia Ritmo. Idempotente: não duplica nem troca senha. */
export const seedDaAutenticacao: ModuloDeSeed = {
  nome: 'autenticacao',
  dependeDe: ['plataforma'],
  async executar(app) {
    const ritmo = await app.get(RepositorioDeTenants).porSlug(ACADEMIA_RITMO.slug);
    if (!ritmo) {
      throw new Error('Seed da autenticação exige o tenant Ritmo (seed da plataforma).');
    }
    const tipos = app.get(RepositorioDeTiposDeAcesso);
    const usuarios = app.get(RepositorioDeUsuarios);
    const cifra = app.get(CifraDeSenha);
    await app.get(ExecutorDeTenant).runAsTenant(ritmo.id, async () => {
      await tipos.garantirPadrao(TIPOS_PADRAO);
      for (const pessoa of EQUIPE_DO_SEED) {
        if (await usuarios.porEmail(pessoa.email)) {
          continue;
        }
        const tipo = await tipos.porChave(pessoa.tipo);
        await usuarios.criar({
          nome: pessoa.nome,
          email: pessoa.email,
          senhaHash: await cifra.cifrar(SENHA_DO_SEED),
          tipoDeAcessoId: tipo?.id ?? '',
        });
      }
    });
  },
};
