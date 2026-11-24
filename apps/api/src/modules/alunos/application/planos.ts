import { Injectable } from '@nestjs/common';
import { Relogio } from '../../platform/domain/relogio';
import {
  type DadosDoPlano,
  detalheDaAlteracaoDeValor,
  explicacaoDoPlano,
  type Plano,
  validarPlano,
  valorDasParcelas,
  type ValorDasParcelas,
} from '../domain/plano';
import { type Executor, RegistroDeAtividade } from './autoria';
import { ConflitoError, NaoEncontradoError } from './erros';
import { type PlanoComAlunos, RepositorioDePlanos } from './portas';

export interface PreviaDoPlano extends ValorDasParcelas {
  explicacao: string;
}

/** Cadastro, edição, inativação e exclusão de planos (tela Planos, T15b). */
@Injectable()
export class Planos {
  constructor(
    private readonly planos: RepositorioDePlanos,
    private readonly atividade: RegistroDeAtividade,
    private readonly relogio: Relogio,
  ) {}

  listar(busca?: string): Promise<PlanoComAlunos[]> {
    return this.planos.listar(busca);
  }

  async obter(id: string): Promise<Plano> {
    const plano = await this.planos.porId(id);
    if (!plano) {
      throw new NaoEncontradoError('Plano');
    }
    return plano;
  }

  /** Valor da parcela e texto explicativo do painel, sem gravar (parcelas ≤ duração). */
  previa(
    dados: Pick<DadosDoPlano, 'valorTotalCentavos' | 'duracaoMeses' | 'parcelas'>,
  ): PreviaDoPlano {
    validarPlano({
      ...dados,
      nome: 'prévia',
      formaDeCobranca: 'pix',
      modalidades: [],
      acessosPorSemana: null,
      renovacaoAutomatica: false,
      ativo: true,
    });
    return {
      ...valorDasParcelas(dados.valorTotalCentavos, dados.parcelas),
      explicacao: explicacaoDoPlano(dados.duracaoMeses, dados.parcelas),
    };
  }

  async criar(dados: DadosDoPlano): Promise<Plano> {
    validarPlano(dados);
    return this.planos.criar(normalizar(dados));
  }

  /** Mudar o valor total grava a auditoria sensível "Alterou valor". */
  async editar(executor: Executor, id: string, dados: DadosDoPlano): Promise<Plano> {
    validarPlano(dados);
    const anterior = await this.obter(id);
    const plano = await this.planos.atualizar(id, normalizar(dados));
    if (anterior.valorTotalCentavos !== plano.valorTotalCentavos) {
      await this.atividade.registrar(executor, {
        acao: 'alterou-valor',
        detalhe: detalheDaAlteracaoDeValor(
          plano.nome,
          anterior.valorTotalCentavos,
          plano.valorTotalCentavos,
        ),
      });
    }
    return plano;
  }

  /** Com alunos ativos no plano, a exclusão é recusada: o caminho é inativar para venda. */
  async excluir(id: string): Promise<void> {
    const plano = await this.obter(id);
    const ativos = await this.planos.alunosAtivos(id);
    if (ativos > 0) {
      throw new ConflitoError(
        `O plano ${plano.nome} tem ${ativos} ${ativos === 1 ? 'aluno ativo' : 'alunos ativos'}: inative-o em vez de excluir.`,
      );
    }
    await this.planos.excluir(id, this.relogio.agora());
  }
}

function normalizar(dados: DadosDoPlano): DadosDoPlano {
  const modalidades = [...new Set(dados.modalidades.map((m) => m.trim()).filter(Boolean))];
  return { ...dados, nome: dados.nome.trim(), modalidades };
}
