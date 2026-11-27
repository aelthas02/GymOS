import { Injectable } from '@nestjs/common';
import { somarDias } from '../../alunos/domain/datas';
import { RepositorioDeAlunos } from '../../alunos/application/portas';
import { Notificador } from '../../avisos/application/notificador';
import { RepositorioDeFuncionarios } from '../../funcionarios/application/portas';
import { GeradorIA } from '../../integracoes/application/gerador-ia';
import { FUSO_PADRAO, Relogio, dataCivilEm, type DataCivil } from '../../platform/domain/relogio';
import {
  type DadosParaGerar,
  type EvolucaoDeCarga,
  type SituacaoDaFicha,
  type TreinoDaFicha,
  TreinoInvalidoError,
  diasDoChipDeValidade,
  ehLinkDoYoutube,
  evolucaoDeCarga,
  NOMES_DAS_DIVISOES,
  pedidoDeGeracao,
  situacaoDaFicha,
  totalDeExercicios,
  treinosDaResposta,
  validarEsforco,
  validarTreinos,
  venceEmBreve,
} from '../domain/ficha';
import { AutoriaDosTreinos, type Executor } from './autoria';
import { ConflitoError, NaoEncontradoError } from './erros';
import {
  type DadosDaFicha,
  type DadosDoExercicio,
  type DadosDoModelo,
  type ExecucaoDeTreino,
  type Exercicio,
  type Ficha,
  type FichaResumida,
  type Modelo,
  RepositorioDeExecucoes,
  RepositorioDeExercicios,
  RepositorioDeFichas,
  RepositorioDeModelos,
} from './portas';

export const LIMITE_PADRAO_DAS_FICHAS = 20;
export const LIMITE_MAXIMO_DAS_FICHAS = 100;
/** Quando a ficha é aprovada sem validade, vale por 90 dias. */
const VALIDADE_PADRAO_EM_DIAS = 90;
const TREINOS_NA_EVOLUCAO = 3;

export interface ItemDaTabelaDeFichas {
  ficha: FichaResumida;
  alunoNome: string;
  professorNome: string | null;
  situacao: SituacaoDaFicha;
  /** Dias para o chip "Vence em N dias"; nulo fora da janela. */
  venceEmDias: number | null;
}

export interface FichaSugerida {
  fichaId: string;
  alunoId: string;
  alunoNome: string;
  resumo: string;
}

export interface PainelDeFichas {
  kpis: { ativas: number; aguardandoAprovacao: number; vencemEm30Dias: number; semFicha: number };
  itens: ItemDaTabelaDeFichas[];
  total: number;
  alunosComFicha: number;
  sugeridas: FichaSugerida[];
}

export interface FichaDoAluno {
  ficha: Ficha;
  alunoNome: string;
  professorNome: string | null;
  aprovadaPorNome: string | null;
  situacao: SituacaoDaFicha;
}

export interface PendenciaDeFicha {
  titulo: string;
  fichaId: string;
  alunoId: string;
  alunoNome: string;
  resumo: string;
}

export interface AcompanhamentoDeTreino {
  ficha: {
    nome: string;
    situacao: SituacaoDaFicha;
    validaAte: DataCivil | null;
    exercicios: number;
  } | null;
  cargas: EvolucaoDeCarga[];
  esforcoMedio: number | null;
  esforcoPorTreino: { dia: DataCivil; esforco: number }[];
}

export interface RegistroDeExecucao {
  exercicio: string;
  cargaKg: number | null;
  esforco: number;
}

const resumoDaFicha = (ficha: Pick<Ficha, 'nome' | 'frequenciaSemanal' | 'restricoes'>): string =>
  `${ficha.nome}, ${ficha.frequenciaSemanal} dias, ${ficha.restricoes?.trim() || 'sem restrição'}`;

/**
 * Treinos (T25): biblioteca de exercícios, modelos, fichas dos alunos com a geração por IA e a
 * aprovação do professor, e o registro de execução para Acompanhamento e Desempenho. A ficha da IA
 * nasce "Aguardando aprovação" e o aluno só enxerga a ficha ativa.
 */
