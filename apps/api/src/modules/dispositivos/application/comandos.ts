import { Injectable } from '@nestjs/common';
import { Relogio } from '../../platform/domain/relogio';
import { VALIDADE_DO_COMANDO_MS } from '../domain/dispositivo';
import { CadastrosBiometricos } from './biometria';
import { Dispositivos } from './dispositivos';
import { DispositivoInvalidoError, NaoEncontradoError } from './erros';
import {
  type AgenteDaCatraca,
  type ComandoDoAgente,
  RepositorioDeAgentes,
  RepositorioDeComandos,
  RepositorioDeDispositivos,
} from './portas';

export type ResultadoDoTeste =
  | { estado: 'aguardando' }
  | { estado: 'ok'; latenciaEmMs: number }
  | { estado: 'falhou'; motivo: string | null }
  | { estado: 'expirou' };

export interface RespostaDoAgente {
  ok: boolean;
  erro?: string | null;
  /** Referência do cadastro biométrico no equipamento (nunca o template). */
  referencia?: string | null;
}

/**
 * Comandos do servidor ao agente (T23b): o agente os busca no batimento e responde por
 * `POST /agente/comandos/:id/resposta`. "Testar conexão" é um `ping` e a tela consulta o resultado.
 */
@Injectable()
export class ComandosDoAgente {
  constructor(
    private readonly comandos: RepositorioDeComandos,
    private readonly agentes: RepositorioDeAgentes,
    private readonly dispositivos: RepositorioDeDispositivos,
    private readonly servicoDeDispositivos: Dispositivos,
    private readonly biometrias: CadastrosBiometricos,
    private readonly relogio: Relogio,
  ) {}

  /** Envia um ping ao agente (de um dispositivo ou direto, no Passo 4) e devolve o id para consultar. */
  async testarConexao(alvo: {
    agenteId?: string;
    dispositivoId?: string;
  }): Promise<{ comandoId: string }> {
    let agenteId = alvo.agenteId ?? null;
    if (alvo.dispositivoId) {
      const dispositivo = await this.dispositivos.porId(alvo.dispositivoId);
      if (!dispositivo) {
        throw new NaoEncontradoError('Dispositivo');
      }
      agenteId = dispositivo.agenteId;
      if (!agenteId) {
        throw new DispositivoInvalidoError(
          'O dispositivo ainda não está ligado a um agente pareado.',
        );
      }
    }
    const agente = agenteId ? await this.agentes.porId(agenteId) : null;
    if (!agente) {
      throw new NaoEncontradoError('Agente');
    }
    if (agente.revogadoEm) {
      throw new DispositivoInvalidoError('O agente foi revogado: pareie de novo.');
    }
    const agora = this.relogio.agora();
    const comando = await this.comandos.criar({
      agenteId: agente.id,
      dispositivoId: alvo.dispositivoId ?? null,
      tipo: 'ping',
      dados: {},
      expiraEm: new Date(agora.getTime() + VALIDADE_DO_COMANDO_MS),
    });
    return { comandoId: comando.id };
  }

  async resultadoDoTeste(comandoId: string): Promise<ResultadoDoTeste> {
    const comando = await this.comandos.porId(comandoId);
    if (comando?.tipo !== 'ping') {
      throw new NaoEncontradoError('Teste de conexão');
    }
    return this.resultado(comando);
  }

  private resultado(comando: ComandoDoAgente): ResultadoDoTeste {
    switch (comando.status) {
      case 'concluido':
        return {
          estado: 'ok',
          latenciaEmMs: Math.max(
            0,
            (comando.respondidoEm ?? comando.criadoEm).getTime() - comando.criadoEm.getTime(),
          ),
        };
      case 'falhou':
        return {
          estado: 'falhou',
          motivo: (comando.resposta?.['erro'] as string | undefined) ?? null,
        };
      case 'expirado':
        return { estado: 'expirou' };
      default:
        return comando.expiraEm.getTime() <= this.relogio.agora().getTime()
          ? { estado: 'expirou' }
          : { estado: 'aguardando' };
    }
  }

  /** Resposta do agente: ping vivo refresca o dispositivo; cadastro biométrico guarda a referência. */
  async responder(
    agente: AgenteDaCatraca,
    comandoId: string,
    resposta: RespostaDoAgente,
  ): Promise<void> {
    const agora = this.relogio.agora();
    const comando = await this.comandos.responder(
      comandoId,
      agente.id,
      resposta.ok ? 'concluido' : 'falhou',
      { ok: resposta.ok, erro: resposta.erro ?? null, referencia: resposta.referencia ?? null },
      agora,
    );
    if (!comando) {
      throw new NaoEncontradoError('Comando');
    }
    if (comando.tipo === 'ping' && resposta.ok && comando.dispositivoId) {
      const dispositivo = await this.dispositivos.porId(comando.dispositivoId);
      if (dispositivo) {
        await this.servicoDeDispositivos.recuperar(dispositivo, agente.id, agora);
      }
    }
    if (comando.tipo === 'cadastrar_biometria') {
      await this.biometrias.concluir(comando.id, resposta.ok, resposta.referencia ?? null);
    }
  }
}
