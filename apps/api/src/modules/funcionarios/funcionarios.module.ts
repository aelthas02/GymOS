import { Module, type OnModuleInit } from '@nestjs/common';
import { RegistroDeProvedoresDoTitular } from '../platform/application/direitos-do-titular';
import { AutoriaDosFuncionarios } from './application/autoria';
import { Funcionarios } from './application/funcionarios';
import { RegistroDeVinculos, RepositorioDeFuncionarios } from './application/portas';
import { DadosDoTitularDosFuncionarios, VinculoComAlunos } from './infra/adapters';
import { RepositorioDeFuncionariosPrisma } from './infra/repositorios.prisma';
import { FuncionariosController } from './interface/http/funcionarios.controller';

/**
 * Funcionários da academia (T26a): cadastro da equipe com o acesso ao painel (T12) que vem junto, o
 * custo mensal para o Financeiro (T21) e a lista de professores e profissionais para aulas e Saúde
 * (T28, T30). Outros domínios registram seus vínculos no `RegistroDeVinculos` para barrar a exclusão.
 */
@Module({
  controllers: [FuncionariosController],
  providers: [
    { provide: RepositorioDeFuncionarios, useClass: RepositorioDeFuncionariosPrisma },
    RegistroDeVinculos,
    AutoriaDosFuncionarios,
    VinculoComAlunos,
    DadosDoTitularDosFuncionarios,
    Funcionarios,
  ],
  exports: [Funcionarios, RegistroDeVinculos, RepositorioDeFuncionarios],
})
export class FuncionariosModule implements OnModuleInit {
  constructor(
    private readonly titular: RegistroDeProvedoresDoTitular,
    private readonly dadosDoTitular: DadosDoTitularDosFuncionarios,
    private readonly vinculos: RegistroDeVinculos,
    private readonly vinculoComAlunos: VinculoComAlunos,
  ) {}

  onModuleInit(): void {
    this.titular.registrar(this.dadosDoTitular);
    this.vinculos.registrar(this.vinculoComAlunos);
  }
}