@Injectable()
export class Treinos {
  constructor(
    private readonly exercicios: RepositorioDeExercicios,
    private readonly modelos: RepositorioDeModelos,
    private readonly fichas: RepositorioDeFichas,
    private readonly execucoes: RepositorioDeExecucoes,
    private readonly alunos: RepositorioDeAlunos,
    private readonly funcionarios: RepositorioDeFuncionarios,
    private readonly gerador: GeradorIA,
    private readonly notificador: Notificador,
    private readonly autoria: AutoriaDosTreinos,
    private readonly relogio: Relogio,
  ) {}

  hoje(): DataCivil {
    return this.relogio.hojeEm(FUSO_PADRAO);
  }

  // ---------- Biblioteca ----------

  listarExercicios(grupoMuscular?: string): Promise<Exercicio[]> {
    return this.exercicios.listar(grupoMuscular);
  }

  async cadastrarExercicio(dados: DadosDoExercicio): Promise<Exercicio> {
    const limpos = this.exercicioValido(dados);
    if (await this.exercicios.porNome(limpos.nome)) {
      throw new ConflitoError(`Já existe um exercício chamado ${limpos.nome}.`);
    }
    return this.exercicios.criar(limpos);
  }

  async editarExercicio(id: string, dados: DadosDoExercicio): Promise<Exercicio> {
    const limpos = this.exercicioValido(dados);
    const atual = await this.exercicios.porId(id);
    if (!atual) {
      throw new NaoEncontradoError('Exercício');
    }
    const mesmoNome = await this.exercicios.porNome(limpos.nome);
    if (mesmoNome && mesmoNome.id !== id) {
      throw new ConflitoError(`Já existe um exercício chamado ${limpos.nome}.`);
    }
    return this.exercicios.atualizar(id, limpos);
  }

  private exercicioValido(dados: DadosDoExercicio): DadosDoExercicio {
    const nome = dados.nome.trim();
    if (!nome) {
      throw new TreinoInvalidoError('Informe o nome do exercício.');
    }
    const video = dados.videoUrl?.trim() || null;
    if (video && !ehLinkDoYoutube(video)) {
      throw new TreinoInvalidoError('O vídeo precisa ser um link do YouTube.');
    }
    return {
      nome,
      grupoMuscular: dados.grupoMuscular.trim(),
      equipamento: dados.equipamento.trim(),
      videoUrl: video,
      instrucoes: dados.instrucoes?.trim() || null,
    };
  }

  // ---------- Modelos ----------

  listarModelos(): Promise<Modelo[]> {
    return this.modelos.listar();
  }

  async criarModelo(dados: DadosDoModelo): Promise<Modelo> {
    const limpos = this.modeloValido(dados);
    if (await this.modelos.porNome(limpos.nome)) {
      throw new ConflitoError(`Já existe um modelo chamado ${limpos.nome}.`);
    }
    return this.modelos.criar(limpos);
  }

  async editarModelo(id: string, dados: DadosDoModelo): Promise<Modelo> {
    const limpos = this.modeloValido(dados);
    if (!(await this.modelos.porId(id))) {
      throw new NaoEncontradoError('Modelo');
    }
    const mesmoNome = await this.modelos.porNome(limpos.nome);
    if (mesmoNome && mesmoNome.id !== id) {
      throw new ConflitoError(`Já existe um modelo chamado ${limpos.nome}.`);
    }
    return this.modelos.atualizar(id, limpos);
  }

  private modeloValido(dados: DadosDoModelo): DadosDoModelo {
    const nome = dados.nome.trim();
    if (!nome) {
      throw new TreinoInvalidoError('Informe o nome do modelo.');
    }
    return { ...dados, nome, treinos: validarTreinos(dados.treinos) };
  }

  /** "Usar modelo": cria (ou reaproveita o rascunho em andamento) a ficha do aluno com os treinos do modelo. */
  async usarModelo(executor: Executor, modeloId: string, alunoId: string): Promise<FichaDoAluno> {
    const modelo = await this.modelos.porId(modeloId);
    if (!modelo) {
      throw new NaoEncontradoError('Modelo');
    }
    const alunoNome = await this.nomeDoAluno(alunoId);
    const atual = await this.fichas.atualDoAluno(alunoId, executor.usuarioId);
    const dados: DadosDaFicha = {
      nome: modelo.nome,
      objetivo: atual?.objetivo ?? modelo.nome,
      nivel: atual?.nivel ?? 'intermediario',
      frequenciaSemanal: modelo.diasPorSemana,
      divisao: modelo.divisao,
      validaAte: atual?.validaAte ?? null,
      restricoes: atual?.restricoes ?? null,
      professorId: atual?.professorId ?? (await this.professorDoAluno(alunoId)),
      treinos: modelo.treinos,
    };
    const ficha = await this.gravarRascunho(alunoId, atual, dados, 'modelo', 'rascunho');
    await this.autoria.registrar(executor, {
      acao: 'editou-ficha-de-treino',
      detalhe: `Ficha de ${alunoNome} criada do modelo ${modelo.nome}`,
    });
    return this.montar(ficha, alunoNome);
  }

