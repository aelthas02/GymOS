import { Injectable } from '@nestjs/common';
import { PublicadorDeEventos } from '../../platform/application/eventos';
import { Relogio } from '../../platform/domain/relogio';
import { validarAviso } from '../domain/aviso';
import { type Executor, AutoriaDosAvisos } from './autoria';
import { DestinatariosDeComunicado, RepositorioDeAvisos } from './portas';

export interface PedidoDeComunicado {
  titulo: string;
  texto: string;
  link?: string | null;
  push?: boolean;
  /** Só estes alunos; sem a lista, todos os alunos da academia. */
  alunoIds?: readonly string[];
}

const TAMANHO_DO_LOTE = 200;

/** Comunicado manual da academia (ex.: "Manutenção da piscina"): um aviso do tipo comunicado por aluno. */
@Injectable()
export class Comunicados {
  constructor(
    private readonly avisos: RepositorioDeAvisos,
    private readonly destinatarios: DestinatariosDeComunicado,
    private readonly eventos: PublicadorDeEventos,
    private readonly autoria: AutoriaDosAvisos,
    private readonly relogio: Relogio,
  ) {}

  async enviar(executor: Executor, pedido: PedidoDeComunicado): Promise<{ destinatarios: number }> {
    const dados = validarAviso({ ...pedido, tipo: 'comunicado' });
    const criadoEm = this.relogio.agora();
    const alunos = [...new Set(pedido.alunoIds ?? (await this.destinatarios.todosOsAlunos()))];
    for (let inicio = 0; inicio < alunos.length; inicio += TAMANHO_DO_LOTE) {
      const lote = alunos.slice(inicio, inicio + TAMANHO_DO_LOTE);
      const criados = await this.avisos.criar(
        lote.map((id) => ({ destinatario: { tipo: 'aluno' as const, id }, criadoEm, ...dados })),
      );
      if (pedido.push) {
        await this.eventos.publicar({
          tipo: 'PushSolicitado',
          payload: { avisoIds: criados.map((aviso) => aviso.id) },
        });
      }
    }
    await this.autoria.registrar(executor, {
      acao: 'enviou-comunicado',
      detalhe: `${dados.titulo} (${alunos.length} ${alunos.length === 1 ? 'aluno' : 'alunos'})`,
    });
    return { destinatarios: alunos.length };
  }
}
