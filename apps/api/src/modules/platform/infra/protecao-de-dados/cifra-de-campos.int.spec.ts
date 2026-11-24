import type { INestApplication } from '@nestjs/common';
import type { Client } from 'pg';
import { CifraDeCampos, definirCamposProtegidos } from '../../application/protecao-de-dados';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../testing/fabricas';
import {
  criarTabelaDeFichas,
  type Ficha,
  gravarFicha,
  lerFichaPorCpf,
} from '../../testing/protecao-de-dados-de-teste';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { CifraInvalidaError } from './cifra-de-campos';

const FICHA = definirCamposProtegidos('ficha', {
  cpf: { indice: 'cpf' },
  saude: { sensivel: true },
});

describe('cifra de campos e índice cego', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let migrador: Client;
  let academia: TenantCriado;
  let outra: TenantCriado;

  const comoTenant = <T>(tenant: TenantCriado, fn: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenant.id, fn);

  beforeAll(async () => {
    migrador = await banco.conectarComoMigrador();
    await criarTabelaDeFichas(migrador);
    app = await criarAppDeTeste(banco);
    const conexao = await banco.conectarComoApp();
    academia = await criarTenant(conexao);
    outra = await criarTenant(conexao);
  });

  it('CPF gravado não aparece em texto no banco; leitura devolve o original; chave de outro tenant não decifra', async () => {
    const cifra = app.get(CifraDeCampos);

    const protegida = await comoTenant(academia, async () => {
      const dados = await cifra.proteger(FICHA, { cpf: '123.456.789-09', saude: null });
      await gravarFicha(app.get(ContextoDoTenant), academia.id, dados);
      return dados;
    });

    const { rows } = await migrador.query<Ficha>(
      'SELECT cpf, cpf_hash AS "cpfHash" FROM ficha_de_teste WHERE tenant_id = $1',
      [academia.id],
    );
    const gravado = JSON.stringify(rows);
    expect(rows).toHaveLength(1);
    expect(gravado).not.toContain('12345678909');
    expect(gravado).not.toContain('123.456.789-09');
    expect(gravado).not.toContain('456');

    const lida = await comoTenant(academia, async () => {
      const ficha = await lerFichaPorCpf(app.get(ContextoDoTenant), protegida.cpfHash ?? '');
      return cifra.revelar(FICHA, ficha, { titularId: ficha.id, quem: 'usuario-1' });
    });
    expect(lida.cpf).toBe('123.456.789-09');

    await expect(comoTenant(outra, () => cifra.decifrar('ficha.cpf', protegida.cpf))).rejects.toThrow(
      CifraInvalidaError,
    );
  });

  it('123.456.789-09 e 12345678909 geram o mesmo hash e encontram o mesmo registro', async () => {
    const cifra = app.get(CifraDeCampos);

    await comoTenant(academia, async () => {
      const comPontuacao = await cifra.indiceCego('cpf', '987.654.321-00');
      const soDigitos = await cifra.indiceCego('cpf', '98765432100');
      expect(comPontuacao).toBe(soDigitos);

      const dados = await cifra.proteger(FICHA, { cpf: '987.654.321-00', saude: null });
      const id = await gravarFicha(app.get(ContextoDoTenant), academia.id, dados);
      const encontrada = await lerFichaPorCpf(app.get(ContextoDoTenant), soDigitos);
      expect(encontrada.id).toBe(id);
    });
  });

  it('segundo aluno com o mesmo CPF no mesmo tenant falha pela constraint; em outro tenant, é aceito', async () => {
    const cifra = app.get(CifraDeCampos);
    const gravar = (tenant: TenantCriado) =>
      comoTenant(tenant, async () =>
        gravarFicha(
          app.get(ContextoDoTenant),
          tenant.id,
          await cifra.proteger(FICHA, { cpf: '111.444.777-35', saude: null }),
        ),
      );

    await gravar(academia);

    await expect(gravar(academia)).rejects.toThrow(/ficha_de_teste_tenant_id_cpf_hash_key|unique/i);
    await expect(gravar(outra)).resolves.toEqual(expect.any(String));
  });

  it('leitura de campo sensível grava log de acesso; leitura de campo comum não grava', async () => {
    const cifra = app.get(CifraDeCampos);
    const acessos = async (titularId: string) =>
      (
        await migrador.query<{ quem: string; campo: string; acessado_em: Date }>(
          'SELECT quem, campo, acessado_em FROM acesso_a_dado_sensivel WHERE titular_id = $1',
          [titularId],
        )
      ).rows;

    const [comSaude, semSaude] = await comoTenant(academia, async () => {
      const contexto = app.get(ContextoDoTenant);
      const a = await gravarFicha(
        contexto,
        academia.id,
        await cifra.proteger(FICHA, { cpf: '222.333.444-05', saude: 'asma' }),
      );
      const b = await gravarFicha(
        contexto,
        academia.id,
        await cifra.proteger(FICHA, { cpf: '333.444.555-06', saude: null }),
      );
      return [a, b];
    });

    const lida = await comoTenant(academia, async () => {
      const contexto = app.get(ContextoDoTenant);
      const ficha = await lerFichaPorCpf(contexto, await cifra.indiceCego('cpf', '22233344405'));
      const comum = await lerFichaPorCpf(contexto, await cifra.indiceCego('cpf', '33344455506'));
      await cifra.revelar(FICHA, comum, { titularId: semSaude, quem: 'usuario-2' });
      return cifra.revelar(FICHA, ficha, { titularId: comSaude, quem: 'usuario-2' });
    });

    expect(lida.saude).toBe('asma');
    expect(await acessos(comSaude)).toEqual([
      { quem: 'usuario-2', campo: 'ficha.saude', acessado_em: expect.any(Date) },
    ]);
    expect(await acessos(semSaude)).toEqual([]);
  });
});
