import { Injectable } from '@nestjs/common';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  type Convite,
  type CredencialDoAluno,
  type RedefinicaoDeSenha,
  RepositorioDeConvites,
  RepositorioDeCredenciaisDeAluno,
  RepositorioDeModulos,
  RepositorioDeRedefinicoes,
  RepositorioDeRefresh,
  RepositorioDeTiposDeAcesso,
  RepositorioDeUsuarios,
  type TokenDeRefresh,
  type Usuario,
} from '../application/portas';
import type { Publico } from '../domain/credenciais';
import type { Sobrescritas } from '../domain/modulos-do-plano';
import { ehModuloExtra, ehPermissao, type ModuloExtra } from '../domain/permissoes';
import type { TipoDeAcesso, TipoPadrao } from '../domain/tipos-de-acesso';

// Repositórios do domínio de autenticação: todos usam o cliente da transação do tenant (RLS).

interface LinhaDoTipo {
  id: string;
  chave: string | null;
  nome: string;
  permissoes: string[];
}

function tipoDaLinha(linha: LinhaDoTipo): TipoDeAcesso {
  // Permissão fora do catálogo (módulo removido) é ignorada, nunca concedida.
  return {
    id: linha.id,
    chave: linha.chave,
    nome: linha.nome,
    permissoes: linha.permissoes.filter(ehPermissao),
  };
}

const comTipo = { tipoDeAcesso: true } as const;

@Injectable()
export class RepositorioDeUsuariosPrisma extends RepositorioDeUsuarios {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async porEmail(email: string): Promise<Usuario | null> {
    const linha = await this.contexto
      .cliente()
      .usuario.findFirst({ where: { email }, include: comTipo });
    return linha && { ...linha, tipoDeAcesso: tipoDaLinha(linha.tipoDeAcesso) };
  }

  async porId(id: string): Promise<Usuario | null> {
    const linha = await this.contexto
      .cliente()
      .usuario.findFirst({ where: { id }, include: comTipo });
    return linha && { ...linha, tipoDeAcesso: tipoDaLinha(linha.tipoDeAcesso) };
  }

  async criar(dados: {
    nome: string;
    email: string;
    senhaHash: string;
    tipoDeAcessoId: string;
  }): Promise<Usuario> {
    const linha = await this.contexto.cliente().usuario.create({
      data: { ...dados, tenantId: this.contexto.tenant().id },
      include: comTipo,
    });
    return { ...linha, tipoDeAcesso: tipoDaLinha(linha.tipoDeAcesso) };
  }

  async definirSenha(id: string, senhaHash: string): Promise<void> {
    await this.contexto.cliente().usuario.updateMany({ where: { id }, data: { senhaHash } });
  }
}

const camposDaCredencial = {
  id: true,
  alunoId: true,
  email: true,
  senhaHash: true,
  codigoHash: true,
  codigoExpiraEm: true,
} as const;

@Injectable()
export class RepositorioDeCredenciaisDeAlunoPrisma extends RepositorioDeCredenciaisDeAluno {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  porAluno(alunoId: string): Promise<CredencialDoAluno | null> {
    return this.contexto
      .cliente()
      .credencialAluno.findFirst({ where: { alunoId }, select: camposDaCredencial });
  }

  porEmail(email: string): Promise<CredencialDoAluno | null> {
    return this.contexto
      .cliente()
      .credencialAluno.findFirst({ where: { email }, select: camposDaCredencial });
  }

  salvar(
    dados: Pick<CredencialDoAluno, 'alunoId'> & Partial<Omit<CredencialDoAluno, 'id' | 'alunoId'>>,
  ): Promise<CredencialDoAluno> {
    const tenantId = this.contexto.tenant().id;
    const { alunoId, ...campos } = dados;
    return this.contexto.cliente().credencialAluno.upsert({
      where: { tenantId_alunoId: { tenantId, alunoId } },
      create: { tenantId, alunoId, ...campos },
      update: campos,
      select: camposDaCredencial,
    });
  }
}

@Injectable()
export class RepositorioDeTiposDeAcessoPrisma extends RepositorioDeTiposDeAcesso {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async porId(id: string): Promise<TipoDeAcesso | null> {
    const linha = await this.contexto.cliente().tipoDeAcesso.findFirst({ where: { id } });
    return linha && tipoDaLinha(linha);
  }

  async porChave(chave: string): Promise<TipoDeAcesso | null> {
    const linha = await this.contexto.cliente().tipoDeAcesso.findFirst({ where: { chave } });
    return linha && tipoDaLinha(linha);
  }

  async garantirPadrao(padrao: readonly TipoPadrao[]): Promise<void> {
    await this.contexto.cliente().tipoDeAcesso.createMany({
      data: padrao.map((tipo) => ({
        tenantId: this.contexto.tenant().id,
        chave: tipo.chave,
        nome: tipo.nome,
        permissoes: [...tipo.permissoes],
      })),
      skipDuplicates: true,
    });
  }
}

