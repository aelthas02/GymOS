import { Injectable, Logger } from '@nestjs/common';
import { Relogio } from '../../platform/domain/relogio';
import { RegistroDeAtividade, type Executor } from '../../alunos/application/autoria';
import {
  ANTECEDENCIA_DA_RENOVACAO_MS,
  type CanalMeta,
  type ConexaoMeta,
  ConexaoInvalidaError,
  NOMES_DOS_CANAIS,
  conexaoVazia,
} from '../domain/meta';
import { AssinadorDoFluxo, ProvedorMeta, RepositorioDeConexoes } from './portas';

const VALIDADE_DO_STATE_MS = 15 * 60 * 1000;

export interface InicioDaConexao {
  conexao: ConexaoMeta;
  /** Endereço do fluxo oficial (OAuth ou cadastro do WhatsApp Business) para o usuário abrir. */
  urlDoFluxo: string;
}

/**
 * Único dono das contas da academia na Meta (T13d): conecta Instagram e Facebook por OAuth e o
 * WhatsApp Business pelo cadastro oficial, guarda o token cifrado e o renova. Não depende do módulo
 * Marketing: a Recepção e Configurações também usam o WhatsApp.
 */
@Injectable()
export class ConexoesMeta {
  private readonly logger = new Logger(ConexoesMeta.name);

  constructor(
    private readonly provedor: ProvedorMeta,
    private readonly repositorio: RepositorioDeConexoes,
    private readonly assinador: AssinadorDoFluxo,
    private readonly atividade: RegistroDeAtividade,
    private readonly relogio: Relogio,
  ) {}

  /** Um item por canal, na ordem do catálogo; canal nunca conectado vem desconectado. */
  async estados(): Promise<ConexaoMeta[]> {
    const gravadas = new Map((await this.repositorio.todas()).map((c) => [c.canal, c]));
    return (['instagram', 'facebook', 'whatsapp'] as const).map(
      (canal) => gravadas.get(canal) ?? conexaoVazia(canal),
    );
  }

  async estado(canal: CanalMeta): Promise<ConexaoMeta> {
    return (await this.repositorio.porCanal(canal)) ?? conexaoVazia(canal);
  }

  async whatsappConectado(): Promise<boolean> {
    return (await this.estado('whatsapp')).estado === 'conectado';
  }

  /**
   * Abre o fluxo oficial. O WhatsApp fica em "Verificação pendente" até o retorno do cadastro; o
   * Instagram e o Facebook só passam a "Conectado" no retorno (`concluirPeloRetorno`).
   */
  async iniciar(canal: CanalMeta, redirecionarPara: string): Promise<InicioDaConexao> {
    const agora = this.relogio.agora();
    const atual = await this.estado(canal);
    const state = this.assinador.assinar(canal, new Date(agora.getTime() + VALIDADE_DO_STATE_MS));
    const urlDoFluxo = this.provedor.urlDoFluxo(canal, state, redirecionarPara);
    if (canal !== 'whatsapp' || atual.estado === 'conectado') {
      return { conexao: atual, urlDoFluxo };
    }
    const conexao = await this.repositorio.salvar({
      canal,
      estado: 'verificacao_pendente',
      atualizadoEm: agora,
    });
    return { conexao, urlDoFluxo };
  }

  /** Retorno do fluxo oficial: troca o código pelo token. WhatsApp sem verificação segue pendente. */
  async concluirPeloRetorno(
    canal: CanalMeta,
    codigo: string,
    estado: string,
    executor: Executor,
  ): Promise<ConexaoMeta> {
    const agora = this.relogio.agora();
    if (!this.assinador.valido(estado, canal, agora)) {
      throw new ConexaoInvalidaError(
        'O retorno da Meta expirou ou não é desta academia. Tente de novo.',
      );
    }
    const conta = await this.provedor.trocarCodigo(canal, codigo, agora);
    const conectada = canal !== 'whatsapp' || conta.verificada;
    const conexao = await this.repositorio.salvar({
      canal,
      estado: conectada ? 'conectado' : 'verificacao_pendente',
      contaId: conta.contaId,
      contaNome: conta.contaNome,
      token: conta.token,
      expiraEm: conta.expiraEm,
      conectadoEm: conectada ? agora : null,
      atualizadoEm: agora,
    });
    if (conectada) {
      await this.atividade.registrar(executor, {
        acao: 'conectou-integracao',
        detalhe: `${NOMES_DOS_CANAIS[canal]}: ${conta.contaNome}`,
      });
    }
    return conexao;
  }

  /** "Concluir conexão" de Configurações: pergunta à Meta se a verificação do WhatsApp terminou. */
  async concluir(canal: CanalMeta, executor: Executor): Promise<ConexaoMeta> {
    const atual = await this.estado(canal);
    if (atual.estado !== 'verificacao_pendente') {
      return atual;
    }
    const token = await this.repositorio.token(canal);
    if (!token) {
      throw new ConexaoInvalidaError('O cadastro no fluxo oficial ainda não foi finalizado.');
    }
    if (!(await this.provedor.verificada(token))) {
      return atual;
    }
    const agora = this.relogio.agora();
    const conexao = await this.repositorio.salvar({
      canal,
      estado: 'conectado',
      conectadoEm: agora,
      atualizadoEm: agora,
    });
    await this.atividade.registrar(executor, {
      acao: 'conectou-integracao',
      detalhe: `${NOMES_DOS_CANAIS[canal]}: ${atual.contaNome ?? ''}`.trim(),
    });
    return conexao;
  }

  async desconectar(canal: CanalMeta, executor: Executor): Promise<ConexaoMeta> {
    const atual = await this.estado(canal);
    if (atual.estado === 'desconectado') {
      return atual;
    }
    const token = await this.repositorio.token(canal);
    if (token) {
      await this.provedor.revogar(token);
    }
    const conexao = await this.repositorio.salvar({
      canal,
      estado: 'desconectado',
      contaId: null,
      contaNome: null,
      token: null,
      expiraEm: null,
      conectadoEm: null,
      atualizadoEm: this.relogio.agora(),
    });
    await this.atividade.registrar(executor, {
      acao: 'desconectou-integracao',
      detalhe: NOMES_DOS_CANAIS[canal],
    });
    return conexao;
  }

  /**
   * Renova os tokens que vencem em até 7 dias. Token que a Meta recusa renovar marca a conexão como
   * "expirado": o usuário precisa conectar de novo. Devolve quantos foram renovados.
   */
  async renovarAVencer(): Promise<number> {
    const agora = this.relogio.agora();
    const limite = new Date(agora.getTime() + ANTECEDENCIA_DA_RENOVACAO_MS);
    let renovados = 0;
    for (const conexao of await this.repositorio.aVencer(limite)) {
      const token = await this.repositorio.token(conexao.canal);
      if (!token) {
        continue;
      }
      try {
        const novo = await this.provedor.renovar(token, agora);
        await this.repositorio.salvar({
          canal: conexao.canal,
          estado: 'conectado',
          token: novo.token,
          expiraEm: novo.expiraEm,
          atualizadoEm: agora,
        });
        renovados += 1;
      } catch (err) {
        this.logger.warn({ canal: conexao.canal, err }, 'Renovação do token da Meta recusada');
        await this.repositorio.salvar({
          canal: conexao.canal,
          estado: 'expirado',
          atualizadoEm: agora,
        });
      }
    }
    return renovados;
  }
}
