import { Injectable } from '@nestjs/common';
import type { ProvedorDeDadosDoTitular } from '../../application/direitos-do-titular';
import {
  Consentimentos,
  type NovaDecisaoDeConsentimento,
} from '../../application/protecao-de-dados';
import {
  type DecisaoDeConsentimento,
  dependeDeAceite,
  elegivelPara,
  type Finalidade,
  type RegistroDeConsentimento,
  validarRegistro,
} from '../../domain/consentimento';
import { Relogio } from '../../domain/relogio';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';

const COLUNAS = { finalidade: true, decisao: true, origem: true, registradoEm: true } as const;

/** Histórico só de inserção; a decisão que vale é a de maior `ordem`. */
@Injectable()
export class ConsentimentosPrisma extends Consentimentos {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly relogio: Relogio,
  ) {
    super();
  }

  async registrar(decisao: NovaDecisaoDeConsentimento): Promise<RegistroDeConsentimento> {
    validarRegistro(decisao);
    const linha = await this.contexto.cliente().consentimento.create({
      data: {
        tenantId: this.contexto.tenant().id,
        alunoId: decisao.alunoId,
        finalidade: decisao.finalidade,
        decisao: decisao.decisao,
        origem: decisao.origem,
        registradoEm: this.relogio.agora(),
      },
      select: COLUNAS,
    });
    return linha as RegistroDeConsentimento;
  }

  async historico(alunoId: string): Promise<RegistroDeConsentimento[]> {
    const linhas = await this.contexto.cliente().consentimento.findMany({
      where: { alunoId },
      orderBy: { ordem: 'asc' },
      select: COLUNAS,
    });
    return linhas as RegistroDeConsentimento[];
  }

  async elegivel(alunoId: string, finalidade: Finalidade): Promise<boolean> {
    return (await this.elegiveis([alunoId], finalidade)).length === 1;
  }

  async elegiveis(alunoIds: readonly string[], finalidade: Finalidade): Promise<string[]> {
    if (!dependeDeAceite(finalidade)) {
      return [...alunoIds];
    }
    const ultimas = await this.contexto.cliente().consentimento.findMany({
      where: { alunoId: { in: [...alunoIds] }, finalidade },
      orderBy: [{ alunoId: 'asc' }, { ordem: 'desc' }],
      distinct: ['alunoId'],
      select: { alunoId: true, decisao: true },
    });
    const decisoes = new Map(
      ultimas.map((linha) => [linha.alunoId, linha.decisao as DecisaoDeConsentimento]),
    );
    return alunoIds.filter((alunoId) => elegivelPara(finalidade, decisoes.get(alunoId) ?? null));
  }
}

/** O histórico de consentimento entra na exportação do titular e sai com a exclusão. */
@Injectable()
export class ConsentimentosDoTitular implements ProvedorDeDadosDoTitular {
  readonly dominio = 'consentimentos';

  constructor(
    private readonly consentimentos: Consentimentos,
    private readonly contexto: ContextoDoTenant,
  ) {}

  exportar(alunoId: string): Promise<RegistroDeConsentimento[]> {
    return this.consentimentos.historico(alunoId);
  }

  // Sem guarda legal: o modo é sempre excluir.
  async excluirOuAnonimizar(alunoId: string): Promise<{ registros: number }> {
    const { count } = await this.contexto
      .cliente()
      .consentimento.deleteMany({ where: { alunoId } });
    return { registros: count };
  }
}
