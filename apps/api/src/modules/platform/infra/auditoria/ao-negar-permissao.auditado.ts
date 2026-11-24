import { Injectable, Logger } from '@nestjs/common';
import { AoNegarPermissao, type PermissaoNegada } from '../../../autenticacao/application/portas';
import { Auditoria } from '../../application/auditoria';
import { moduloDaAuditoria } from '../../domain/atividade';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';

/**
 * Gancho do 403 (T12): grava "Tentativa negada" sensível. O guard roda antes do interceptor de
 * transação, então abre a transação do tenant por runAsTenant; o 403 sai depois do commit. Se a
 * gravação falhar, o 403 continua sendo 403: a falha vai para o log.
 */
@Injectable()
export class AoNegarPermissaoAuditado extends AoNegarPermissao {
  private readonly logger = new Logger(AoNegarPermissaoAuditado.name);

  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly auditoria: Auditoria,
  ) {
    super();
  }

  async registrar(negada: PermissaoNegada): Promise<void> {
    try {
      await this.gravar(negada);
    } catch (err) {
      this.logger.error({ err, ...negada }, 'Não gravou a tentativa negada na auditoria');
    }
  }

  private gravar(negada: PermissaoNegada): Promise<void> {
    return this.executor.runAsTenant(negada.tenantId, async () => {
      const autor = await this.auditoria.autorDoUsuario(negada.usuarioId);
      await this.auditoria.registrarAtividade({
        quem: { id: negada.usuarioId, nome: autor?.nome ?? 'Usuário removido' },
        papel: autor?.papel ?? '—',
        acao: 'tentativa-negada',
        modulo: moduloDaAuditoria(negada.permissao),
        detalhe: `Sem a permissão ${negada.permissao} em ${negada.rota}`,
      });
    });
  }
}
