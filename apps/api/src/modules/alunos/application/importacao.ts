import { Injectable } from '@nestjs/common';
import { somenteDigitos, validarCpf } from '@gymos/shared-validation';
import type { DataCivil } from '../../platform/domain/relogio';
import { AlunoInvalidoError, Alunos } from './alunos';
import { type Executor, RegistroDeAtividade } from './autoria';
import { RepositorioDeAlunos, RepositorioDePlanos } from './portas';

export interface LinhaDaPlanilha {
  nome: string;
  cpf: string;
  telefone?: string | null;
  email?: string | null;
  dataNascimento?: DataCivil | null;
  /** Nome do plano, como está cadastrado (sem diferença de maiúsculas). */
  plano?: string | null;
  inicioDoContrato?: DataCivil | null;
}

/** `pulada`: o aluno não foi criado; `para_corrigir`: criado sem contrato (plano inexistente). */
export interface LinhaDoRelatorio {
  /** Número da linha na planilha, a partir de 1 (sem o cabeçalho). */
  linha: number;
  nome: string;
  cpf: string;
  situacao: 'pulada' | 'para_corrigir';
  motivo: string;
}

export interface RelatorioDaImportacao {
  criados: number;
  comContrato: number;
  semContrato: number;
  linhas: LinhaDoRelatorio[];
}

export const MOTIVOS_DA_IMPORTACAO = {
  cpfInvalido: 'CPF inválido',
  jaCadastrado: 'CPF já cadastrado',
  repetido: 'CPF repetido na planilha',
} as const;

/**
 * Importação em lote (Importar alunos no T16, Primeiros passos no T17). Cada linha é independente:
 * CPF inválido, já cadastrado ou repetido na planilha é pulado com o motivo; plano inexistente cria o
 * aluno sem contrato e entra em "para corrigir". Reimportar a mesma planilha não duplica ninguém.
 */
@Injectable()
export class ImportarAlunos {
  constructor(
    private readonly alunos: Alunos,
    private readonly repositorio: RepositorioDeAlunos,
    private readonly planos: RepositorioDePlanos,
    private readonly atividade: RegistroDeAtividade,
  ) {}

  async executar(
    executor: Executor | null,
    linhas: readonly LinhaDaPlanilha[],
  ): Promise<RelatorioDaImportacao> {
    const relatorio: RelatorioDaImportacao = {
      criados: 0,
      comContrato: 0,
      semContrato: 0,
      linhas: [],
    };
    const vistos = new Set<string>();
    const planos = new Map<string, { id: string; ativo: boolean } | null>();
    const pular = (numero: number, linha: LinhaDaPlanilha, motivo: string): void => {
      relatorio.linhas.push({
        linha: numero,
        nome: linha.nome,
        cpf: linha.cpf,
        situacao: 'pulada',
        motivo,
      });
    };

    for (const [indice, linha] of linhas.entries()) {
      const numero = indice + 1;
      if (!validarCpf(linha.cpf)) {
        pular(numero, linha, MOTIVOS_DA_IMPORTACAO.cpfInvalido);
        continue;
      }
      const cpf = somenteDigitos(linha.cpf);
      if (vistos.has(cpf)) {
        pular(numero, linha, MOTIVOS_DA_IMPORTACAO.repetido);
        continue;
      }
      vistos.add(cpf);
      if (await this.repositorio.idPorCpf(cpf)) {
        pular(numero, linha, MOTIVOS_DA_IMPORTACAO.jaCadastrado);
        continue;
      }
      const nomeDoPlano = linha.plano?.trim() ?? '';
      let planoId: string | null = null;
      let problemaDoPlano = '';
      if (nomeDoPlano !== '') {
        const chave = nomeDoPlano.toLowerCase();
        if (!planos.has(chave)) {
          planos.set(chave, await this.planos.porNome(nomeDoPlano));
        }
        const plano = planos.get(chave) ?? null;
        planoId = plano?.ativo ? plano.id : null;
        problemaDoPlano = plano ? 'inativo para venda' : 'não encontrado';
      }
      try {
        await this.alunos.cadastrar(null, {
          nome: linha.nome,
          cpf,
          telefone: linha.telefone ?? null,
          email: linha.email ?? null,
          dataNascimento: linha.dataNascimento ?? null,
          professorId: null,
          meta: null,
          restricoes: null,
          leadId: null,
          ...(planoId ? { planoId } : {}),
          ...(linha.inicioDoContrato ? { inicioDoContrato: linha.inicioDoContrato } : {}),
        });
      } catch (erro) {
        if (erro instanceof AlunoInvalidoError) {
          pular(numero, linha, erro.message);
          continue;
        }
        throw erro;
      }
      relatorio.criados += 1;
      if (planoId) {
        relatorio.comContrato += 1;
        continue;
      }
      relatorio.semContrato += 1;
      if (nomeDoPlano !== '') {
        relatorio.linhas.push({
          linha: numero,
          nome: linha.nome,
          cpf: linha.cpf,
          situacao: 'para_corrigir',
          motivo: `Plano "${nomeDoPlano}" ${problemaDoPlano}: aluno criado sem contrato`,
        });
      }
    }

    if (executor && relatorio.criados > 0) {
      await this.atividade.registrar(executor, {
        acao: 'cadastrou-aluno',
        detalhe: `Importação de planilha: ${relatorio.criados} ${relatorio.criados === 1 ? 'aluno' : 'alunos'}`,
      });
    }
    return relatorio;
  }
}
