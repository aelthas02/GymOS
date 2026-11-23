import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import { ConviteDoAdministrador } from '../platform/application/portas';
import { AceitarConvite, ConvidarParaEquipe } from './application/convites';
import {
  CredencialPeloIdentificador,
  EntrarComoAluno,
  EntrarComoEquipe,
  PortaoDeEntrada,
  PrimeiroAcessoDoAluno,
} from './application/entrada';
import { AutorizarPermissao, ModulosDoTenant, ObterPerfil } from './application/perfil';
import {
  AoNegarPermissao,
  CifraDeSenha,
  EmissorDeTokens,
  EnderecosDosApps,
  EnvioDeEmail,
  GeradorDeSegredos,
  LimiteDeTentativas,
  LocalizadorDeAlunoPorCpf,
  RepositorioDeConvites,
  RepositorioDeCredenciaisDeAluno,
  RepositorioDeModulos,
  RepositorioDeRedefinicoes,
  RepositorioDeRefresh,
  RepositorioDeTiposDeAcesso,
  RepositorioDeUsuarios,
} from './application/portas';
import {
  GerarCodigoDePrimeiroAcesso,
  RedefinirSenha,
  SolicitarRedefinicaoDeSenha,
} from './application/senhas';
import { Sessoes } from './application/sessoes';
import {
  AoNegarPermissaoNoLog,
  ConviteDoAdministradorPorEmail,
  EnderecosDaConfiguracao,
} from './infra/adapters';
import {
  CONFIGURACAO_DA_AUTENTICACAO,
  type ConfiguracaoDaAutenticacao,
  configuracaoDaAutenticacao,
} from './infra/configuracao';
import { EnvioDeEmailFake } from './infra/email/envio-de-email.fake';
import { EnvioDeEmailSmtp } from './infra/email/envio-de-email.smtp';
import { LimiteDeTentativasRedis } from './infra/limite-de-tentativas.redis';
import { LocalizadorDeAlunoIndisponivel } from './infra/localizador-de-aluno';
import {
  RepositorioDeConvitesPrisma,
  RepositorioDeCredenciaisDeAlunoPrisma,
  RepositorioDeModulosPrisma,
  RepositorioDeRedefinicoesPrisma,
  RepositorioDeRefreshPrisma,
  RepositorioDeTiposDeAcessoPrisma,
  RepositorioDeUsuariosPrisma,
} from './infra/repositorios.prisma';
import { CifraDeSenhaArgon2, EmissorDeTokensJwt, GeradorDeSegredosCripto } from './infra/seguranca';
import { AcessoGuard } from './interface/http/acesso.guard';
import {
  AutenticacaoDaEquipeController,
  AutenticacaoDoAlunoController,
} from './interface/http/autenticacao.controller';
import {
  ConvitesController,
  ModulosInternoController,
  PerfilController,
} from './interface/http/perfil.controller';

/**
 * Autenticação da equipe e do aluno, RBAC por permissão e módulos extras por plano (T12, ADR-006).
 * Global porque a plataforma usa o convite do administrador e os outros domínios, o EnvioDeEmail.
 */
@Global()
@Module({
  controllers: [
    AutenticacaoDaEquipeController,
    AutenticacaoDoAlunoController,
    PerfilController,
    ConvitesController,
    ModulosInternoController,
  ],
  providers: [
    {
      provide: CONFIGURACAO_DA_AUTENTICACAO,
      useFactory: (env: Env): ConfiguracaoDaAutenticacao => configuracaoDaAutenticacao(env),
      inject: [ENV],
    },
    { provide: RepositorioDeUsuarios, useClass: RepositorioDeUsuariosPrisma },
    { provide: RepositorioDeCredenciaisDeAluno, useClass: RepositorioDeCredenciaisDeAlunoPrisma },
    { provide: RepositorioDeTiposDeAcesso, useClass: RepositorioDeTiposDeAcessoPrisma },
    { provide: RepositorioDeConvites, useClass: RepositorioDeConvitesPrisma },
    { provide: RepositorioDeRefresh, useClass: RepositorioDeRefreshPrisma },
    { provide: RepositorioDeRedefinicoes, useClass: RepositorioDeRedefinicoesPrisma },
    { provide: RepositorioDeModulos, useClass: RepositorioDeModulosPrisma },
    { provide: LocalizadorDeAlunoPorCpf, useClass: LocalizadorDeAlunoIndisponivel },
    { provide: CifraDeSenha, useClass: CifraDeSenhaArgon2 },
    { provide: GeradorDeSegredos, useClass: GeradorDeSegredosCripto },
    { provide: EmissorDeTokens, useClass: EmissorDeTokensJwt },
    { provide: LimiteDeTentativas, useClass: LimiteDeTentativasRedis },
    { provide: AoNegarPermissao, useClass: AoNegarPermissaoNoLog },
    { provide: EnderecosDosApps, useClass: EnderecosDaConfiguracao },
    {
      provide: EnvioDeEmail,
      useFactory: (config: ConfiguracaoDaAutenticacao): EnvioDeEmail =>
        config.transporteDeEmail === 'fake' ? new EnvioDeEmailFake() : new EnvioDeEmailSmtp(config),
      inject: [CONFIGURACAO_DA_AUTENTICACAO],
    },
    { provide: ConviteDoAdministrador, useClass: ConviteDoAdministradorPorEmail },
    Sessoes,
    PortaoDeEntrada,
    CredencialPeloIdentificador,
    EntrarComoEquipe,
    EntrarComoAluno,
    PrimeiroAcessoDoAluno,
    ConvidarParaEquipe,
    AceitarConvite,
    SolicitarRedefinicaoDeSenha,
    RedefinirSenha,
    GerarCodigoDePrimeiroAcesso,
    ModulosDoTenant,
    ObterPerfil,
    AutorizarPermissao,
    { provide: APP_GUARD, useClass: AcessoGuard },
  ],
  exports: [ConviteDoAdministrador, EnvioDeEmail, GerarCodigoDePrimeiroAcesso, ModulosDoTenant],
})
export class AutenticacaoModule {}
