import type { INestApplication } from '@nestjs/common';
import type { Client } from 'pg';
import { CifraDeCampos, definirCamposProtegidos } from '../../application/protecao-de-dados';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { comTenant, criarTenant, type TenantCriado } from '../../testing/fabricas';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { ChavesDoTenant } from './chaves-do-tenant';
import { CifraInvalidaError, ValorSemIndiceError } from './cifra-de-campos';

const FICHA = definirCamposProtegidos('ficha', {
  cpf: { indice: 'cpf' },
  email: { indice: 'email' },
  saude: { sensivel: true },
});

/** Muda 1 bit do primeiro byte da parte `indice` do texto `g1.<versão>.<iv>.<tag>.<dados>`. */
function adulterar(cifrado: string, indice: number): string {
  const partes = cifrado.split('.');
  const bytes = Buffer.from(partes[indice] ?? '', 'base64url');
  bytes[0] = (bytes[0] ?? 0) ^ 1;
  partes[indice] = bytes.toString('base64url');
  return partes.join('.');
}

describe('isolamento entre tenants e adulteração do texto cifrado', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;
  let a: TenantCriado;
  let b: TenantCriado;

  const como = <T>(tenant: TenantCriado, fn: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenant.id, fn);
  const cifra = () => app.get(CifraDeCampos);

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao);
    b = await criarTenant(conexao);
  });

  describe('isolamento', () => {
    it('o mesmo CPF gera hash diferente em tenants diferentes (e estável dentro do tenant)', async () => {
      const hashA = await como(a, () => cifra().indiceCego('cpf', '123.456.789-09'));
      const hashB = await como(b, () => cifra().indiceCego('cpf', '123.456.789-09'));
      const hashA2 = await como(a, () => cifra().indiceCego('cpf', '12345678909'));

      expect(hashA).toMatch(/^[0-9a-f]{64}$/);
      expect(hashA).not.toBe(hashB);
      expect(hashA2).toBe(hashA);
    });

    it('o tipo entra no hash: o mesmo dígito como cpf e como telefone diferem', async () => {
      const [cpf, telefone] = await como(a, async () => [
        await cifra().indiceCego('cpf', '11987654321'),
        await cifra().indiceCego('telefone', '11987654321'),
      ]);

      expect(cpf).not.toBe(telefone);
    });

    it('texto de A não decifra em B, mesmo com B já tendo chave', async () => {
      await app.get(ChavesDoTenant).ativa(b.id);
      const cifrado = await como(a, () => cifra().cifrar('ficha.cpf', '12345678909'));

      await expect(como(b, () => cifra().decifrar('ficha.cpf', cifrado))).rejects.toThrow(
        CifraInvalidaError,
      );
      await expect(como(a, () => cifra().decifrar('ficha.cpf', cifrado))).resolves.toBe(
        '12345678909',
      );
    });

    it('RLS: chave_do_tenant e consentimento de outro tenant são invisíveis e não gravam', async () => {
      await como(a, () => cifra().cifrar('x.y', 'z'));
      await como(b, () => cifra().cifrar('x.y', 'z'));
      await comTenant(conexao, a.id, (sql) =>
        sql.query(
          `INSERT INTO consentimento (tenant_id, aluno_id, finalidade, decisao, origem, registrado_em)
           VALUES ($1, gen_random_uuid(), 'marketing', 'aceite', 'painel', now())`,
          [a.id],
        ),
      );

      const vistoPorB = await comTenant(conexao, b.id, async (sql) => ({
        chaves: (
          await sql.query<{ tenant_id: string }>('SELECT tenant_id FROM chave_do_tenant')
        ).rows.map((linha) => linha.tenant_id),
        chavesDeA: (await sql.query('SELECT 1 FROM chave_do_tenant WHERE tenant_id = $1', [a.id]))
          .rowCount,
        consentimentosDeA: (
          await sql.query('SELECT 1 FROM consentimento WHERE tenant_id = $1', [a.id])
        ).rowCount,
      }));
      expect(vistoPorB.chaves).toEqual([b.id]);
      expect(vistoPorB.chavesDeA).toBe(0);
      expect(vistoPorB.consentimentosDeA).toBe(0);

      const vistoPorA = await comTenant(conexao, a.id, (sql) =>
        sql.query('SELECT 1 FROM consentimento'),
      );
      expect(vistoPorA.rowCount).toBe(1);

      await expect(
        comTenant(conexao, b.id, (sql) =>
          sql.query(
            `INSERT INTO consentimento (tenant_id, aluno_id, finalidade, decisao, origem, registrado_em)
             VALUES ($1, gen_random_uuid(), 'marketing', 'aceite', 'painel', now())`,
            [a.id],
          ),
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it('sem tenant no contexto nada de chave_do_tenant é visível', async () => {
      const { rows } = await conexao.query('SELECT 1 FROM chave_do_tenant');

      expect(rows).toHaveLength(0);
    });
  });

  describe('adulteração', () => {
    let cifrado: string;

    beforeAll(async () => {
      cifrado = await como(a, () => cifra().cifrar('ficha.cpf', '12345678909'));
    });

    it.each([
      ['iv', 2],
      ['tag', 3],
      ['texto', 4],
    ])('alterar 1 bit do %s → CifraInvalidaError', async (_nome, indice) => {
      const adulterado = adulterar(cifrado, indice);

      expect(adulterado).not.toBe(cifrado);
      await expect(como(a, () => cifra().decifrar('ficha.cpf', adulterado))).rejects.toThrow(
        CifraInvalidaError,
      );
    });

    it('tag ou texto truncados ou vazios → CifraInvalidaError', async () => {
      const [prefixo, versao, iv, tag] = cifrado.split('.');

      await expect(
        como(a, () => cifra().decifrar('ficha.cpf', `${prefixo}.${versao}.${iv}.${tag}.`)),
      ).rejects.toThrow(CifraInvalidaError);
      await expect(
        como(a, () => cifra().decifrar('ficha.cpf', `${prefixo}.${versao}.${iv}.AAAA.AAAA`)),
      ).rejects.toThrow(CifraInvalidaError);
    });

    it('trocar a versão por outra existente (chave diferente) → CifraInvalidaError', async () => {
      const v2 = await app.get(ChavesDoTenant).rotacionar(a.id);
      const trocado = cifrado.replace(/^g1\.1\./, `g1.${v2}.`);

      expect(trocado).not.toBe(cifrado);
      await expect(como(a, () => cifra().decifrar('ficha.cpf', trocado))).rejects.toThrow(
        CifraInvalidaError,
      );
    });

    it.each([
      [''],
      ['texto-solto'],
      ['g2.1.aaaa.bbbb.cccc'],
      ['g1.x.aaaa.bbbb.cccc'],
      ['g1.1.aaaa.bbbb'],
      ['g1.1.aaaa.bbbb.cccc.dddd'],
      ['g1.1..bbbb.cccc'],
      ['g1.1.aa aa.bbbb.cccc'],
    ])('formato inválido %j → CifraInvalidaError', async (invalido) => {
      await expect(como(a, () => cifra().decifrar('ficha.cpf', invalido))).rejects.toThrow(
        CifraInvalidaError,
      );
    });

    it('texto cifrado de outro campo (AAD entidade.campo) → CifraInvalidaError', async () => {
      await expect(como(a, () => cifra().decifrar('ficha.saude', cifrado))).rejects.toThrow(
        CifraInvalidaError,
      );
      await expect(como(a, () => cifra().decifrar('aluno.cpf', cifrado))).rejects.toThrow(
        CifraInvalidaError,
      );
    });

    it('revelar com valor de campo trocado na linha falha e não grava log de acesso', async () => {
      const dados = await como(a, async () => ({
        cpf: await cifra().cifrar('ficha.cpf', '1'),
        saude: await cifra().cifrar('ficha.saude', 'asma'),
      }));
      // O valor da saúde foi colocado no campo cpf.
      const linha = { cpf: dados.saude, saude: dados.saude };

      await expect(
        como(a, () => cifra().revelar(FICHA, linha, { titularId: 't', quem: 'u' })),
      ).rejects.toThrow(CifraInvalidaError);
    });
  });

  describe('normalização no índice', () => {
    it('e-mail "A@X.com " e "a@x.com" geram o mesmo hash', async () => {
      const [um, dois] = await como(a, async () => [
        await cifra().indiceCego('email', 'A@X.com '),
        await cifra().indiceCego('email', 'a@x.com'),
      ]);

      expect(um).toBe(dois);
    });

    it.each([
      ['cpf', '---'],
      ['cpf', ''],
      ['telefone', '(  ) -'],
      ['email', '   '],
    ] as const)('%s %j vazio depois de normalizado → ValorSemIndiceError', async (tipo, valor) => {
      await expect(como(a, () => cifra().indiceCego(tipo, valor))).rejects.toThrow(
        ValorSemIndiceError,
      );
    });

    it('proteger com CPF sem dígitos também lança ValorSemIndiceError', async () => {
      await expect(
        como(a, () => cifra().proteger(FICHA, { cpf: '---', saude: null })),
      ).rejects.toThrow(ValorSemIndiceError);
    });
  });

  describe('proteger e revelar com campos ausentes ou nulos', () => {
    it('campo ausente não é tocado e não cria o hash', async () => {
      const protegido = await como(a, () => cifra().proteger(FICHA, { saude: 'asma' }));

      expect(Object.keys(protegido).sort()).toEqual(['saude']);
      expect(protegido.saude).toMatch(/^g1\.\d+\./);
    });

    it('campo null continua null e o hash fica null', async () => {
      const protegido = await como(a, () =>
        cifra().proteger(FICHA, { cpf: null, email: null, saude: null }),
      );

      expect(protegido).toEqual({
        cpf: null,
        cpfHash: null,
        email: null,
        emailHash: null,
        saude: null,
      });
    });

    it('proteger não altera o objeto de entrada e gera o hash do e-mail normalizado', async () => {
      const entrada = { email: ' Ana@Gym.COM', outro: 1 };

      const protegido = await como(a, () => cifra().proteger(FICHA, entrada));

      expect(entrada).toEqual({ email: ' Ana@Gym.COM', outro: 1 });
      expect(protegido.outro).toBe(1);
      expect(protegido.emailHash).toBe(
        await como(a, () => cifra().indiceCego('email', 'ana@gym.com')),
      );
    });

    it('revelar com campo null devolve null e não grava log de acesso', async () => {
      const revelada = await como(a, () =>
        cifra().revelar(FICHA, { cpf: null, saude: null, id: 'x' }, { titularId: 't', quem: 'u' }),
      );

      expect(revelada).toEqual({ cpf: null, saude: null, id: 'x' });
      const { rows } = await comTenant(conexao, a.id, (sql) =>
        sql.query("SELECT 1 FROM acesso_a_dado_sensivel WHERE titular_id = 't'"),
      ).catch(() => ({ rows: [] }));
      expect(rows).toHaveLength(0);
    });
  });
});
