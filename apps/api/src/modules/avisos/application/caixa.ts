import { Injectable } from '@nestjs/common';
import { Relogio } from '../../platform/domain/relogio';
import {
  type Destinatario,
  TIPOS_DE_AVISO,
  type TipoDeAviso,
  decodificarCursor,
  validarEndpointDePush,
} from '../domain/aviso';
import { NaoEncontradoError } from './erros';
import {
  type DadosDaInscricao,
  type PaginaDeAvisos,
  type PreferenciaDeAviso,
  RepositorioDeAvisos,
  RepositorioDeInscricoes,
  RepositorioDePreferencias,
  WebPush,
} from './portas';

export const LIMITE_PADRAO_DE_AVISOS = 30;
export const LIMITE_MAXIMO_DE_AVISOS = 100;

/** A caixa de avisos de um destinatário (tela Avisos do app: "Todos" e "Não lidos"). */
@Injectable()
export class CaixaDeAvisos {
  constructor(
    private readonly avisos: RepositorioDeAvisos,
    private readonly relogio: Relogio,
  ) {}

  listar(
    destinatario: Destinatario,
    consulta: { naoLidos?: boolean; limite?: number; cursor?: string } = {},
  ): Promise<PaginaDeAvisos> {
    if (consulta.cursor) {
      decodificarCursor(consulta.cursor);
    }
    return this.avisos.listar(destinatario, {
      naoLidos: consulta.naoLidos ?? false,
      limite: Math.min(consulta.limite ?? LIMITE_PADRAO_DE_AVISOS, LIMITE_MAXIMO_DE_AVISOS),
      cursor: consulta.cursor,
    });
  }

  contarNaoLidos(destinatario: Destinatario): Promise<number> {
    return this.avisos.contarNaoLidos(destinatario);
  }

  async marcarComoLido(destinatario: Destinatario, id: string): Promise<void> {
    if (!(await this.avisos.marcarComoLido(destinatario, id, this.relogio.agora()))) {
      throw new NaoEncontradoError('Aviso');
    }
  }

  marcarTodosComoLidos(destinatario: Destinatario): Promise<number> {
    return this.avisos.marcarTodosComoLidos(destinatario, this.relogio.agora());
  }
}

/** Dispositivos inscritos no Web Push de um destinatário (a inscrição no navegador é do T32). */
@Injectable()
export class InscricoesDePush {
  constructor(
    private readonly inscricoes: RepositorioDeInscricoes,
    private readonly webPush: WebPush,
  ) {}

  chavePublica(): string {
    return this.webPush.chavePublica();
  }

  async inscrever(destinatario: Destinatario, dados: DadosDaInscricao): Promise<void> {
    validarEndpointDePush(dados.endpoint);
    await this.inscricoes.salvar(destinatario, dados);
  }

  /** Cancelar um dispositivo que não está inscrito não é erro: o resultado desejado já vale. */
  async cancelar(destinatario: Destinatario, endpoint: string): Promise<void> {
    await this.inscricoes.remover(destinatario, endpoint);
  }
}

/** Preferências de push por tipo de aviso; o que não foi escolhido está ligado. */
@Injectable()
export class PreferenciasDeAviso {
  constructor(private readonly preferencias: RepositorioDePreferencias) {}

  async listar(destinatario: Destinatario): Promise<PreferenciaDeAviso[]> {
    const explicitas = new Map(
      (await this.preferencias.doDestinatario(destinatario)).map((item) => [item.tipo, item.push]),
    );
    return TIPOS_DE_AVISO.map((tipo) => ({ tipo, push: explicitas.get(tipo) ?? true }));
  }

  definir(destinatario: Destinatario, tipo: TipoDeAviso, push: boolean): Promise<void> {
    return this.preferencias.salvar(destinatario, { tipo, push });
  }
}
