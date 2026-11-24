import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { Contratos } from '../../alunos/application/contratos';
import { Planos } from '../../alunos/application/planos';
import { RepositorioDeAlunos } from '../../alunos/application/portas';
import type { ProvedorDeDadosDoTitular } from '../../platform/application/direitos-do-titular';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../../platform/infra/contexto/executor-de-tenant';
import {
  CONFIGURACAO_DAS_FILAS,
  type ConfiguracaoDasFilas,
} from '../../platform/infra/filas/configuracao-das-filas';
import { AlertasDeFrequencia } from '../application/alertas';
import {
  AcademiaAtual,
  AlunosParaAcesso,
  type ContextoDoAluno,
  RegistroDeQrUsado,
  RepositorioDeAcessos,
  RepositorioDeAlertas,
} from '../application/portas';

/** A academia do contexto da requisição ou do job. */
@Injectable()
export class AcademiaDoContexto extends AcademiaAtual {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  id(): string {
    return this.contexto.tenant().id;
  }
}

/**
 * Os fatos que a catraca precisa do aluno, dos domínios de alunos (contrato e plano, T15a) e de
 * cobrança (`diasDeAtraso`, T19): o estado do contrato já vem avaliado com o atraso da Cobrança.
 */
@Injectable()
export class AlunosParaAcessoDosAlunos extends AlunosParaAcesso {
  constructor(
    private readonly alunos: RepositorioDeAlunos,
    private readonly contratos: Contratos,
    private readonly planos: Planos,
  ) {
    super();
  }

  async contexto(alunoId: string): Promise<ContextoDoAluno | null> {
    const nome = await this.alunos.nome(alunoId);
    if (nome === null) {
      return null;
    }
    const situacao = await this.contratos.situacao(alunoId);
    const plano = situacao.contrato ? await this.planos.obter(situacao.contrato.planoId) : null;
    return {
      alunoId,
      nome,
      contrato: situacao.avaliacao?.estado ?? null,
      diasDeAtraso: situacao.avaliacao?.diasDeAtraso ?? 0,
      planoNome: plano?.nome ?? null,
      modalidadesDoPlano: plano?.modalidades ?? [],
      acessosPorSemana: plano?.acessosPorSemana ?? null,
      inicioDoContrato: situacao.contrato?.inicio ?? null,
    };
  }

  todosOsIds(): Promise<string[]> {
    return this.alunos.todosOsIds();
  }

  resumos(
    ids: readonly string[],
  ): Promise<Map<string, { nome: string; professorId: string | null }>> {
    return this.alunos.resumos(ids);
  }

  unidadePadrao(): Promise<string> {
    return this.alunos.unidadePadrao();
  }
}

/**
 * LGPD (T23a): o histórico de acesso do aluno (quando e por onde entrou), os alertas de frequência e
 * os nonces de QR. Sem retenção legal: a exclusão apaga tudo.
 */
@Injectable()
export class DadosDoTitularDoAcesso implements ProvedorDeDadosDoTitular {
  readonly dominio = 'acesso';

  constructor(
    private readonly acessos: RepositorioDeAcessos,
    private readonly alertas: RepositorioDeAlertas,
    private readonly qrUsados: RegistroDeQrUsado,
  ) {}

  async exportar(alunoId: string): Promise<unknown> {
    const [acessos, alertas] = await Promise.all([
      this.acessos.doAluno(alunoId),
      this.alertas.doAluno(alunoId),
    ]);
    return {
      acessos: acessos.map((acesso) => ({
        registradoEm: acesso.registradoEm,
        direcao: acesso.direcao,
        metodo: acesso.metodo,
        resultado: acesso.resultado,
        motivo: acesso.motivo,
        modalidade: acesso.modalidade,
      })),
      alertasDeFrequencia: alertas.map((alerta) => ({
        tipo: alerta.tipo,
        nivel: alerta.nivel,
        diasSemTreinar: alerta.diasSemTreinar,
        quedaPercentual: alerta.quedaPercentual,
        criadoEm: alerta.criadoEm,
      })),
    };
  }

  async excluirOuAnonimizar(alunoId: string): Promise<{ registros: number }> {
    const apagados = await Promise.all([
      this.acessos.excluirDoAluno(alunoId),
      this.alertas.excluirDoAluno(alunoId),
      this.qrUsados.excluirDoAluno(alunoId),
    ]);
    return { registros: apagados.reduce((soma, quantos) => soma + quantos, 0) };
  }
}

/** De quanto em quanto tempo a rotina vê se já é a hora da verificação (a hora é configurável). */
const INTERVALO_DA_ROTINA_MS = 5 * 60 * 1000;

/**
 * Job dos alertas de frequência: a cada 5 min vê, tenant por tenant, se passou da hora configurada
 * e ainda não verificou hoje (a trava é o dia gravado na configuração). Só com `FILAS_PROCESSAR`.
 */
@Injectable()
export class RotinaDosAlertas implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RotinaDosAlertas.name);
  private temporizador?: NodeJS.Timeout;

  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly alertas: AlertasDeFrequencia,
    @Optional()
    @Inject(CONFIGURACAO_DAS_FILAS)
    private readonly filas?: ConfiguracaoDasFilas,
  ) {}

  /** Número de tenants em que a verificação rodou agora. */
  async executar(): Promise<number> {
    const resultados = await this.executor.paraCadaTenant(() => this.alertas.verificarSeDevido());
    return resultados.filter((resultado) => resultado !== null).length;
  }

  onApplicationBootstrap(): void {
    if (!this.filas?.processar) {
      return;
    }
    this.temporizador = setInterval(() => {
      this.executar().then(
        (rodaram) => {
          if (rodaram > 0) {
            this.logger.log({ rodaram }, 'Verificação dos alertas de frequência executada');
          }
        },
        (err: unknown) => this.logger.error({ err }, 'Falha na verificação dos alertas'),
      );
    }, INTERVALO_DA_ROTINA_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.temporizador);
  }
}