  // ---------- Fichas ----------

  async painel(pagina: number, limite: number): Promise<PainelDeFichas> {
    const hoje = this.hoje();
    const [ativas, aguardando, aVencer, comFicha, todosOsAlunos, paginaDeFichas] =
      await Promise.all([
        this.fichas.contarAtivas(hoje),
        this.fichas.aguardandoAprovacao(),
        this.fichas.ativasComValidadeAte(somarDias(hoje, 30)),
        this.fichas.alunosComFicha(),
        this.alunos.todosOsIds(),
        this.fichas.listar(pagina, limite),
      ]);
    const comFichaSet = new Set(comFicha);
    const semFicha = todosOsAlunos.filter((id) => !comFichaSet.has(id)).length;
    const ids = [...paginaDeFichas.itens, ...aguardando].map((ficha) => ficha.alunoId);
    const nomes = await this.alunos.resumos([...new Set(ids)]);
    const professores = await this.nomesDosProfessores(
      paginaDeFichas.itens.map((ficha) => ficha.professorId),
    );
    const itens = paginaDeFichas.itens.map((ficha) => ({
      ficha,
      alunoNome: nomes.get(ficha.alunoId)?.nome ?? 'Aluno removido',
      professorNome: ficha.professorId ? (professores.get(ficha.professorId) ?? null) : null,
      situacao: situacaoDaFicha(ficha, hoje),
      venceEmDias: diasDoChipDeValidade(ficha, hoje),
    }));
    const sugeridas: FichaSugerida[] = [];
    for (const resumida of aguardando.filter((ficha) => ficha.origem === 'ia')) {
      const ficha = await this.fichas.porId(resumida.id, 'sistema:treinos.painel');
      if (ficha) {
        sugeridas.push({
          fichaId: ficha.id,
          alunoId: ficha.alunoId,
          alunoNome: nomes.get(ficha.alunoId)?.nome ?? 'Aluno removido',
          resumo: resumoDaFicha(ficha),
        });
      }
    }
    return {
      kpis: {
        ativas,
        aguardandoAprovacao: aguardando.length,
        vencemEm30Dias: aVencer.filter((ficha) => venceEmBreve(ficha, hoje)).length,
        semFicha,
      },
      itens,
      total: paginaDeFichas.total,
      alunosComFicha: comFichaSet.size,
      sugeridas,
    };
  }

  /** A ficha em andamento do aluno (editor): rascunho, aguardando aprovação ou a ativa. */
  async fichaDoAluno(executor: Executor, alunoId: string): Promise<FichaDoAluno> {
    const alunoNome = await this.nomeDoAluno(alunoId);
    const ficha = await this.fichas.atualDoAluno(alunoId, executor.usuarioId);
    if (!ficha) {
      throw new NaoEncontradoError('Ficha de treino');
    }
    return this.montar(ficha, alunoNome);
  }

  /** Salvar rascunho (`enviar: false`) ou "Salvar e enviar ao aluno" (`enviar: true`, aprova e ativa). */
  async salvar(
    executor: Executor,
    alunoId: string,
    entrada: Omit<DadosDaFicha, 'professorId'> & { professorId?: string | null },
    enviar: boolean,
  ): Promise<FichaDoAluno> {
    const alunoNome = await this.nomeDoAluno(alunoId);
    const atual = await this.fichas.atualDoAluno(alunoId, executor.usuarioId);
    const dados = this.fichaValida(
      entrada,
      atual?.professorId ?? (await this.professorDoAluno(alunoId)),
    );
    let ficha: Ficha;
    if (enviar) {
      ficha = await this.ativar(executor, alunoId, atual, dados);
    } else {
      ficha = await this.gravarRascunho(
        alunoId,
        atual,
        dados,
        atual?.origem ?? 'manual',
        'rascunho',
      );
    }
    await this.autoria.registrar(executor, {
      acao: 'editou-ficha-de-treino',
      detalhe: `${enviar ? 'Ficha enviada' : 'Rascunho salvo'}: ${alunoNome}`,
    });
    return this.montar(ficha, alunoNome);
  }

