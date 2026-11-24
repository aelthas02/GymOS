import type { INestApplication } from '@nestjs/common';
import type { Client } from 'pg';
import { CifraDeCampos } from '../../application/protecao-de-dados';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { comTenant, criarTenant, type TenantCriado } from '../../testing/fabricas';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { ChavesDoTenant, VersaoDeChaveDesconhecidaError } from './chaves-do-tenant';
import { CifraInvalidaError } from './cifra-de-campos';
import { ChaveMestraDesconhecidaError } from './provedor-de-chaves.local';

describe('rotação e criação de chave do tenant', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;

  const como = <T>(tenant: TenantCriado, fn: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenant.id, fn);

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    conexao = await banco.conectarComoApp();
  });

  it('texto cifrado antes da troca decifra depois; o novo usa a versão nova; o índice não muda', async () => {
    const tenant = await criarTenant(conexao);
    const cifra = app.get(CifraDeCampos);
    const antigo = await como(tenant, () => cifra.cifrar('ficha.cpf', '12345678909'));
    const hashAntes = await como(tenant, () => cifra.indiceCego('cpf', '123.456.789-09'));
    expect(antigo.startsWith('g1.1.')).toBe(true);

    const versao = await app.get(ChavesDoTenant).rotacionar(tenant.id);

    expect(versao).toBe(2);
    const { novo, depois, hashDepois } = await como(tenant, async () => ({
      novo: await cifra.cifrar('ficha.cpf', '12345678909'),
      depois: await cifra.decifrar('ficha.cpf', antigo),
      hashDepois: await cifra.indiceCego('cpf', '123.456.789-09'),
    }));
    expect(novo.startsWith('g1.2.')).toBe(true);
    expect(depois).toBe('12345678909');
    expect(hashDepois).toBe(hashAntes);
  });

  it('recifrar passa para a versão ativa e devolve o mesmo texto se já está nela', async () => {
    const tenant = await criarTenant(conexao);
    const cifra = app.get(CifraDeCampos);
    const antigo = await como(tenant, () => cifra.cifrar('ficha.saude', 'asma'));
    await app.get(ChavesDoTenant).rotacionar(tenant.id);

    const { recifrado, denovo, texto } = await como(tenant, async () => {
      const recifrado = await cifra.recifrar('ficha.saude', antigo);
      return {
        recifrado,
        denovo: await cifra.recifrar('ficha.saude', recifrado),
        texto: await cifra.decifrar('ficha.saude', recifrado),
      };
    });

    expect(recifrado.startsWith('g1.2.')).toBe(true);
    expect(recifrado).not.toBe(antigo);
    expect(denovo).toBe(recifrado);
    expect(texto).toBe('asma');
  });

  it('rotacionar várias vezes incrementa a versão e todas continuam decifrando', async () => {
    const tenant = await criarTenant(conexao);
    const cifra = app.get(CifraDeCampos);
    const chaves = app.get(ChavesDoTenant);
    const v1 = await como(tenant, () => cifra.cifrar('a.b', 'um'));
    expect(await chaves.rotacionar(tenant.id)).toBe(2);
    const v2 = await como(tenant, () => cifra.cifrar('a.b', 'dois'));
    expect(await chaves.rotacionar(tenant.id)).toBe(3);

    await como(tenant, async () => {
      expect(await cifra.decifrar('a.b', v1)).toBe('um');
      expect(await cifra.decifrar('a.b', v2)).toBe('dois');
    });
  });

  it('versão inexistente → CifraInvalidaError na cifra e VersaoDeChaveDesconhecidaError nas chaves', async () => {
    const tenant = await criarTenant(conexao);
    const cifra = app.get(CifraDeCampos);
    const cifrado = await como(tenant, () => cifra.cifrar('ficha.cpf', 'x'));
    const [, , iv, tag, dados] = cifrado.split('.');

    await expect(
      como(tenant, () => cifra.decifrar('ficha.cpf', `g1.99.${iv}.${tag}.${dados}`)),
    ).rejects.toThrow(CifraInvalidaError);
    await expect(app.get(ChavesDoTenant).daVersao(tenant.id, 99)).rejects.toThrow(
      VersaoDeChaveDesconhecidaError,
    );
  });

  it('duas aplicações criando a primeira chave ao mesmo tempo geram uma só linha e a mesma chave', async () => {
    const tenant = await criarTenant(conexao);
    const outroApp = await criarAppDeTeste(banco);

    const [a, b] = await Promise.all([
      app.get(ChavesDoTenant).ativa(tenant.id),
      outroApp.get(ChavesDoTenant).ativa(tenant.id),
    ]);

    const { rows } = await comTenant(conexao, tenant.id, (sql) =>
      sql.query<{ versao: number }>('SELECT versao FROM chave_do_tenant'),
    );
    expect(rows).toEqual([{ versao: 1 }]);
    expect(a.versao).toBe(1);
    expect(a.dados.equals(b.dados)).toBe(true);
    expect(a.indice.equals(b.indice)).toBe(true);

    // O texto de uma aplicação decifra na outra.
    const cifrado = await outroApp
      .get(ExecutorDeTenant)
      .runAsTenant(tenant.id, () => outroApp.get(CifraDeCampos).cifrar('ficha.cpf', 'segredo'));
    await expect(
      como(tenant, () => app.get(CifraDeCampos).decifrar('ficha.cpf', cifrado)),
    ).resolves.toBe('segredo');
  });

  it('outra aplicação abre a chave pelo banco ao decifrar (cache frio)', async () => {
    const tenant = await criarTenant(conexao);
    const cifrado = await como(tenant, () => app.get(CifraDeCampos).cifrar('ficha.cpf', 'frio'));
    const outroApp = await criarAppDeTeste(banco);

    await expect(
      outroApp
        .get(ExecutorDeTenant)
        .runAsTenant(tenant.id, () => outroApp.get(CifraDeCampos).decifrar('ficha.cpf', cifrado)),
    ).resolves.toBe('frio');
  });

  it('chave envelopada por outra chave mestra: o erro do provedor sobe, sem virar CifraInvalidaError', async () => {
    const tenant = await criarTenant(conexao);
    const cifrado = await como(tenant, () => app.get(CifraDeCampos).cifrar('ficha.cpf', 'x'));
    const migrador = await banco.conectarComoMigrador();
    await comTenant(migrador, tenant.id, (sql) =>
      sql.query("UPDATE chave_do_tenant SET id_da_chave_mestra = 'local:0000000000000000'"),
    );
    const outroApp = await criarAppDeTeste(banco);

    await expect(
      outroApp
        .get(ExecutorDeTenant)
        .runAsTenant(tenant.id, () => outroApp.get(CifraDeCampos).decifrar('ficha.cpf', cifrado)),
    ).rejects.toThrow(ChaveMestraDesconhecidaError);
  });

  it('muitas chamadas simultâneas à primeira chave de um tenant também geram uma linha', async () => {
    const tenant = await criarTenant(conexao);
    const apps = [app, await criarAppDeTeste(banco), await criarAppDeTeste(banco)];

    await Promise.all(apps.flatMap((a) => [a.get(ChavesDoTenant).ativa(tenant.id)]));

    const { rows } = await comTenant(conexao, tenant.id, (sql) =>
      sql.query('SELECT 1 FROM chave_do_tenant'),
    );
    expect(rows).toHaveLength(1);
  });
});
