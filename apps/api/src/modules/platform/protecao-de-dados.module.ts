import { Global, Module, type OnModuleInit } from '@nestjs/common';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import {
  DireitosDoTitular,
  RegistroDeProvedoresDoTitular,
} from './application/direitos-do-titular';
import {
  CifraDeCampos,
  Consentimentos,
  ProvedorDeChaves,
  RegistroDeAcessoSensivel,
} from './application/protecao-de-dados';
import { RegistroDeAcessoSensivelPrisma } from './infra/protecao-de-dados/acessos-sensiveis.prisma';
import { ChavesDoTenant } from './infra/protecao-de-dados/chaves-do-tenant';
import { CifraDeCamposAesGcm } from './infra/protecao-de-dados/cifra-de-campos';
import {
  CONFIGURACAO_DA_CIFRA,
  type ConfiguracaoDaCifra,
  configuracaoDaCifra,
  ProvedorDeChavesIndisponivelError,
} from './infra/protecao-de-dados/configuracao';
import {
  ConsentimentosDoTitular,
  ConsentimentosPrisma,
} from './infra/protecao-de-dados/consentimentos.prisma';
import { ProvedorDeChavesLocal } from './infra/protecao-de-dados/provedor-de-chaves.local';

/** Sem chave local, o provedor seria o KMS, que ainda não tem adapter (staging e produção). */
export function provedorDeChaves(config: ConfiguracaoDaCifra): ProvedorDeChaves {
  if (!config.chaveMestraLocal) {
    throw new ProvedorDeChavesIndisponivelError(
      'Sem CHAVE_MESTRA_LOCAL e sem adapter do KMS: a cifra de campos não tem chave mestra.',
    );
  }
  return new ProvedorDeChavesLocal(config.chaveMestraLocal);
}

/**
 * Proteção de dados pessoais (T13c, ADR-015): cifra de campos e índice cego por tenant,
 * consentimento por finalidade, log de acesso a dado sensível e direitos do titular.
 */
@Global()
@Module({
  providers: [
    {
      provide: CONFIGURACAO_DA_CIFRA,
      useFactory: (env: Env): ConfiguracaoDaCifra => configuracaoDaCifra(env),
      inject: [ENV],
    },
    { provide: ProvedorDeChaves, useFactory: provedorDeChaves, inject: [CONFIGURACAO_DA_CIFRA] },
    ChavesDoTenant,
    { provide: CifraDeCampos, useClass: CifraDeCamposAesGcm },
    { provide: RegistroDeAcessoSensivel, useClass: RegistroDeAcessoSensivelPrisma },
    { provide: Consentimentos, useClass: ConsentimentosPrisma },
    ConsentimentosDoTitular,
    RegistroDeProvedoresDoTitular,
    DireitosDoTitular,
  ],
  exports: [
    CifraDeCampos,
    Consentimentos,
    ChavesDoTenant,
    RegistroDeProvedoresDoTitular,
    DireitosDoTitular,
  ],
})
export class ProtecaoDeDadosModule implements OnModuleInit {
  constructor(
    private readonly registro: RegistroDeProvedoresDoTitular,
    private readonly consentimentos: ConsentimentosDoTitular,
  ) {}

  onModuleInit(): void {
    this.registro.registrar(this.consentimentos);
  }
}
