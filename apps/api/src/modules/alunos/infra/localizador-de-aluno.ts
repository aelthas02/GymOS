import { Injectable } from '@nestjs/common';
import { LocalizadorDeAlunoPorCpf } from '../../autenticacao/application/portas';
import { CifraDeCampos } from '../../platform/application/protecao-de-dados';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';

/**
 * Login do aluno pelo CPF ou pelo e-mail (T12): busca pelo índice cego do aluno (T13c), sem guardar
 * o CPF nem o e-mail em claro na credencial. Usa só a plataforma, para o módulo de autenticação
 * poder registrá-lo sem depender do módulo de alunos.
 */
@Injectable()
export class LocalizadorDeAlunoPeloIndiceCego extends LocalizadorDeAlunoPorCpf {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly cifra: CifraDeCampos,
  ) {
    super();
  }

  async alunoDoCpf(cpf: string): Promise<string | null> {
    const cpfHash = await this.cifra.indiceCego('cpf', cpf);
    const linha = await this.contexto
      .cliente()
      .aluno.findFirst({ where: { cpfHash }, select: { id: true } });
    return linha?.id ?? null;
  }

  async alunoDoEmail(email: string): Promise<string | null> {
    const emailHash = await this.cifra.indiceCego('email', email);
    const linha = await this.contexto
      .cliente()
      .aluno.findFirst({ where: { emailHash }, select: { id: true } });
    return linha?.id ?? null;
  }
}
