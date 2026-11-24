import { Injectable } from '@nestjs/common';
import { RepositorioDeAlunos } from '../../alunos/application/portas';
import type { ProvedorDeDadosDoTitular } from '../../platform/application/direitos-do-titular';
import { Filas } from '../../platform/application/eventos';
import { Relogio } from '../../platform/domain/relogio';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import { AgendadorDeAvisos, DestinatariosDeComunicado } from '../application/portas';

/** Nome do job e da fila do envio agendado (`notificacoes`). */
export const JOB_DE_AVISO_AGENDADO = 'avisos.enviar-agendado';

/** Espera mínima: o job não pode correr antes do commit que gravou o agendamento. */
const ESPERA_MINIMA_MS = 1_000;

/** Agenda o envio como job atrasado do BullMQ, com o id do agendamento (não duplica). */
@Injectable()
export class AgendadorDeAvisosNaFila extends AgendadorDeAvisos {
  constructor(
    private readonly filas: Filas,
    private readonly contexto: ContextoDoTenant,
    private readonly relogio: Relogio,
  ) {
    super();
  }

  async agendar(agendamentoId: string, quando: Date): Promise<void> {
    const atrasoMs = Math.max(ESPERA_MINIMA_MS, quando.getTime() - this.relogio.agora().getTime());
    await this.filas.enfileirar(
      'notificacoes',
      JOB_DE_AVISO_AGENDADO,
      { tenantId: this.contexto.tenant().id, agendamentoId },
      { id: agendamentoId, atrasoMs },
    );
  }
}

/** Comunicado para todos: os alunos da academia, pelo repositório do domínio de alunos. */
@Injectable()
export class TodosOsAlunosDaAcademia extends DestinatariosDeComunicado {
  constructor(private readonly alunos: RepositorioDeAlunos) {
    super();
  }

  todosOsAlunos(): Promise<string[]> {
    return this.alunos.todosOsIds();
  }
}

/**
 * LGPD (T13e): avisos, dispositivos de push, preferências e agendamentos do aluno. Sem retenção
 * legal: a exclusão apaga tudo. A exportação não inclui as chaves das inscrições.
 */
@Injectable()
export class DadosDoTitularDosAvisos implements ProvedorDeDadosDoTitular {
  readonly dominio = 'avisos';

  constructor(private readonly contexto: ContextoDoTenant) {}

  async exportar(alunoId: string): Promise<unknown> {
    const cliente = this.contexto.cliente();
    const dele = { destinatarioTipo: 'aluno', destinatarioId: alunoId };
    const [avisos, dispositivos, preferencias] = await Promise.all([
      cliente.aviso.findMany({
        where: dele,
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
        select: { tipo: true, titulo: true, texto: true, link: true, lidoEm: true, criadoEm: true },
      }),
      cliente.inscricaoDePush.findMany({
        where: dele,
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
        select: { dispositivo: true, criadoEm: true },
      }),
      cliente.preferenciaDeAviso.findMany({
        where: dele,
        orderBy: [{ tipo: 'asc' }],
        select: { tipo: true, push: true },
      }),
    ]);
    return { avisos, dispositivos, preferencias };
  }

  async excluirOuAnonimizar(alunoId: string): Promise<{ registros: number }> {
    const cliente = this.contexto.cliente();
    const dele = { destinatarioTipo: 'aluno', destinatarioId: alunoId };
    const apagados = await Promise.all([
      cliente.aviso.deleteMany({ where: dele }),
      cliente.inscricaoDePush.deleteMany({ where: dele }),
      cliente.preferenciaDeAviso.deleteMany({ where: dele }),
      cliente.avisoAgendado.deleteMany({ where: dele }),
    ]);
    return { registros: apagados.reduce((soma, { count }) => soma + count, 0) };
  }
}
