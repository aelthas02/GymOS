import { Injectable } from '@nestjs/common';
import { LocalizadorDeAlunoPorCpf } from '../application/portas';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';

/** Credencial de teste: CPF → aluno por tenant, em memória (o e-mail fica na credencial). */
@Injectable()
export class LocalizadorDeAlunoEmMemoria extends LocalizadorDeAlunoPorCpf {
  private readonly alunos = new Map<string, string>();

  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  registrar(tenantId: string, cpf: string, alunoId: string): void {
    this.alunos.set(`${tenantId}:${cpf}`, alunoId);
  }

  async alunoDoCpf(cpf: string): Promise<string | null> {
    return this.alunos.get(`${this.contexto.tenant().id}:${cpf}`) ?? null;
  }

  async alunoDoEmail(): Promise<string | null> {
    return null;
  }
}
