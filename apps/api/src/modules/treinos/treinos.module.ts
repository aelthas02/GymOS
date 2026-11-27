import { Module, type OnModuleInit } from '@nestjs/common';
import { AlunosModule } from '../alunos/alunos.module';
import { FuncionariosModule } from '../funcionarios/funcionarios.module';
import { IntegracoesModule } from '../integracoes/integracoes.module';
import { RegistroDeProvedoresDoTitular } from '../platform/application/direitos-do-titular';
import { AutoriaDosTreinos } from './application/autoria';
import {
  RepositorioDeExecucoes,
  RepositorioDeExercicios,
  RepositorioDeFichas,
  RepositorioDeModelos,
} from './application/portas';
import { Treinos } from './application/treinos';
import { DadosDoTitularDosTreinos } from './infra/adapters';
import {
  RepositorioDeExecucoesPrisma,
  RepositorioDeExerciciosPrisma,
  RepositorioDeFichasPrisma,
  RepositorioDeModelosPrisma,
} from './infra/repositorios.prisma';
import { TreinoDoAppController, TreinosController } from './interface/http/treinos.controller';

/**
 * Treinos (T25): biblioteca de exercícios, modelos, fichas dos alunos (com a geração pela porta
 * `GeradorIA` e a aprovação do professor) e o registro de execução do aluno.
 */
@Module({
  imports: [AlunosModule, FuncionariosModule, IntegracoesModule],
  controllers: [TreinosController, TreinoDoAppController],
  providers: [
    { provide: RepositorioDeExercicios, useClass: RepositorioDeExerciciosPrisma },
    { provide: RepositorioDeModelos, useClass: RepositorioDeModelosPrisma },
    { provide: RepositorioDeFichas, useClass: RepositorioDeFichasPrisma },
    { provide: RepositorioDeExecucoes, useClass: RepositorioDeExecucoesPrisma },
    AutoriaDosTreinos,
    DadosDoTitularDosTreinos,
    Treinos,
  ],
  exports: [Treinos, RepositorioDeFichas, RepositorioDeExercicios, RepositorioDeModelos],
})
export class TreinosModule implements OnModuleInit {
  constructor(
    private readonly titular: RegistroDeProvedoresDoTitular,
    private readonly dadosDoTitular: DadosDoTitularDosTreinos,
  ) {}

  onModuleInit(): void {
    this.titular.registrar(this.dadosDoTitular);
  }
}
