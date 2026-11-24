import { Injectable } from '@nestjs/common';
import { Relogio } from '../domain/relogio';

/** Guarda exigida por lei (ex.: notas fiscais, 5 anos): o domínio só anonimiza o que a lei permite. */
export interface Retencao {
  motivo: string;
  prazoEmAnos: number;
}

export type ModoDeExclusao = 'excluir' | 'anonimizar';

/**
 * Dados de um domínio sobre o titular (LGPD, arts. 18 e 16). Cada domínio que guarda dado de aluno
 * implementa e registra no onModuleInit; com `retencao`, a exclusão chega como `anonimizar`.
 */
export interface ProvedorDeDadosDoTitular {
  /** Nome estável do domínio, chave da exportação e do relatório. */
  readonly dominio: string;
  readonly retencao?: Retencao;
  /** Tudo o que o domínio guarda do titular, serializável em JSON. */
  exportar(alunoId: string): Promise<unknown>;
  /** Exclui (ou anonimiza, no modo `anonimizar`) e devolve quantos registros alterou. */
  excluirOuAnonimizar(alunoId: string, modo: ModoDeExclusao): Promise<{ registros: number }>;
}

export class ProvedorDoTitularDuplicadoError extends Error {
  constructor(dominio: string) {
    super(`Provedor de dados do titular do domínio ${dominio} registrado duas vezes.`);
    this.name = 'ProvedorDoTitularDuplicadoError';
  }
}

@Injectable()
export class RegistroDeProvedoresDoTitular {
  private readonly porDominio = new Map<string, ProvedorDeDadosDoTitular>();

  registrar(provedor: ProvedorDeDadosDoTitular): void {
    if (this.porDominio.has(provedor.dominio)) {
      throw new ProvedorDoTitularDuplicadoError(provedor.dominio);
    }
    this.porDominio.set(provedor.dominio, provedor);
  }

  provedores(): ProvedorDeDadosDoTitular[] {
    return [...this.porDominio.values()];
  }
}

export interface ExportacaoDoTitular {
  alunoId: string;
  geradaEm: string;
  dominios: Record<string, unknown>;
}

export interface ExclusaoNoDominio {
  dominio: string;
  modo: ModoDeExclusao;
  registros: number;
  retencao?: Retencao;
}

export interface RelatorioDeExclusao {
  alunoId: string;
  executadaEm: string;
  dominios: ExclusaoNoDominio[];
}

/**
 * Orquestra os direitos do titular no tenant do contexto. Roda na transação da requisição (ou do
 * runAsTenant): se um domínio falha, nada é excluído.
 */
@Injectable()
export class DireitosDoTitular {
  constructor(
    private readonly registro: RegistroDeProvedoresDoTitular,
    private readonly relogio: Relogio,
  ) {}

  async exportar(alunoId: string): Promise<ExportacaoDoTitular> {
    const dominios: Record<string, unknown> = {};
    for (const provedor of this.registro.provedores()) {
      dominios[provedor.dominio] = await provedor.exportar(alunoId);
    }
    return { alunoId, geradaEm: this.relogio.agora().toISOString(), dominios };
  }

  async excluir(alunoId: string): Promise<RelatorioDeExclusao> {
    const dominios: ExclusaoNoDominio[] = [];
    for (const provedor of this.registro.provedores()) {
      const modo: ModoDeExclusao = provedor.retencao ? 'anonimizar' : 'excluir';
      const { registros } = await provedor.excluirOuAnonimizar(alunoId, modo);
      dominios.push({
        dominio: provedor.dominio,
        modo,
        registros,
        ...(provedor.retencao ? { retencao: provedor.retencao } : {}),
      });
    }
    return { alunoId, executadaEm: this.relogio.agora().toISOString(), dominios };
  }
}
