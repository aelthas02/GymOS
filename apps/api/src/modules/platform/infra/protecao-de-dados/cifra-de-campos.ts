import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import {
  type CampoProtegido,
  CifraDeCampos,
  type DadosProtegidos,
  type DefinicaoDeCampos,
  type LeituraDoTitular,
  RegistroDeAcessoSensivel,
} from '../../application/protecao-de-dados';
import { normalizarParaIndice, type TipoDeIndice } from '../../domain/indice-cego';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { ChavesDoTenant, VersaoDeChaveDesconhecidaError } from './chaves-do-tenant';

const ALGORITMO = 'aes-256-gcm';
const PREFIXO = 'g1';
const FORMATO = /^g1\.(\d+)\.([\w-]+)\.([\w-]+)\.([\w-]*)$/;

export class CifraInvalidaError extends Error {
  constructor(campo: string) {
    super(`O valor de ${campo} não decifra com as chaves deste tenant (adulterado ou de outro).`);
    this.name = 'CifraInvalidaError';
  }
}

export class ValorSemIndiceError extends Error {
  constructor(tipo: TipoDeIndice) {
    super(`O valor de ${tipo} fica vazio depois de normalizado: não há índice cego possível.`);
    this.name = 'ValorSemIndiceError';
  }
}

/**
 * Texto cifrado `g1.<versão>.<iv>.<tag>.<dados>` (base64url). O dado autenticado é
 * `<tenant>|<entidade>.<campo>`: trocar o valor de campo ou de tenant falha na decifra.
 */
@Injectable()
export class CifraDeCamposAesGcm extends CifraDeCampos {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly chaves: ChavesDoTenant,
    private readonly acessos: RegistroDeAcessoSensivel,
  ) {
    super();
  }

  async cifrar(campo: string, valor: string): Promise<string> {
    const tenantId = this.contexto.tenant().id;
    const { versao, dados } = await this.chaves.ativa(tenantId);
    const iv = randomBytes(12);
    const cifra = createCipheriv(ALGORITMO, dados, iv);
    cifra.setAAD(Buffer.from(`${tenantId}|${campo}`));
    const cifrado = Buffer.concat([cifra.update(valor, 'utf8'), cifra.final()]);
    const partes = [iv, cifra.getAuthTag(), cifrado].map((parte) => parte.toString('base64url'));
    return [PREFIXO, versao, ...partes].join('.');
  }

  async decifrar(campo: string, cifrado: string): Promise<string> {
    const tenantId = this.contexto.tenant().id;
    const [, versao, iv, tag, dados] = FORMATO.exec(cifrado) ?? [];
    if (!versao || !iv || !tag || dados === undefined) {
      throw new CifraInvalidaError(campo);
    }
    const chaves = await this.chaves.daVersao(tenantId, Number(versao)).catch((error: unknown) => {
      throw error instanceof VersaoDeChaveDesconhecidaError ? new CifraInvalidaError(campo) : error;
    });
    try {
      const decifra = createDecipheriv(ALGORITMO, chaves.dados, Buffer.from(iv, 'base64url'), {
        authTagLength: 16,
      });
      decifra.setAAD(Buffer.from(`${tenantId}|${campo}`));
      decifra.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decifra.update(Buffer.from(dados, 'base64url')),
        decifra.final(),
      ]).toString('utf8');
    } catch {
      // Tag, iv ou texto adulterados, ou chave de outro tenant: o GCM recusa a autenticação.
      throw new CifraInvalidaError(campo);
    }
  }

  async indiceCego(tipo: TipoDeIndice, valor: string): Promise<string> {
    const normalizado = normalizarParaIndice(tipo, valor);
    if (normalizado === '') {
      throw new ValorSemIndiceError(tipo);
    }
    const { indice } = await this.chaves.ativa(this.contexto.tenant().id);
    return createHmac('sha256', indice).update(`${tipo}:${normalizado}`).digest('hex');
  }

  async recifrar(campo: string, cifrado: string): Promise<string> {
    const { versao } = await this.chaves.ativa(this.contexto.tenant().id);
    if (cifrado.startsWith(`${PREFIXO}.${versao}.`)) {
      return cifrado;
    }
    return this.cifrar(campo, await this.decifrar(campo, cifrado));
  }

  async proteger<C extends Record<string, CampoProtegido>, T extends object>(
    definicao: DefinicaoDeCampos<C>,
    dados: T,
  ): Promise<DadosProtegidos<T, C>> {
    const saida = { ...dados } as Record<string, unknown>;
    for (const [campo, marcacao] of Object.entries(definicao.campos)) {
      if (!(campo in saida)) {
        continue;
      }
      const valor = saida[campo];
      if (typeof valor === 'string') {
        saida[campo] = await this.cifrar(`${definicao.entidade}.${campo}`, valor);
      }
      if (marcacao.indice) {
        saida[`${campo}Hash`] =
          typeof valor === 'string' ? await this.indiceCego(marcacao.indice, valor) : null;
      }
    }
    return saida as DadosProtegidos<T, C>;
  }

  async revelar<C extends Record<string, CampoProtegido>, T extends object>(
    definicao: DefinicaoDeCampos<C>,
    linha: T,
    leitura: LeituraDoTitular,
  ): Promise<T> {
    const saida = { ...linha } as Record<string, unknown>;
    const sensiveis: string[] = [];
    for (const [campo, marcacao] of Object.entries(definicao.campos)) {
      const valor = saida[campo];
      if (typeof valor !== 'string') {
        continue;
      }
      const nome = `${definicao.entidade}.${campo}`;
      saida[campo] = await this.decifrar(nome, valor);
      if (marcacao.sensivel) {
        sensiveis.push(nome);
      }
    }
    if (sensiveis.length > 0) {
      await this.acessos.registrar({ ...leitura, campos: sensiveis });
    }
    return saida as T;
  }
}