  /** "Gerar com IA" e "Gerar de novo": o rascunho nasce "Aguardando aprovação" e o aluno não o vê. */
  async gerarComIA(
    executor: Executor,
    alunoId: string,
    entrada: DadosParaGerar & { validaAte: DataCivil | null },
  ): Promise<FichaDoAluno> {
    const alunoNome = await this.nomeDoAluno(alunoId);
    const { validaAte, ...paraGerar } = entrada;
    // O pedido leva só objetivo, nível, frequência, divisão e restrições: sem nome nem CPF.
    const resposta = await this.gerador.gerar(pedidoDeGeracao(paraGerar));
    const itens = Array.isArray(resposta['treinos']) ? resposta['treinos'] : [];
    const treinos = treinosDaResposta(paraGerar.divisao, itens, paraGerar.restricoes);
    const atual = await this.fichas.atualDoAluno(alunoId, executor.usuarioId);
    const dados: DadosDaFicha = {
      nome: `${paraGerar.objetivo} ${NOMES_DAS_DIVISOES[paraGerar.divisao]}`,
      objetivo: paraGerar.objetivo,
      nivel: paraGerar.nivel,
      frequenciaSemanal: paraGerar.frequenciaSemanal,
      divisao: paraGerar.divisao,
      validaAte,
      restricoes: paraGerar.restricoes,
      professorId: atual?.professorId ?? (await this.professorDoAluno(alunoId)),
      treinos,
    };
    const ficha = await this.gravarRascunho(alunoId, atual, dados, 'ia', 'aguardando_aprovacao');
    await this.autoria.registrar(executor, {
      acao: 'editou-ficha-de-treino',
      detalhe: `Ficha sugerida pela IA: ${alunoNome}`,
    });
    return this.montar(ficha, alunoNome);
  }

  async aprovar(executor: Executor, fichaId: string): Promise<FichaDoAluno> {
    const ficha = await this.fichas.porId(fichaId, executor.usuarioId);
    if (!ficha || (ficha.situacao !== 'aguardando_aprovacao' && ficha.situacao !== 'rascunho')) {
      throw new NaoEncontradoError('Ficha para aprovar');
    }
    const alunoNome = await this.nomeDoAluno(ficha.alunoId);
    const ativa = await this.ativar(executor, ficha.alunoId, ficha, ficha);
    await this.autoria.registrar(executor, {
      acao: 'editou-ficha-de-treino',
      detalhe: `Ficha aprovada: ${alunoNome}`,
    });
    return this.montar(ativa, alunoNome);
  }

  async recusar(executor: Executor, fichaId: string): Promise<void> {
    const ficha = await this.fichas.resumoPorId(fichaId);
    if (!ficha || ficha.situacao !== 'aguardando_aprovacao') {
      throw new NaoEncontradoError('Ficha aguardando aprovação');
    }
    await this.fichas.atualizar(fichaId, {
      situacao: 'recusada',
      atualizadaEm: this.relogio.agora(),
    });
    await this.autoria.registrar(executor, {
      acao: 'editou-ficha-de-treino',
      detalhe: `Ficha sugerida recusada: ${await this.nomeDoAluno(ficha.alunoId)}`,
    });
  }

  /** "Avisar alunos": notifica quem tem ficha vencendo em até 30 dias (e ainda não venceu). */
  async avisarVencimentos(executor: Executor): Promise<{ avisados: number }> {
    const hoje = this.hoje();
    const vencendo = (await this.fichas.ativasComValidadeAte(somarDias(hoje, 30))).filter((ficha) =>
      venceEmBreve(ficha, hoje),
    );
    for (const ficha of vencendo) {
      const dias = diasDoChipDeValidade(ficha, hoje) ?? 0;
      await this.notificador.notificar({
        destinatario: { tipo: 'aluno', id: ficha.alunoId },
        tipo: 'ficha',
        titulo: 'Sua ficha está perto de vencer',
        texto:
          dias === 0
            ? 'Sua ficha de treino vence hoje. Fale com o seu professor.'
            : `Sua ficha de treino vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}. Fale com o seu professor.`,
        link: '/treino',
        push: true,
      });
    }
    await this.autoria.registrar(executor, {
      acao: 'editou-ficha-de-treino',
      detalhe: `Aviso de validade enviado a ${vencendo.length} aluno(s)`,
    });
    return { avisados: vencendo.length };
  }

