import jwt from 'jsonwebtoken';
import type { ConfiguracaoDaAutenticacao } from './configuracao';
import { CifraDeSenhaArgon2, EmissorDeTokensJwt, GeradorDeSegredosCripto } from './seguranca';

describe('CifraDeSenhaArgon2', () => {
  const cifra = new CifraDeSenhaArgon2();

  it('gera argon2id no formato PHC com sal novo a cada vez e confere a senha', async () => {
    const hash = await cifra.cifrar('senha-forte-123');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await cifra.cifrar('senha-forte-123')).not.toBe(hash);
    expect(await cifra.conferir('senha-forte-123', hash)).toBe(true);
    expect(await cifra.conferir('senha-forte-124', hash)).toBe(false);
  });

  it('hash em outro formato nunca confere', async () => {
    expect(await cifra.conferir('x', '$2b$10$abcdefghijklmnopqrstuv')).toBe(false);
    expect(await cifra.conferir('x', '')).toBe(false);
  });
});

describe('GeradorDeSegredosCripto', () => {
  const gerador = new GeradorDeSegredosCripto();

  it('token de 256 bits, código de 8 caracteres sem ambíguos e hash sha-256', () => {
    expect(gerador.token()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(gerador.token()).not.toBe(gerador.token());
    expect(gerador.codigo()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(gerador.hash('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('EmissorDeTokensJwt', () => {
  const config = { segredoDoJwt: 's'.repeat(32) } as ConfiguracaoDaAutenticacao;
  const emissor = new EmissorDeTokensJwt(config);
  const agora = new Date('2026-11-23T12:00:00Z');
  const sessao = { publico: 'staff', sujeitoId: 'u1', tenantId: 't1' } as const;
  const emMinutos = (minutos: number) => new Date(agora.getTime() + minutos * 60_000);

  it('vale por 10 minutos pelo relógio informado', () => {
    const token = emissor.emitir(sessao, agora);
    expect(emissor.verificar(token, emMinutos(9))).toEqual(sessao);
    expect(emissor.verificar(token, emMinutos(10))).toBeNull();
  });

  it('recusa token de outro segredo, adulterado, sem HS256 ou com público desconhecido', () => {
    const outro = new EmissorDeTokensJwt({
      segredoDoJwt: 'o'.repeat(32),
    } as ConfiguracaoDaAutenticacao);
    expect(emissor.verificar(outro.emitir(sessao, agora), agora)).toBeNull();

    const token = emissor.emitir(sessao, agora);
    expect(emissor.verificar(`${token}x`, agora)).toBeNull();

    const iat = Math.floor(agora.getTime() / 1000);
    const semAssinatura = jwt.sign({ sub: 'u1', aud: 'staff', tid: 't1', iat, exp: iat + 60 }, '', {
      algorithm: 'none',
      issuer: 'gymos',
    });
    expect(emissor.verificar(semAssinatura, agora)).toBeNull();

    const publicoEstranho = jwt.sign(
      { sub: 'u1', aud: 'admin', tid: 't1', iat, exp: iat + 60 },
      config.segredoDoJwt,
      { algorithm: 'HS256', issuer: 'gymos' },
    );
    expect(emissor.verificar(publicoEstranho, agora)).toBeNull();

    const semTenant = jwt.sign(
      { sub: 'u1', aud: 'staff', iat, exp: iat + 60 },
      config.segredoDoJwt,
      {
        algorithm: 'HS256',
        issuer: 'gymos',
      },
    );
    expect(emissor.verificar(semTenant, agora)).toBeNull();
  });
});
