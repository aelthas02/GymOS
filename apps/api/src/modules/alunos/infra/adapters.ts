import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { Parcelas } from '../../cobranca/application/parcelas';
import type { ProvedorDeDadosDoTitular } from '../../platform/application/direitos-do-titular';
import { ExecutorDeTenant } from '../../platform/infra/contexto/executor-de-tenant';
import {
  CONFIGURACAO_DAS_FILAS,
  type ConfiguracaoDasFilas,
} from '../../platform/infra/filas/configuracao-das-filas';
import { Contratos } from '../application/contratos';
import {
  ParcelasDoContrato,
  RepositorioDeAlunos,
  RepositorioDeContratos,
  type SituacaoDasParcelas,
} from '../application/portas';

/**
 * As parcelas vêm da Cobrança (T19). Contrato sem parcelas (anterior ao T19) devolve `null`, e os
 * consumidores usam o que o evento informa.
 */
@Injectable()
export class ParcelasDaCobranca extends ParcelasDoContrato {
  constructor(private readonly parcelas: Parcelas) {
    super();
  }

  situacao(contratoId: string): Promise<SituacaoDasParcelas | null> {
    return this.parcelas.situacaoDoContrato(contratoId);
  }
}

/** LGPD (T13c): o cadastro e os contratos do aluno; a exclusão leva também a credencial do app. */
@Injectable()
export class DadosDoTitularDosAlunos implements ProvedorDeDadosDoTitular {
  readonly dominio = 'alunos';

  constructor(
    private readonly alunos: RepositorioDeAlunos,
    private readonly contratos: RepositorioDeContratos,
  ) {}

  async exportar(alunoId: string): Promise<unknown> {
    return {
      aluno: await this.alunos.porId(alunoId, 'sistema:direitos-do-titular'),
      contratos: await this.contratos.doAluno(alunoId),
    };
  }

  async excluirOuAnonimizar(alunoId: string): Promise<{ registros: number }> {
    return { registros: await this.alunos.excluir(alunoId) };
  }
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Rotina diária dos contratos (renovação automática e transições pelo tempo), um runAsTenant por
 * academia. Como a limpeza da auditoria, roda ao subir e a cada 24 h só com `FILAS_PROCESSAR`; é
 * idempotente.
 */
@Injectable()
export class RotinaDosContratos implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RotinaDosContratos.name);
  private temporizador?: NodeJS.Timeout;

  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly contratos: Contratos,
    @Optional()
    @Inject(CONFIGURACAO_DAS_FILAS)
    private readonly filas?: ConfiguracaoDasFilas,
  ) {}

  async executar(): Promise<number> {
    const alterados = await this.executor.paraCadaTenant(() => this.contratos.rotinaDiaria());
    return alterados.reduce((total, quantos) => total + quantos, 0);
  }

  onApplicationBootstrap(): void {
    if (!this.filas?.processar) {
      return;
    }
    const rodar = (): void => {
      this.executar().then(
        (total) => this.logger.log({ total }, 'Rotina diária dos contratos executada'),
        (err: unknown) => this.logger.error({ err }, 'Falha na rotina diária dos contratos'),
      );
    };
    rodar();
    this.temporizador = setInterval(rodar, UM_DIA_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.temporizador);
  }
}