  /** Provedor de pendências do Início: "Ficha de treino para aprovar". */
  async pendencias(): Promise<PendenciaDeFicha[]> {
    const aguardando = await this.fichas.aguardandoAprovacao();
    const nomes = await this.alunos.resumos([...new Set(aguardando.map((ficha) => ficha.alunoId))]);
    const pendencias: PendenciaDeFicha[] = [];
    for (const resumida of aguardando) {
      const ficha = await this.fichas.porId(resumida.id, 'sistema:treinos.pendencias');
      pendencias.push({
        titulo: 'Ficha de treino para aprovar',
        fichaId: resumida.id,
        alunoId: resumida.alunoId,
        alunoNome: nomes.get(resumida.alunoId)?.nome ?? 'Aluno removido',
        resumo: ficha ? resumoDaFicha(ficha) : resumida.nome,
      });
    }
    return pendencias;
  }

  // ---------- Execução (app do aluno) e acompanhamento ----------

  /** A ficha que o aluno vê: só a ativa, dentro da validade. */
  fichaAtivaDoAluno(alunoId: string): Promise<FichaResumida | null> {
    return this.fichas.ativaDoAluno(alunoId, this.hoje());
  }

  async registrarExecucao(
    alunoId: string,
    registro: RegistroDeExecucao,
  ): Promise<ExecucaoDeTreino> {
    validarEsforco(registro.esforco);
    if (registro.cargaKg !== null && registro.cargaKg < 0) {
      throw new TreinoInvalidoError('A carga não pode ser negativa.');
    }
    const ficha = await this.fichaAtivaDoAluno(alunoId);
    return this.execucoes.registrar({
      alunoId,
      fichaId: ficha?.id ?? null,
      exercicio: registro.exercicio.trim(),
      cargaKg: registro.cargaKg,
      esforco: registro.esforco,
      realizadoEm: this.relogio.agora(),
    });
  }