const camposDoConvite = {
  id: true,
  email: true,
  nome: true,
  tipoDeAcessoId: true,
  expiraEm: true,
  usadoEm: true,
} as const;

@Injectable()
export class RepositorioDeConvitesPrisma extends RepositorioDeConvites {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  criar(dados: Omit<Convite, 'id' | 'usadoEm'> & { tokenHash: string }): Promise<Convite> {
    return this.contexto.cliente().convite.create({
      data: { ...dados, tenantId: this.contexto.tenant().id },
      select: camposDoConvite,
    });
  }

  porTokenHash(tokenHash: string): Promise<Convite | null> {
    return this.contexto
      .cliente()
      .convite.findFirst({ where: { tokenHash }, select: camposDoConvite });
  }

  async marcarUsado(id: string, quando: Date): Promise<void> {
    await this.contexto.cliente().convite.updateMany({ where: { id }, data: { usadoEm: quando } });
  }
}

@Injectable()
export class RepositorioDeRefreshPrisma extends RepositorioDeRefresh {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(
    dados: Omit<TokenDeRefresh, 'id' | 'usadoEm' | 'revogadoEm'> & { tokenHash: string },
  ): Promise<void> {
    await this.contexto.cliente().tokenDeRefresh.create({
      data: { ...dados, tenantId: this.contexto.tenant().id },
    });
  }

  async porTokenHash(tokenHash: string): Promise<TokenDeRefresh | null> {
    const linha = await this.contexto.cliente().tokenDeRefresh.findFirst({
      where: { tokenHash },
      select: {
        id: true,
        familiaId: true,
        publico: true,
        sujeitoId: true,
        expiraEm: true,
        usadoEm: true,
        revogadoEm: true,
      },
    });
    return linha && { ...linha, publico: linha.publico as Publico };
  }

  async marcarUsado(id: string, quando: Date): Promise<boolean> {
    const { count } = await this.contexto.cliente().tokenDeRefresh.updateMany({
      where: { id, usadoEm: null, revogadoEm: null },
      data: { usadoEm: quando },
    });
    return count === 1;
  }

  async revogarFamilia(familiaId: string, quando: Date): Promise<void> {
    await this.contexto.cliente().tokenDeRefresh.updateMany({
      where: { familiaId, revogadoEm: null },
      data: { revogadoEm: quando },
    });
  }

  async revogarDoSujeito(publico: Publico, sujeitoId: string, quando: Date): Promise<void> {
    await this.contexto.cliente().tokenDeRefresh.updateMany({
      where: { publico, sujeitoId, revogadoEm: null },
      data: { revogadoEm: quando },
    });
  }
}

@Injectable()
export class RepositorioDeRedefinicoesPrisma extends RepositorioDeRedefinicoes {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(
    dados: Omit<RedefinicaoDeSenha, 'id' | 'usadoEm'> & { tokenHash: string },
  ): Promise<void> {
    await this.contexto.cliente().redefinicaoDeSenha.create({
      data: { ...dados, tenantId: this.contexto.tenant().id },
    });
  }

  async porTokenHash(tokenHash: string): Promise<RedefinicaoDeSenha | null> {
    const linha = await this.contexto.cliente().redefinicaoDeSenha.findFirst({
      where: { tokenHash },
      select: { id: true, publico: true, sujeitoId: true, expiraEm: true, usadoEm: true },
    });
    return linha && { ...linha, publico: linha.publico as Publico };
  }

  async marcarUsada(id: string, quando: Date): Promise<void> {
    await this.contexto
      .cliente()
      .redefinicaoDeSenha.updateMany({ where: { id }, data: { usadoEm: quando } });
  }
}

@Injectable()
export class RepositorioDeModulosPrisma extends RepositorioDeModulos {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async sobrescritas(): Promise<Sobrescritas> {
    const linhas = await this.contexto.cliente().moduloDoTenant.findMany();
    return Object.fromEntries(
      linhas.filter((linha) => ehModuloExtra(linha.modulo)).map((l) => [l.modulo, l.ativo]),
    );
  }

  async sobrescrever(modulo: ModuloExtra, ativo: boolean | null): Promise<void> {
    const cliente = this.contexto.cliente();
    if (ativo === null) {
      await cliente.moduloDoTenant.deleteMany({ where: { modulo } });
      return;
    }
    const tenantId = this.contexto.tenant().id;
    await cliente.moduloDoTenant.upsert({
      where: { tenantId_modulo: { tenantId, modulo } },
      create: { tenantId, modulo, ativo },
      update: { ativo },
    });
  }
}
