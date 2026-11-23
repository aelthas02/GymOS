import { Injectable } from '@nestjs/common';
import { LocalizadorDeAlunoPorCpf } from '../application/portas';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';

/** Adapter padrão até o T15a: sem índice cego do CPF, ninguém é encontrado pelo CPF. */
@Injectable()
export class LocalizadorDeAlunoIndisponivel extends LocalizadorDeAlunoPorCpf {
  async alunoDoCpf(): Promise<string | null> {
    return null;
  }
}

/** Credencial de teste: CPF → aluno por tenant, em memória. */
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
}
