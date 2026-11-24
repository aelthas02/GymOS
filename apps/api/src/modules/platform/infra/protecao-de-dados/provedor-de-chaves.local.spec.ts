import { randomBytes } from 'node:crypto';
import { ChaveMestraDesconhecidaError, ProvedorDeChavesLocal } from './provedor-de-chaves.local';

const mestra = (byte: number) => Buffer.alloc(32, byte).toString('base64');

describe('ProvedorDeChavesLocal', () => {
  it('envelopa e desenvelopa a chave', async () => {
    const provedor = new ProvedorDeChavesLocal(mestra(1));
    const chave = randomBytes(32);

    const { envelope, idDaChaveMestra } = await provedor.envelopar(chave);

    expect(idDaChaveMestra).toBe(provedor.idDaChaveMestra);
    expect(envelope).not.toContain(chave.toString('base64url'));
    expect((await provedor.desenvelopar(envelope, idDaChaveMestra)).equals(chave)).toBe(true);
  });

  it('o id não revela a chave mestra e muda com ela', () => {
    const a = new ProvedorDeChavesLocal(mestra(1));
    const b = new ProvedorDeChavesLocal(mestra(2));

    expect(a.idDaChaveMestra).toMatch(/^local:[0-9a-f]{16}$/);
    expect(a.idDaChaveMestra).not.toBe(b.idDaChaveMestra);
  });

  it.each([0, 1, 2])('envelope adulterado na parte %i falha', async (indice) => {
    const provedor = new ProvedorDeChavesLocal(mestra(1));
    const { envelope, idDaChaveMestra } = await provedor.envelopar(randomBytes(32));
    const partes = envelope.split('.');
    const bytes = Buffer.from(partes[indice] ?? '', 'base64url');
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    partes[indice] = bytes.toString('base64url');

    await expect(provedor.desenvelopar(partes.join('.'), idDaChaveMestra)).rejects.toThrow();
  });

  it('envelope malformado falha', async () => {
    const provedor = new ProvedorDeChavesLocal(mestra(1));

    await expect(provedor.desenvelopar('', provedor.idDaChaveMestra)).rejects.toThrow();
  });

  it('id de outra chave mestra → ChaveMestraDesconhecidaError', async () => {
    const provedor = new ProvedorDeChavesLocal(mestra(1));
    const { envelope } = await provedor.envelopar(randomBytes(32));

    await expect(provedor.desenvelopar(envelope, 'local:0000000000000000')).rejects.toThrow(
      ChaveMestraDesconhecidaError,
    );
  });

  it('envelope feito por outra chave mestra não abre, mesmo com o id forjado', async () => {
    const a = new ProvedorDeChavesLocal(mestra(1));
    const b = new ProvedorDeChavesLocal(mestra(2));
    const { envelope } = await a.envelopar(randomBytes(32));

    await expect(b.desenvelopar(envelope, b.idDaChaveMestra)).rejects.toThrow();
    await expect(b.desenvelopar(envelope, a.idDaChaveMestra)).rejects.toThrow(
      ChaveMestraDesconhecidaError,
    );
  });
});
