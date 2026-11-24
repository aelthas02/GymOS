import { Injectable } from '@nestjs/common';
import { Auditoria } from '../../platform/application/auditoria';
import type { NovaAtividade } from '../../platform/domain/atividade';

/** Quem age num caso de uso do painel: o usuário da sessão da equipe. */
export interface Executor {
  usuarioId: string;
}

/** Grava a atividade com o nome e o tipo de acesso atuais de quem agiu (T13b). */
@Injectable()
export class RegistroDeAtividade {
  constructor(private readonly auditoria: Auditoria) {}

  async registrar(
    executor: Executor,
    atividade: Omit<NovaAtividade, 'quem' | 'papel'>,
  ): Promise<void> {
    const autor = await this.auditoria.autorDoUsuario(executor.usuarioId);
    await this.auditoria.registrarAtividade({
      ...atividade,
      quem: { id: executor.usuarioId, nome: autor?.nome ?? 'Usuário removido' },
      papel: autor?.papel ?? '',
    });
  }
}
