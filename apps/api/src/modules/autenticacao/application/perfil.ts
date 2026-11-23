import { Injectable } from '@nestjs/common';
import type { Tenant } from '../../platform/domain/tenant';
import { modulosAtivos } from '../domain/modulos-do-plano';
import type { ModuloExtra, Permissao } from '../domain/permissoes';
import { permissoesEfetivas, podeEntrarNoPainel, temPermissao } from '../domain/tipos-de-acesso';
import {
  type ReivindicacoesDoAcesso,
  RepositorioDeCredenciaisDeAluno,
  RepositorioDeModulos,
  RepositorioDeUsuarios,
  type Usuario,
} from './portas';

/** Módulos extras ligados no tenant: os do plano contratado com a sobrescrita manual. */
@Injectable()
export class ModulosDoTenant {
  constructor(private readonly modulos: RepositorioDeModulos) {}

  async ativos(tenant: Tenant): Promise<ModuloExtra[]> {
    return modulosAtivos(tenant.plano, await this.modulos.sobrescritas());
  }

  async ativo(tenant: Tenant, modulo: ModuloExtra): Promise<boolean> {
    return (await this.ativos(tenant)).includes(modulo);
  }
}

export interface Perfil {
  tipo: 'staff' | 'aluno';
  id: string;
  nome: string | null;
  email: string | null;
  tipoDeAcesso: { id: string; nome: string } | null;
  permissoes: Permissao[];
  modulos: ModuloExtra[];
}

/** O que o front precisa para `appPermission`, `appFeatureFlag` e o menu lateral (GET /me). */
@Injectable()
export class ObterPerfil {
  constructor(
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly credenciais: RepositorioDeCredenciaisDeAluno,
    private readonly modulos: ModulosDoTenant,
  ) {}

  async executar(tenant: Tenant, sessao: ReivindicacoesDoAcesso): Promise<Perfil | null> {
    const modulos = await this.modulos.ativos(tenant);
    if (sessao.publico === 'aluno') {
      const credencial = await this.credenciais.porAluno(sessao.sujeitoId);
      return credencial
        ? {
            tipo: 'aluno',
            id: credencial.alunoId,
            nome: null,
            email: credencial.email,
            tipoDeAcesso: null,
            permissoes: [],
            modulos,
          }
        : null;
    }
    const usuario = await this.usuarios.porId(sessao.sujeitoId);
    if (!usuarioComAcesso(usuario)) {
      return null;
    }
    return {
      tipo: 'staff',
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipoDeAcesso: { id: usuario.tipoDeAcesso.id, nome: usuario.tipoDeAcesso.nome },
      permissoes: permissoesEfetivas(usuario.tipoDeAcesso),
      modulos,
    };
  }
}

function usuarioComAcesso(usuario: Usuario | null): usuario is Usuario {
  return usuario !== null && usuario.ativo && podeEntrarNoPainel(usuario.tipoDeAcesso);
}

export type Autorizacao = 'permitido' | 'negado' | 'sem-sessao';

/** Confere a permissão no banco a cada requisição: mudança de tipo vale na hora, sem novo login. */
@Injectable()
export class AutorizarPermissao {
  constructor(private readonly usuarios: RepositorioDeUsuarios) {}

  async executar(sessao: ReivindicacoesDoAcesso, permissao: Permissao): Promise<Autorizacao> {
    if (sessao.publico !== 'staff') {
      return 'negado';
    }
    const usuario = await this.usuarios.porId(sessao.sujeitoId);
    if (!usuarioComAcesso(usuario)) {
      return 'sem-sessao';
    }
    return temPermissao(usuario.tipoDeAcesso, permissao) ? 'permitido' : 'negado';
  }
}
