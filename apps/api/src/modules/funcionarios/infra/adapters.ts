import { Injectable } from '@nestjs/common';
import type { ProvedorDeDadosDoTitular } from '../../platform/application/direitos-do-titular';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import { type FonteDeVinculos } from '../application/portas';

/** Alunos que têm o funcionário como professor responsável (`aluno.professor_id`, T15a). */
@Injectable()
export class VinculoComAlunos implements FonteDeVinculos {
  readonly nome = 'alunos';

  constructor(private readonly contexto: ContextoDoTenant) {}

  async descrever(funcionarioId: string): Promise<string | null> {
    const alunos = await this.contexto
      .cliente()
      .aluno.count({ where: { professorId: funcionarioId } });
    if (alunos === 0) {
      return null;
    }
    return alunos === 1 ? 'é professor de 1 aluno' : `é professor de ${alunos} alunos`;
  }
}

/**
 * LGPD (T13c): o que o cadastro da equipe guarda sobre um aluno é só o professor responsável por ele
 * (nome e cargo). Não há o que excluir: o funcionário não é dado do aluno, e o vínculo some com
 * `aluno.professor_id` quando o domínio de alunos exclui o aluno.
 */
@Injectable()
export class DadosDoTitularDosFuncionarios implements ProvedorDeDadosDoTitular {
  readonly dominio = 'funcionarios';

  constructor(private readonly contexto: ContextoDoTenant) {}

  async exportar(alunoId: string): Promise<unknown> {
    const cliente = this.contexto.cliente();
    const aluno = await cliente.aluno.findFirst({
      where: { id: alunoId },
      select: { professorId: true },
    });
    const professor = aluno?.professorId
      ? await cliente.funcionario.findFirst({
          where: { id: aluno.professorId },
          select: { id: true, nome: true, cargo: true },
        })
      : null;
    return { professorResponsavel: professor };
  }

  async excluirOuAnonimizar(): Promise<{ registros: number }> {
    return { registros: 0 };
  }
}
