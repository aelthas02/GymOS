import { Injectable } from '@nestjs/common';
import { ehDataCivil } from '../../alunos/domain/datas';
import { type Executor, RegistroDeAtividade } from '../../alunos/application/autoria';
import type { DataCivil } from '../../platform/domain/relogio';
import { SETORES, type Setor } from '../domain/financeiro';
import { LancamentoInvalidoError } from './erros';
import { Financeiro } from './financeiro';
import {
  CATEGORIAS_DE_LANCAMENTO,
  type CategoriaDeLancamento,
  type Lancamento,
  RepositorioDeLancamentos,
  TIPOS_DE_LANCAMENTO,
  type TipoDeLancamento,
} from './portas';

export interface EntradaDoLancamento {
  tipo: TipoDeLancamento;
  categoria: CategoriaDeLancamento;
  setor?: Setor | null;
  valorCentavos: number;
  data: string;
  unidadeId?: string;
  descricao?: string | null;
}

/** Despesas e receitas avulsas (T21). A folha não é lançamento: vem do custo do Funcionário (T26a). */
@Injectable()
export class Lancamentos {
  constructor(
    private readonly repositorio: RepositorioDeLancamentos,
    private readonly financeiro: Financeiro,
    private readonly atividade: RegistroDeAtividade,
  ) {}

  async registrar(executor: Executor, entrada: EntradaDoLancamento): Promise<Lancamento> {
    if (!TIPOS_DE_LANCAMENTO.includes(entrada.tipo)) {
      throw new LancamentoInvalidoError('Tipo de lançamento inválido.');
    }
    if (!CATEGORIAS_DE_LANCAMENTO.includes(entrada.categoria)) {
      throw new LancamentoInvalidoError('Categoria inválida: use Aluguel, Contas ou Outros.');
    }
    if (!Number.isSafeInteger(entrada.valorCentavos) || entrada.valorCentavos <= 0) {
      throw new LancamentoInvalidoError('O valor precisa ser maior que zero.');
    }
    if (!ehDataCivil(entrada.data)) {
      throw new LancamentoInvalidoError('Data inválida.');
    }
    const setor = entrada.setor ?? null;
    if (setor !== null && !SETORES.includes(setor)) {
      throw new LancamentoInvalidoError('Setor inválido.');
    }
    if (entrada.tipo === 'receita' && setor === null) {
      throw new LancamentoInvalidoError('Escolha o setor que recebe a receita.');
    }
    const unidadeId = entrada.unidadeId ?? (await this.repositorio.unidadePadrao());
    if (!(await this.repositorio.unidadeExiste(unidadeId))) {
      throw new LancamentoInvalidoError('Unidade inexistente.');
    }

    const lancamento = await this.repositorio.criar({
      tipo: entrada.tipo,
      categoria: entrada.categoria,
      setor,
      valorCentavos: entrada.valorCentavos,
      data: entrada.data as DataCivil,
      unidadeId,
      descricao: entrada.descricao?.trim() || null,
      criadoPor: executor.usuarioId,
    });
    await this.atividade.registrar(executor, {
      acao: 'registrou-lancamento',
      detalhe: `${entrada.tipo === 'despesa' ? 'Despesa' : 'Receita'} de ${this.rotuloDaCategoria(
        entrada.categoria,
      )} em ${entrada.data}`,
    });
    // O resumo e as visões em cache já não valem: a geração do cache muda.
    await this.financeiro.invalidarCache();
    return lancamento;
  }

  listar(de: string, ate: string): Promise<Lancamento[]> {
    if (!ehDataCivil(de) || !ehDataCivil(ate) || de > ate) {
      throw new LancamentoInvalidoError('Período inválido.');
    }
    return this.repositorio.doPeriodo(de as DataCivil, ate as DataCivil, {});
  }

  private rotuloDaCategoria(categoria: CategoriaDeLancamento): string {
    return { aluguel: 'aluguel', contas: 'contas', outros: 'outros' }[categoria];
  }
}
