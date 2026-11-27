import { Injectable } from '@nestjs/common';
import type { ProvedorDeDadosDoTitular } from '../../platform/application/direitos-do-titular';
import { RepositorioDeExecucoes, RepositorioDeFichas } from '../application/portas';

/**
 * LGPD (T13c): exporta as fichas (restrições reveladas, com log de acesso) e as execuções do aluno.
 * Sem guarda legal: a exclusão apaga tudo.
 */
@Injectable()
export class DadosDoTitularDosTreinos implements ProvedorDeDadosDoTitular {
  readonly dominio = 'treinos';

  constructor(
    private readonly fichas: RepositorioDeFichas,
    private readonly execucoes: RepositorioDeExecucoes,
  ) {}

  async exportar(alunoId: string): Promise<unknown> {
    const [fichas, execucoes] = await Promise.all([
      this.fichas.doAluno(alunoId, 'sistema:treinos.exportar'),
      this.execucoes.doAluno(alunoId),
    ]);
    return { fichas, execucoes };
  }

  async excluirOuAnonimizar(alunoId: string): Promise<{ registros: number }> {
    const fichas = await this.fichas.excluirDoAluno(alunoId);
    const execucoes = await this.execucoes.excluirDoAluno(alunoId);
    return { registros: fichas + execucoes };
  }
}
