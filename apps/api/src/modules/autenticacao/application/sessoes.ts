import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Relogio } from '../../platform/domain/relogio';
import {
  avaliarRefresh,
  DURACAO_DO_ACESSO_MS,
  DURACAO_DO_REFRESH_MS,
  emMs,
  type Publico,
} from '../domain/credenciais';
import { podeEntrarNoPainel } from '../domain/tipos-de-acesso';
import {
  EmissorDeTokens,
  GeradorDeSegredos,
  RepositorioDeCredenciaisDeAluno,
  RepositorioDeRefresh,
  RepositorioDeUsuarios,
} from './portas';

export interface SessaoAberta {
  accessToken: string;
  expiraEm: Date;
  refresh: string;
  refreshExpiraEm: Date;
}

export type ResultadoDaRenovacao = { tipo: 'ok'; sessao: SessaoAberta } | { tipo: 'recusado' };

/**
 * Token de acesso curto e refresh rotativo por família (ADR-006). Todo método roda na transação do
 * tenant da requisição; quem chama não pode lançar depois de uma revogação, senão ela é desfeita.
 */
@Injectable()
export class Sessoes {
  constructor(
    private readonly refresh: RepositorioDeRefresh,
    private readonly segredos: GeradorDeSegredos,
    private readonly emissor: EmissorDeTokens,
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly credenciais: RepositorioDeCredenciaisDeAluno,
    private readonly relogio: Relogio,
  ) {}

  async abrir(
    publico: Publico,
    sujeitoId: string,
    tenantId: string,
    familiaId: string = randomUUID(),
  ): Promise<SessaoAberta> {
    const agora = this.relogio.agora();
    const refresh = this.segredos.token();
    const refreshExpiraEm = emMs(agora, DURACAO_DO_REFRESH_MS[publico]);
    await this.refresh.criar({
      familiaId,
      publico,
      sujeitoId,
      tokenHash: this.segredos.hash(refresh),
      expiraEm: refreshExpiraEm,
    });
    return {
      accessToken: this.emissor.emitir({ publico, sujeitoId, tenantId }, agora),
      expiraEm: emMs(agora, DURACAO_DO_ACESSO_MS),
      refresh,
      refreshExpiraEm,
    };
  }

  async renovar(publico: Publico, tenantId: string, token: string): Promise<ResultadoDaRenovacao> {
    const agora = this.relogio.agora();
    const atual = await this.refresh.porTokenHash(this.segredos.hash(token));
    if (!atual || atual.publico !== publico) {
      return { tipo: 'recusado' };
    }
    const uso = avaliarRefresh(atual, agora);
    if (uso === 'expirado') {
      return { tipo: 'recusado' };
    }
    if (uso === 'reuso' || !(await this.refresh.marcarUsado(atual.id, agora))) {
      await this.refresh.revogarFamilia(atual.familiaId, agora);
      return { tipo: 'recusado' };
    }
    if (!(await this.sujeitoAtivo(publico, atual.sujeitoId))) {
      await this.refresh.revogarFamilia(atual.familiaId, agora);
      return { tipo: 'recusado' };
    }
    return {
      tipo: 'ok',
      sessao: await this.abrir(publico, atual.sujeitoId, tenantId, atual.familiaId),
    };
  }

  async encerrar(publico: Publico, token: string): Promise<void> {
    const atual = await this.refresh.porTokenHash(this.segredos.hash(token));
    if (atual?.publico === publico) {
      await this.refresh.revogarFamilia(atual.familiaId, this.relogio.agora());
    }
  }

  /** Usuário desativado ou passado para "Sem acesso" não renova a sessão. */
  private async sujeitoAtivo(publico: Publico, sujeitoId: string): Promise<boolean> {
    if (publico === 'aluno') {
      return (await this.credenciais.porAluno(sujeitoId)) !== null;
    }
    const usuario = await this.usuarios.porId(sujeitoId);
    return usuario !== null && usuario.ativo && podeEntrarNoPainel(usuario.tipoDeAcesso);
  }
}
