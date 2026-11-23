import { Inject, Injectable } from '@nestjs/common';
import { argon2, createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import {
  CifraDeSenha,
  EmissorDeTokens,
  GeradorDeSegredos,
  type ReivindicacoesDoAcesso,
} from '../application/portas';
import { DURACAO_DO_ACESSO_MS, type Publico } from '../domain/credenciais';
import { CONFIGURACAO_DA_AUTENTICACAO, type ConfiguracaoDaAutenticacao } from './configuracao';

const argon2Async = promisify(argon2);

// Parâmetros mínimos da OWASP para argon2id: 19 MiB, 2 passadas, paralelismo 1.
const ARGON2 = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 } as const;
const FORMATO_PHC =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

const semPreenchimento = (buffer: Buffer) => buffer.toString('base64').replace(/=+$/, '');

/** argon2id do próprio Node, no formato PHC (`$argon2id$v=19$m=...,t=...,p=...$sal$hash`). */
@Injectable()
export class CifraDeSenhaArgon2 extends CifraDeSenha {
  async cifrar(senha: string): Promise<string> {
    const nonce = randomBytes(16);
    const hash = await argon2Async('argon2id', { message: senha, nonce, ...ARGON2 });
    const { memory, passes, parallelism } = ARGON2;
    return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${semPreenchimento(nonce)}$${semPreenchimento(hash)}`;
  }

  async conferir(senha: string, hash: string): Promise<boolean> {
    const partes = FORMATO_PHC.exec(hash);
    if (!partes) {
      return false;
    }
    const [, memoria, passadas, paralelismo, sal, esperado] = partes;
    const esperadoBytes = Buffer.from(esperado ?? '', 'base64');
    const calculado = await argon2Async('argon2id', {
      message: senha,
      nonce: Buffer.from(sal ?? '', 'base64'),
      memory: Number(memoria),
      passes: Number(passadas),
      parallelism: Number(paralelismo),
      tagLength: esperadoBytes.length,
    });
    return timingSafeEqual(calculado, esperadoBytes);
  }
}

// Sem 0/O e 1/I/L: o código é digitado pelo aluno a partir do que a recepção mostra.
const ALFABETO_DO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

@Injectable()
export class GeradorDeSegredosCripto extends GeradorDeSegredos {
  token(): string {
    return randomBytes(32).toString('base64url');
  }

  codigo(): string {
    return Array.from(
      { length: 8 },
      () => ALFABETO_DO_CODIGO[randomInt(ALFABETO_DO_CODIGO.length)],
    ).join('');
  }

  hash(segredo: string): string {
    return createHash('sha256').update(segredo).digest('hex');
  }
}

const EMISSOR = 'gymos';

/** JWT HS256 de 10 minutos; o instante vem do Relogio, não do relógio do processo. */
@Injectable()
export class EmissorDeTokensJwt extends EmissorDeTokens {
  constructor(
    @Inject(CONFIGURACAO_DA_AUTENTICACAO) private readonly config: ConfiguracaoDaAutenticacao,
  ) {
    super();
  }

  emitir({ publico, sujeitoId, tenantId }: ReivindicacoesDoAcesso, agora: Date): string {
    const iat = Math.floor(agora.getTime() / 1000);
    return jwt.sign(
      { sub: sujeitoId, aud: publico, tid: tenantId, iat, exp: iat + DURACAO_DO_ACESSO_MS / 1000 },
      this.config.segredoDoJwt,
      { algorithm: 'HS256', issuer: EMISSOR },
    );
  }

  verificar(token: string, agora: Date): ReivindicacoesDoAcesso | null {
    try {
      const conteudo = jwt.verify(token, this.config.segredoDoJwt, {
        algorithms: ['HS256'],
        issuer: EMISSOR,
        clockTimestamp: Math.floor(agora.getTime() / 1000),
      });
      if (typeof conteudo === 'string') {
        return null;
      }
      const { sub, aud, tid } = conteudo as { sub?: unknown; aud?: unknown; tid?: unknown };
      const publico = aud === 'staff' || aud === 'aluno' ? (aud as Publico) : null;
      return typeof sub === 'string' && typeof tid === 'string' && publico
        ? { publico, sujeitoId: sub, tenantId: tid }
        : null;
    } catch {
      return null;
    }
  }
}
