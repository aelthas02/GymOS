import { Injectable } from '@nestjs/common';
import { PublicadorDeEventos } from '../../platform/application/eventos';
import { Relogio } from '../../platform/domain/relogio';
import { type Executor, AutoriaDoAcesso } from '../../acesso/application/autoria';
import { SEGUNDOS_PARA_OFFLINE, estaOnline, textoDoAlertaDeQueda } from '../domain/dispositivo';
import { DispositivoInvalidoError, NaoEncontradoError } from './erros';
import {
  type AgenteDaCatraca,
  type Dispositivo,
  type NovoDispositivo,
  type QuedaDeDispositivo,
  RepositorioDeAgentes,
  RepositorioDeComandos,
  RepositorioDeDispositivos,
  RepositorioDeQuedas,
  RepositorioDoCacheDeAcesso,
} from './portas';

/** O alerta fica na lista por este tempo depois de a catraca voltar. */
const JANELA_DOS_ALERTAS_MS = 24 * 60 * 60 * 1000;
const LIMITE_DE_ALERTAS = 50;

export interface DispositivoComEstado extends Dispositivo {
  /** Pelo último batimento: offline após 90 s sem sinal. */
  statusOnline: boolean;
}

export interface AlertaDeDispositivo {
  id: string;
  dispositivoId: string;
  nome: string;
  desde: Date;
  voltouEm: Date | null;
  aberto: boolean;
  duracaoEmSegundos: number | null;
  texto: string;
}

export interface EntradaDoBatimento {
  versao?: string | null;
  /** Estado de cada equipamento visto pelo agente; sem a lista, todos os dispositivos dele estão vivos. */
  dispositivos?: ReadonlyArray<{ id: string; online: boolean }>;
}

export interface ResultadoDoBatimento {
  recebidoEm: Date;
  versaoDoCache: number;
  comandos: Array<{
    id: string;
    tipo: string;
    dispositivoId: string | null;
    dados: Record<string, unknown>;
  }>;
}

const duracao = (desde: Date, voltouEm: Date | null): number | null =>
  voltouEm === null ? null : Math.max(0, Math.round((voltouEm.getTime() - desde.getTime()) / 1000));

/**
 * Catracas e leitores (T23b): cadastro, status pelo batimento do agente (offline após 90 s sem sinal),
 * histórico de quedas e o evento `DispositivoMudouDeEstado`, que alimenta o tempo real e os alertas.
 */
@Injectable()
export class Dispositivos {
  constructor(
    private readonly dispositivos: RepositorioDeDispositivos,
    private readonly agentes: RepositorioDeAgentes,
    private readonly quedas: RepositorioDeQuedas,
    private readonly comandos: RepositorioDeComandos,
    private readonly cache: RepositorioDoCacheDeAcesso,
    private readonly publicador: PublicadorDeEventos,
    private readonly autoria: AutoriaDoAcesso,
    private readonly relogio: Relogio,
  ) {}

  private comEstado(dispositivo: Dispositivo, agora: Date): DispositivoComEstado {
    return { ...dispositivo, statusOnline: estaOnline(dispositivo.ultimoBatimentoEm, agora) };
  }

  async listar(): Promise<DispositivoComEstado[]> {
    const agora = this.relogio.agora();
    return (await this.dispositivos.listar()).map((d) => this.comEstado(d, agora));
  }

  async obter(id: string): Promise<DispositivoComEstado> {
    const dispositivo = await this.dispositivos.porId(id);
    if (!dispositivo) {
      throw new NaoEncontradoError('Dispositivo');
    }
    return this.comEstado(dispositivo, this.relogio.agora());
  }

  async cadastrar(executor: Executor, dados: NovoDispositivo): Promise<DispositivoComEstado> {
    await this.validar(dados);
    const criado = await this.dispositivos.criar(dados);
    await this.autoria.registrar(executor, {
      acao: 'alterou-dispositivo',
      detalhe: `Cadastrou ${criado.tipo} "${criado.nome}" (${criado.local})`,
    });
    return this.comEstado(criado, this.relogio.agora());
  }

  async editar(
    executor: Executor,
    id: string,
    dados: NovoDispositivo,
  ): Promise<DispositivoComEstado> {
    await this.validar(dados);
    const atualizado = await this.dispositivos.atualizar(id, dados);
    if (!atualizado) {
      throw new NaoEncontradoError('Dispositivo');
    }
    await this.autoria.registrar(executor, {
      acao: 'alterou-dispositivo',
      detalhe: `Editou ${atualizado.tipo} "${atualizado.nome}" (${atualizado.local})`,
    });
    return this.comEstado(atualizado, this.relogio.agora());
  }

  async excluir(executor: Executor, id: string): Promise<void> {
    const dispositivo = await this.dispositivos.porId(id);
    if (!dispositivo) {
      throw new NaoEncontradoError('Dispositivo');
    }
    await this.quedas.excluirDoDispositivo(id);
    await this.dispositivos.excluir(id);
    await this.autoria.registrar(executor, {
      acao: 'alterou-dispositivo',
      detalhe: `Excluiu ${dispositivo.tipo} "${dispositivo.nome}"`,
    });
  }

  private async validar(dados: NovoDispositivo): Promise<void> {
    if (dados.nome.trim() === '' || dados.local.trim() === '') {
      throw new DispositivoInvalidoError('Informe o nome e o local do dispositivo.');
    }
    if (dados.metodos.length === 0) {
      throw new DispositivoInvalidoError('Informe ao menos um método de acesso.');
    }
    if (dados.agenteId && !(await this.agentes.porId(dados.agenteId))) {
      throw new NaoEncontradoError('Agente');
    }
  }

