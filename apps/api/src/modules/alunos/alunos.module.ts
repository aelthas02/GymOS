import { Module, type OnModuleInit } from '@nestjs/common';
import { RegistroDeProvedoresDoTitular } from '../platform/application/direitos-do-titular';
import { dataCivilEm, FUSO_PADRAO } from '../platform/domain/relogio';
import { RegistroDeConsumidores } from '../platform/infra/eventos/registro-de-consumidores';
import { Alunos } from './application/alunos';
import { RegistroDeAtividade } from './application/autoria';
import { ConfiguracaoDosContratos, Contratos } from './application/contratos';
import { ImportarAlunos } from './application/importacao';
import { Planos } from './application/planos';
import {
  ParcelasDoContrato,
  RepositorioDeAlunos,
  RepositorioDeConfiguracao,
  RepositorioDeContratos,
  RepositorioDePlanos,
} from './application/portas';
import { CobrancaModule } from '../cobranca/cobranca.module';
import { DadosDoTitularDosAlunos, ParcelasDaCobranca, RotinaDosContratos } from './infra/adapters';
import {
  RepositorioDeAlunosPrisma,
  RepositorioDeConfiguracaoPrisma,
  RepositorioDeContratosPrisma,
  RepositorioDePlanosPrisma,
} from './infra/repositorios.prisma';
import { AlunosController, ContratoDoAppController } from './interface/http/alunos.controller';
import {
  ConfiguracaoDeContratosController,
  PlanosController,
} from './interface/http/planos.controller';

/**
 * Alunos, planos e contratos (T15a, ADR-018). Reavalia o contrato a cada PagamentoConfirmado,
 * PagamentoAtrasado, PagamentoEstornado e VencimentoCombinado da cobrança (T19), lendo as parcelas
 * pela porta ParcelasDoContrato, e registra os dados do titular para a LGPD (T13c).
 */
@Module({
  imports: [CobrancaModule],
  controllers: [
    AlunosController,
    ContratoDoAppController,
    PlanosController,
    ConfiguracaoDeContratosController,
  ],
  providers: [
    { provide: RepositorioDePlanos, useClass: RepositorioDePlanosPrisma },
    { provide: RepositorioDeAlunos, useClass: RepositorioDeAlunosPrisma },
    { provide: RepositorioDeContratos, useClass: RepositorioDeContratosPrisma },
    { provide: RepositorioDeConfiguracao, useClass: RepositorioDeConfiguracaoPrisma },
    { provide: ParcelasDoContrato, useClass: ParcelasDaCobranca },
    RegistroDeAtividade,
    Contratos,
    ConfiguracaoDosContratos,
    Planos,
    Alunos,
    ImportarAlunos,
    DadosDoTitularDosAlunos,
    RotinaDosContratos,
  ],
  exports: [Alunos, ImportarAlunos, Contratos, Planos, RepositorioDeAlunos],
})
export class AlunosModule implements OnModuleInit {
  constructor(
    private readonly consumidores: RegistroDeConsumidores,
    private readonly titular: RegistroDeProvedoresDoTitular,
    private readonly dadosDoTitular: DadosDoTitularDosAlunos,
    private readonly contratos: Contratos,
  ) {}

  onModuleInit(): void {
    this.titular.registrar(this.dadosDoTitular);
    this.consumidores.registrar({
      nome: 'alunos.reavaliar-contrato-pago',
      evento: 'PagamentoConfirmado',
      tratar: (evento) =>
        this.contratos.aoConfirmarPagamento(
          evento.payload.alunoId,
          dataCivilEm(new Date(evento.payload.confirmadoEm), FUSO_PADRAO),
        ),
    });
    this.consumidores.registrar({
      nome: 'alunos.reavaliar-contrato-atrasado',
      evento: 'PagamentoAtrasado',
      tratar: (evento) =>
        this.contratos.aoAtrasarPagamento(
          evento.payload.alunoId,
          evento.payload.vencimento as Parameters<Contratos['aoAtrasarPagamento']>[1],
        ),
    });
    this.consumidores.registrar({
      nome: 'alunos.reavaliar-contrato-nova-data',
      evento: 'VencimentoCombinado',
      tratar: (evento) => this.contratos.aoMudarParcelas(evento.payload.alunoId),
    });
    this.consumidores.registrar({
      nome: 'alunos.reavaliar-contrato-estornado',
      evento: 'PagamentoEstornado',
      tratar: (evento) => this.contratos.aoMudarParcelas(evento.payload.alunoId),
    });
  }
}
