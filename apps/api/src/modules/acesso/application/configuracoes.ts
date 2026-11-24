import { Injectable } from '@nestjs/common';
import { type ConfiguracaoDeAcesso, validarConfiguracaoDeAcesso } from '@gymos/shared-acesso';
import { type ConfiguracaoDeAlertas, validarConfiguracaoDeAlertas } from '../domain/alerta';
import { type Executor, AutoriaDoAcesso } from './autoria';
import { RegistroDeAcessoInvalidoError } from './erros';
import { RepositorioDeConfiguracaoDeAcesso, RepositorioDeConfiguracaoDeAlertas } from './portas';

/** "Regras de acesso" da tela Acesso e catraca: bloqueio por atraso, horário, limite e anti-passback. */
@Injectable()
export class ConfiguracoesDoAcesso {
  constructor(
    private readonly repositorio: RepositorioDeConfiguracaoDeAcesso,
    private readonly autoria: AutoriaDoAcesso,
  ) {}

  obter(): Promise<ConfiguracaoDeAcesso> {
    return this.repositorio.obter();
  }

  async salvar(executor: Executor, nova: ConfiguracaoDeAcesso): Promise<ConfiguracaoDeAcesso> {
    const erro = validarConfiguracaoDeAcesso(nova);
    if (erro) {
      throw new RegistroDeAcessoInvalidoError(erro);
    }
    await this.repositorio.salvar(nova);
    await this.autoria.registrar(executor, {
      acao: 'alterou-regras-de-acesso',
      detalhe:
        `Bloqueio por atraso: ${nova.bloqueioPorAtrasoDias === null ? 'desligado' : `após ${nova.bloqueioPorAtrasoDias} dias`}; ` +
        `horário ${nova.abertura} às ${nova.fechamento}; ` +
        `limite por dia: ${nova.limitePorDia ?? 'sem limite'}; anti-passback ${nova.antiPassback ? 'ativo' : 'desligado'}`,
    });
    return nova;
  }
}

/** Bloco "Alertas de frequência" de Configurações. */
@Injectable()
export class ConfiguracoesDosAlertas {
  constructor(
    private readonly repositorio: RepositorioDeConfiguracaoDeAlertas,
    private readonly autoria: AutoriaDoAcesso,
  ) {}

  obter(): Promise<ConfiguracaoDeAlertas> {
    return this.repositorio.obter();
  }

  async salvar(executor: Executor, nova: ConfiguracaoDeAlertas): Promise<ConfiguracaoDeAlertas> {
    validarConfiguracaoDeAlertas(nova);
    await this.repositorio.salvar(nova);
    await this.autoria.registrar(executor, {
      acao: 'alterou-alertas-de-frequencia',
      detalhe:
        `Sem treinar por ${nova.diasSemTreinar} dias, urgente após ${nova.urgenteAposDias}, ` +
        `queda de ${nova.quedaPercentual}%; verificação às ${nova.horaDaVerificacao}`,
    });
    return nova;
  }
}