  /** Dispositivos que o agente controla ou pode adotar (ainda sem agente). */
  async doAgente(agente: AgenteDaCatraca): Promise<Dispositivo[]> {
    return (await this.dispositivos.listar()).filter(
      (d) => d.agenteId === agente.id || d.agenteId === null,
    );
  }

  registrarSincronizacao(agente: AgenteDaCatraca): Promise<void> {
    return this.agentes.registrarSincronizacao(agente.id, this.relogio.agora());
  }

  // ---------- Batimento e quedas ----------

  /**
   * Batimento do agente (a cada 30 s): marca os dispositivos vivos, fecha as quedas abertas deles e
   * devolve os comandos pendentes e a versão do cache de autorização.
   */
  async registrarBatimento(
    agente: AgenteDaCatraca,
    entrada: EntradaDoBatimento,
  ): Promise<ResultadoDoBatimento> {
    const agora = this.relogio.agora();
    await this.agentes.registrarBatimento(agente.id, entrada.versao ?? null, agora);
    if (entrada.dispositivos) {
      const lista = await this.dispositivos.doAgenteOuLivres(
        agente.id,
        entrada.dispositivos.map((d) => d.id),
      );
      for (const dispositivo of lista) {
        const visto = entrada.dispositivos.find((d) => d.id === dispositivo.id);
        await (visto?.online
          ? this.recuperar(dispositivo, agente.id, agora)
          : this.derrubar(dispositivo, agora));
      }
    } else {
      for (const dispositivo of await this.dispositivos.doAgente(agente.id)) {
        await this.recuperar(dispositivo, agente.id, agora);
      }
    }
    const pendentes = await this.comandos.entregarPendentes(agente.id, agora);
    return {
      recebidoEm: agora,
      versaoDoCache: await this.cache.versaoAtual(),
      comandos: pendentes.map(({ id, tipo, dispositivoId, dados }) => ({
        id,
        tipo,
        dispositivoId,
        dados,
      })),
    };
  }

  /** O dispositivo respondeu: fecha a queda aberta (com a duração) e volta a ficar online. */
  async recuperar(dispositivo: Dispositivo, agenteId: string, agora: Date): Promise<void> {
    const queda = await this.quedas.fechar(dispositivo.id, agora);
    await this.dispositivos.marcarOnline(dispositivo.id, agenteId, agora);
    if (queda) {
      await this.publicarEstado(dispositivo, true, queda.desde, agora);
    }
  }

  private async derrubar(dispositivo: Dispositivo, agora: Date): Promise<void> {
    if (!dispositivo.online || (await this.quedas.aberta(dispositivo.id))) {
      return;
    }
    const desde = dispositivo.ultimoBatimentoEm ?? agora;
    await this.quedas.abrir(dispositivo.id, desde);
    await this.dispositivos.marcarOffline(dispositivo.id);
    await this.publicarEstado(dispositivo, false, desde, null);
  }

  /**
   * Rotina: dispositivo online sem sinal há mais de 90 s passa a offline, abre a queda e avisa o tempo
   * real. Também expira os comandos que o agente não respondeu. Devolve quantos dispositivos caíram.
   */
  async verificarQuedas(): Promise<number> {
    const agora = this.relogio.agora();
    const limite = new Date(agora.getTime() - SEGUNDOS_PARA_OFFLINE * 1000);
    const sem = await this.dispositivos.onlineSemSinalDesde(limite);
    for (const dispositivo of sem) {
      await this.derrubar(dispositivo, agora);
    }
    await this.comandos.expirar(agora);
    return sem.length;
  }

  private publicarEstado(
    dispositivo: Dispositivo,
    online: boolean,
    desde: Date,
    voltouEm: Date | null,
  ): Promise<unknown> {
    return this.publicador.publicar({
      tipo: 'DispositivoMudouDeEstado',
      payload: {
        dispositivoId: dispositivo.id,
        nome: dispositivo.nome,
        tipo: dispositivo.tipo,
        online,
        desde: desde.toISOString(),
        voltouEm: voltouEm?.toISOString() ?? null,
        duracaoEmSegundos: duracao(desde, voltouEm),
      },
    });
  }

  // ---------- Alertas e histórico ----------

  /** Quedas abertas e as das últimas 24 h, as mais recentes primeiro. */
  async alertas(): Promise<AlertaDeDispositivo[]> {
    const agora = this.relogio.agora();
    const quedas = await this.quedas.recentes(
      new Date(agora.getTime() - JANELA_DOS_ALERTAS_MS),
      LIMITE_DE_ALERTAS,
    );
    const nomes = new Map((await this.dispositivos.listar()).map((d) => [d.id, d.nome]));
    return quedas.flatMap((queda) => {
      const nome = nomes.get(queda.dispositivoId);
      return nome === undefined ? [] : [this.alerta(queda, nome)];
    });
  }

  async historicoDeQuedas(dispositivoId: string): Promise<AlertaDeDispositivo[]> {
    const dispositivo = await this.obter(dispositivoId);
    return (await this.quedas.doDispositivo(dispositivoId, 100)).map((queda) =>
      this.alerta(queda, dispositivo.nome),
    );
  }

  private alerta(queda: QuedaDeDispositivo, nome: string): AlertaDeDispositivo {
    return {
      id: queda.id,
      dispositivoId: queda.dispositivoId,
      nome,
      desde: queda.desde,
      voltouEm: queda.voltouEm,
      aberto: queda.voltouEm === null,
      duracaoEmSegundos: duracao(queda.desde, queda.voltouEm),
      texto: textoDoAlertaDeQueda(nome, queda.desde, queda.voltouEm),
    };
  }
}