  /** Evolução de carga, esforço e resumo da ficha, para Acompanhamento (T16) e Desempenho (T33). */
  async acompanhamento(alunoId: string): Promise<AcompanhamentoDeTreino> {
    const hoje = this.hoje();
    const [execucoes, ficha] = await Promise.all([
      this.execucoes.doAluno(alunoId),
      this.fichas.ativaDoAluno(alunoId, hoje),
    ]);
    const porExercicio = new Map<string, { dia: DataCivil; cargaKg: number }[]>();
    const porDia = new Map<DataCivil, number[]>();
    for (const execucao of execucoes) {
      const dia = dataCivilEm(execucao.realizadoEm, FUSO_PADRAO);
      porDia.set(dia, [...(porDia.get(dia) ?? []), execucao.esforco]);
      if (execucao.cargaKg !== null) {
        porExercicio.set(execucao.exercicio, [
          ...(porExercicio.get(execucao.exercicio) ?? []),
          { dia, cargaKg: execucao.cargaKg },
        ]);
      }
    }
    const cargas = [...porExercicio.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, TREINOS_NA_EVOLUCAO)
      .map(([exercicio, pontos]) => evolucaoDeCarga(exercicio, pontos))
      .filter((evolucao): evolucao is EvolucaoDeCarga => evolucao !== null);
    const esforcoPorTreino = [...porDia.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, valores]) => ({
        dia,
        esforco: Math.round((valores.reduce((soma, v) => soma + v, 0) / valores.length) * 10) / 10,
      }));
    const todosOsEsforcos = execucoes.map((execucao) => execucao.esforco);
    return {
      ficha: ficha
        ? {
            nome: ficha.nome,
            situacao: situacaoDaFicha(ficha, hoje),
            validaAte: ficha.validaAte,
            exercicios: totalDeExercicios(ficha.treinos),
          }
        : null,
      cargas,
      esforcoMedio: todosOsEsforcos.length
        ? Math.round(
            (todosOsEsforcos.reduce((soma, v) => soma + v, 0) / todosOsEsforcos.length) * 10,
          ) / 10
        : null,
      esforcoPorTreino: esforcoPorTreino.slice(-8),
    };
  }

  // ---------- internos ----------

  private fichaValida(
    entrada: Omit<DadosDaFicha, 'professorId'> & { professorId?: string | null },
    professorPadrao: string | null,
  ): DadosDaFicha {
    const objetivo = entrada.objetivo.trim();
    if (!objetivo) {
      throw new TreinoInvalidoError('Informe o objetivo da ficha.');
    }
    return {
      ...entrada,
      nome: entrada.nome.trim() || `${objetivo} ${NOMES_DAS_DIVISOES[entrada.divisao]}`,
      objetivo,
      restricoes: entrada.restricoes?.trim() || null,
      professorId: entrada.professorId ?? professorPadrao,
      treinos: validarTreinos(entrada.treinos),
    };
  }

  /** Atualiza o rascunho em andamento ou cria um novo (a ficha ativa continua valendo até a troca). */
  private async gravarRascunho(
    alunoId: string,
    atual: Ficha | null,
    dados: DadosDaFicha,
    origem: Ficha['origem'],
    situacao: 'rascunho' | 'aguardando_aprovacao',
  ): Promise<Ficha> {
    const agora = this.relogio.agora();
    if (atual && atual.situacao !== 'ativa') {
      return this.fichas.atualizar(atual.id, { ...dados, situacao, origem, atualizadaEm: agora });
    }
    return this.fichas.criar({ ...dados, alunoId, situacao, origem, atualizadaEm: agora });
  }

  /** Aprova e ativa: a ficha vira a ativa do aluno, as outras ativas são arquivadas e o aluno é avisado. */
  private async ativar(
    executor: Executor,
    alunoId: string,
    atual: Ficha | null,
    dados: DadosDaFicha,
  ): Promise<Ficha> {
    const agora = this.relogio.agora();
    const validaAte = dados.validaAte ?? somarDias(this.hoje(), VALIDADE_PADRAO_EM_DIAS);
    const aprovacao = {
      situacao: 'ativa' as const,
      aprovadaPorId: executor.usuarioId,
      aprovadaEm: agora,
    };
    let ficha: Ficha;
    if (atual) {
      ficha = await this.fichas.atualizar(atual.id, {
        ...dados,
        validaAte,
        ...aprovacao,
        atualizadaEm: agora,
      });
    } else {
      ficha = await this.fichas.criar({
        ...dados,
        validaAte,
        alunoId,
        origem: 'manual',
        ...aprovacao,
        atualizadaEm: agora,
      });
    }
    for (const outra of await this.fichas.doAluno(alunoId, executor.usuarioId)) {
      if (outra.id !== ficha.id && outra.situacao === 'ativa') {
        await this.fichas.atualizar(outra.id, { situacao: 'arquivada', atualizadaEm: agora });
      }
    }
    await this.notificador.notificar({
      destinatario: { tipo: 'aluno', id: alunoId },
      tipo: 'ficha',
      titulo: 'Ficha atualizada',
      texto: 'Seu professor ajustou o seu treino.',
      link: '/treino',
      push: true,
    });
    return ficha;
  }

  private async nomeDoAluno(alunoId: string): Promise<string> {
    const nome = await this.alunos.nome(alunoId);
    if (!nome) {
      throw new NaoEncontradoError('Aluno');
    }
    return nome;
  }

  private async professorDoAluno(alunoId: string): Promise<string | null> {
    return (await this.alunos.resumos([alunoId])).get(alunoId)?.professorId ?? null;
  }

  private async nomesDosProfessores(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter((id): id is string => id !== null))];
    const nomes = new Map<string, string>();
    for (const id of unicos) {
      const funcionario = await this.funcionarios.porId(id);
      if (funcionario) {
        nomes.set(id, funcionario.nome);
      }
    }
    return nomes;
  }

  private async montar(ficha: Ficha, alunoNome: string): Promise<FichaDoAluno> {
    const professores = await this.nomesDosProfessores([ficha.professorId]);
    const aprovadaPor = ficha.aprovadaPorId
      ? await this.autoria.nomeDoUsuario(ficha.aprovadaPorId)
      : null;
    return {
      ficha,
      alunoNome,
      professorNome: ficha.professorId ? (professores.get(ficha.professorId) ?? null) : null,
      aprovadaPorNome: aprovadaPor,
      situacao: situacaoDaFicha(ficha, this.hoje()),
    };
  }
}

export type { TreinoDaFicha };
