import { Injectable, Logger } from '@nestjs/common';
import {
  type Aviso,
  type InscricaoDePush,
  RepositorioDeAvisos,
  RepositorioDeInscricoes,
  RepositorioDePreferencias,
  WebPush,
} from './portas';

/**
 * Envia o Web Push dos avisos que pediram push (consumidor de `PushSolicitado`). Respeita a
 * preferência do tipo, remove a inscrição que o provedor diz estar expirada (404 ou 410) e não
 * falha o evento por erro de um dispositivo: o aviso já está na caixa, e repetir o evento
 * reenviaria o push aos dispositivos que já receberam.
 */
@Injectable()
export class EnvioDePush {
  private readonly logger = new Logger(EnvioDePush.name);

  constructor(
    private readonly avisos: RepositorioDeAvisos,
    private readonly inscricoes: RepositorioDeInscricoes,
    private readonly preferencias: RepositorioDePreferencias,
    private readonly webPush: WebPush,
  ) {}

  async enviar(avisoIds: readonly string[]): Promise<void> {
    const avisos = await this.avisos.porIds(avisoIds);
    for (const tipoDeDestinatario of ['aluno', 'funcionario'] as const) {
      const doTipo = avisos.filter((aviso) => aviso.destinatarioTipo === tipoDeDestinatario);
      if (doTipo.length === 0) {
        continue;
      }
      const ids = [...new Set(doTipo.map((aviso) => aviso.destinatarioId))];
      const inscricoes = await this.inscricoes.dosDestinatarios(tipoDeDestinatario, ids);
      for (const aviso of doTipo) {
        const dispositivos = inscricoes.filter(
          (item) => item.destinatarioId === aviso.destinatarioId,
        );
        if (dispositivos.length === 0) {
          continue;
        }
        const desligados = await this.preferencias.comPushDesligado(
          tipoDeDestinatario,
          [aviso.destinatarioId],
          aviso.tipo,
        );
        if (desligados.has(aviso.destinatarioId)) {
          continue;
        }
        for (const inscricao of dispositivos) {
          await this.enviarPara(aviso, inscricao);
        }
      }
    }
  }

  private async enviarPara(aviso: Aviso, inscricao: InscricaoDePush): Promise<void> {
    try {
      const resultado = await this.webPush.enviar(inscricao, {
        avisoId: aviso.id,
        tipo: aviso.tipo,
        titulo: aviso.titulo,
        texto: aviso.texto,
        link: aviso.link,
      });
      if (resultado === 'expirada') {
        await this.inscricoes.removerPorId(inscricao.id);
      }
    } catch (erro) {
      // Nunca logue o endpoint nem as chaves da inscrição.
      this.logger.warn(
        { err: erro, avisoId: aviso.id, inscricaoId: inscricao.id },
        'Falha ao enviar o Web Push',
      );
    }
  }
}
