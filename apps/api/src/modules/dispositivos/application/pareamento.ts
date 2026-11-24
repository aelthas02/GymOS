import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Relogio } from '../../platform/domain/relogio';
import { type Executor, AutoriaDoAcesso } from '../../acesso/application/autoria';
import {
  VALIDADE_DO_CODIGO_MS,
  codigoFormatado,
  estaOnline,
  gerarCodigoDePareamento,
  gerarCredencial,
  lerCredencial,
  normalizarCodigo,
  segredoConfere,
} from '../domain/dispositivo';
import {
  CodigoDePareamentoInvalidoError,
  CredencialDoAgenteInvalidaError,
  NaoEncontradoError,
} from './erros';
import { type AgenteDaCatraca, RepositorioDeAgentes, RepositorioDeCodigos } from './portas';

const TENTATIVAS_DE_SORTEIO = 5;

export interface CodigoGerado {
  codigo: string;
  codigoFormatado: string;
  expiraEm: Date;
}

export interface AgenteParaListagem {
  agente: AgenteDaCatraca;
  online: boolean;
}

/**
 * Pareamento do agente local (T23b, ADR-016). O painel gera um código de 6 caracteres que vale 30 min
 * e uma troca; o agente o troca por uma credencial própria, rotacionável e revogável. O servidor
 * guarda só o hash do segredo da credencial.
 */
@Injectable()
export class Pareamento {
  constructor(
    private readonly agentes: RepositorioDeAgentes,
    private readonly codigos: RepositorioDeCodigos,
    private readonly autoria: AutoriaDoAcesso,
    private readonly relogio: Relogio,
  ) {}

  /** Passo 4 e Configurações: um código novo; o anterior, se ainda não usado, deixa de valer. */
  async gerarCodigo(executor: Executor): Promise<CodigoGerado> {
    const agora = this.relogio.agora();
    const expiraEm = new Date(agora.getTime() + VALIDADE_DO_CODIGO_MS);
    for (let tentativa = 0; tentativa < TENTATIVAS_DE_SORTEIO; tentativa++) {
      const codigo = gerarCodigoDePareamento();
      if (await this.codigos.criar(codigo, expiraEm, executor.usuarioId, agora)) {
        await this.autoria.registrar(executor, {
          acao: 'gerou-codigo-de-pareamento',
          detalhe: 'Código de pareamento do agente da catraca (vale 30 minutos)',
        });
        return { codigo, codigoFormatado: codigoFormatado(codigo), expiraEm };
      }
    }
    throw new Error('Não foi possível sortear um código de pareamento livre.');
  }

  /** O agente troca o código pela credencial. Código errado, vencido ou usado não grava nada. */
  async trocarCodigo(
    texto: string,
    dados: { nome?: string | null; versao?: string | null },
  ): Promise<{ agenteId: string; credencial: string }> {
    const agora = this.relogio.agora();
    const codigo = normalizarCodigo(texto);
    const agenteId = randomUUID();
    if (!codigo || !(await this.codigos.consumir(codigo, agenteId, agora))) {
      throw new CodigoDePareamentoInvalidoError();
    }
    const { credencial, hash } = gerarCredencial(agenteId);
    await this.agentes.criar(
      agenteId,
      {
        nome: dados.nome?.trim() || 'Agente da catraca',
        credencialHash: hash,
        versaoDoAgente: dados.versao ?? null,
      },
      agora,
    );
    return { agenteId, credencial };
  }

  /** Confere a credencial apresentada; revogada ou desconhecida é recusada. */
  async autenticar(credencial: string): Promise<AgenteDaCatraca> {
    const lida = lerCredencial(credencial);
    const agente = lida ? await this.agentes.porId(lida.agenteId) : null;
    if (
      !lida ||
      !agente ||
      agente.revogadoEm ||
      !segredoConfere(lida.segredo, agente.credencialHash)
    ) {
      throw new CredencialDoAgenteInvalidaError();
    }
    return agente;
  }

  /** O agente pede uma credencial nova; a antiga deixa de valer na hora. */
  async rotacionar(agente: AgenteDaCatraca): Promise<{ credencial: string }> {
    const { credencial, hash } = gerarCredencial(agente.id);
    await this.agentes.trocarCredencial(agente.id, hash, this.relogio.agora());
    return { credencial };
  }

  async revogar(executor: Executor, agenteId: string): Promise<void> {
    const agente = await this.agentes.porId(agenteId);
    if (!agente) {
      throw new NaoEncontradoError('Agente');
    }
    if (!agente.revogadoEm) {
      await this.agentes.revogar(agenteId, this.relogio.agora());
      await this.autoria.registrar(executor, {
        acao: 'revogou-agente-da-catraca',
        detalhe: `Agente "${agente.nome}" revogado: não envia mais acessos`,
      });
    }
  }

  async listar(): Promise<AgenteParaListagem[]> {
    const agora = this.relogio.agora();
    return (await this.agentes.listar()).map((agente) => ({
      agente,
      online: !agente.revogadoEm && estaOnline(agente.ultimoBatimentoEm, agora),
    }));
  }

  async obter(agenteId: string): Promise<AgenteDaCatraca> {
    const agente = await this.agentes.porId(agenteId);
    if (!agente) {
      throw new NaoEncontradoError('Agente');
    }
    return agente;
  }
}
