import { Global, Module } from '@nestjs/common';
import { AoNegarPermissao } from '../autenticacao/application/portas';
import { Auditoria, RepositorioDeAtividades } from './application/auditoria';
import { AoNegarPermissaoAuditado } from './infra/auditoria/ao-negar-permissao.auditado';
import { RepositorioDeAtividadesPrisma } from './infra/auditoria/atividades.prisma';
import { LimpezaDaAuditoria } from './infra/auditoria/limpeza-da-auditoria';
import { AuditoriaController } from './interface/http/auditoria.controller';

/**
 * Log de atividades (T13b): `Auditoria.registrarAtividade` para os casos de uso dos donos, consulta
 * e exportação para o Administrador, retenção de 12 meses e o gancho do 403 do T12.
 */
@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [
    { provide: RepositorioDeAtividades, useClass: RepositorioDeAtividadesPrisma },
    Auditoria,
    LimpezaDaAuditoria,
    { provide: AoNegarPermissao, useClass: AoNegarPermissaoAuditado },
  ],
  exports: [Auditoria, AoNegarPermissao],
})
export class AuditoriaModule {}
