import { Injectable } from '@nestjs/common';
import { minutoDoDiaEmSaoPaulo } from '@gymos/shared-acesso';
import { diasEntre, somarDias } from '../../alunos/domain/datas';
import { type DataCivil, FUSO_PADRAO, Relogio } from '../../platform/domain/relogio';
import { RegistroDeAcessoInvalidoError } from './erros';
import { AlunosParaAcesso, RepositorioDeAcessos, RepositorioDeAlertas } from './portas';

/** Janela da frequência por horário (tela Histórico de frequência: média dos últimos 30 dias). */
export const DIAS_DA_FREQUENCIA_POR_HORARIO = 30;

export interface FaixaDeHorario {
  /** Hora cheia de São Paulo, de 0 a 23. */
  hora: number;
  /** Entradas liberadas na hora, somadas nos 30 dias. */
  entradas: number;
  /** Média de entradas por dia, com uma casa decimal. */
  mediaPorDia: number;
}

export interface FrequenciaPorHorario {
  de: DataCivil;
  ate: DataCivil;
  dias: number;
  faixas: FaixaDeHorario[];
  /** Hora de maior média; nula sem nenhuma entrada. */
  horarioMaisCheio: number | null;
}

export interface FrequenciaDoAlunoNoMes {
  alunoId: string;
  nome: string;
  planoNome: string | null;
  /** Dias do mês com entrada liberada. */
  treinos: number;
  ultimoTreino: DataCivil | null;
  diasSemTreinar: number | null;
  /** Nível do alerta aberto, se houver. */
  alerta: 'comum' | 'urgente' | null;
}

export interface PaginaDeFrequenciaPorAluno {
  mes: string;
  itens: FrequenciaDoAlunoNoMes[];
  total: number;
  proximoCursor: string | null;
}

export interface PresencasDoMes {
  mes: string;
  /** Soma das presenças (aluno-dia) de todos os alunos, base do rateio de receita (T21). */
  total: number;
  alunos: { alunoId: string; presencas: number }[];
}

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Primeiro e último dia do mês `AAAA-MM`; mês fora do formato é erro de requisição. */
export function intervaloDoMes(mes: string): { de: DataCivil; ate: DataCivil } {
  const achado = MES.exec(mes);
  if (!achado) {
    throw new RegistroDeAcessoInvalidoError('Informe o mês no formato AAAA-MM.');
  }
  const ultimo = new Date(Date.UTC(Number(achado[1]), Number(achado[2]), 0)).getUTCDate();
  return {
    de: `${mes}-01` as DataCivil,
    ate: `${mes}-${String(ultimo).padStart(2, '0')}` as DataCivil,
  };
}

function lerCursor(cursor: string): { treinos: number; alunoId: string } {
  try {
    const { t, a } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      t: unknown;
      a: unknown;
    };
    if (typeof t === 'number' && Number.isSafeInteger(t) && typeof a === 'string') {
      return { treinos: t, alunoId: a };
    }
  } catch {
    // cai no erro abaixo
  }
  throw new RegistroDeAcessoInvalidoError('Cursor inválido.');
}

const escreverCursor = (item: FrequenciaDoAlunoNoMes): string =>
  Buffer.from(JSON.stringify({ t: item.treinos, a: item.alunoId })).toString('base64url');

/**
 * Leituras de frequência (T23a): quem alimenta o Início, o Histórico de frequência e o rateio de
 * receita por presença (T21). Presença é um aluno-dia com entrada liberada; sair e voltar no mesmo dia
 * é uma presença só.
 */
@Injectable()
export class Frequencia {
  constructor(
    private readonly acessos: RepositorioDeAcessos,
    private readonly alertas: RepositorioDeAlertas,
    private readonly alunos: AlunosParaAcesso,
    private readonly relogio: Relogio,
  ) {}

  private hoje(): DataCivil {
    return this.relogio.hojeEm(FUSO_PADRAO);
  }

  /** Provedor do Início: check-ins de hoje (entradas liberadas) e acessos negados. */
  async checkinsDeHoje(): Promise<{ dia: DataCivil; liberados: number; negados: number }> {
    const dia = this.hoje();
    return { dia, ...(await this.acessos.contarDoDia(dia)) };
  }

  /** Provedor do Início: entradas por hora, média dos 30 dias que terminam hoje. */
  async frequenciaPorHorario(): Promise<FrequenciaPorHorario> {
    const ate = this.hoje();
    const de = somarDias(ate, -(DIAS_DA_FREQUENCIA_POR_HORARIO - 1));
    const entradas = await this.acessos.entradasNoPeriodo(de, ate);
    const porHora = new Array<number>(24).fill(0);
    for (const instante of entradas) {
      const hora = Math.floor(minutoDoDiaEmSaoPaulo(instante) / 60);
      porHora[hora] = (porHora[hora] ?? 0) + 1;
    }
    const faixas = porHora.map((total, hora) => ({
      hora,
      entradas: total,
      mediaPorDia: Math.round((total * 10) / DIAS_DA_FREQUENCIA_POR_HORARIO) / 10,
    }));
    const maior = Math.max(...porHora);
    return {
      de,
      ate,
      dias: DIAS_DA_FREQUENCIA_POR_HORARIO,
      faixas,
      horarioMaisCheio: maior === 0 ? null : porHora.indexOf(maior),
    };
  }

  /** Presenças por aluno no mês, para o rateio de receita do T21. */
  async presencasDoMes(mes: string): Promise<PresencasDoMes> {
    const { de, ate } = intervaloDoMes(mes);
    const contagem = new Map<string, number>();
    for (const { alunoId } of await this.acessos.diasComEntrada(de, ate)) {
      contagem.set(alunoId, (contagem.get(alunoId) ?? 0) + 1);
    }
    const alunos = [...contagem]
      .map(([alunoId, presencas]) => ({ alunoId, presencas }))
      .sort((a, b) => b.presencas - a.presencas || a.alunoId.localeCompare(b.alunoId));
    return { mes, total: alunos.reduce((soma, a) => soma + a.presencas, 0), alunos };
  }

  /** Frequência por aluno no mês: de quem mais treina a quem está em risco (fim da lista). */
  async frequenciaPorAluno(
    mes: string,
    paginacao: { limite: number; cursor?: string },
  ): Promise<PaginaDeFrequenciaPorAluno> {
    const { de, ate } = intervaloDoMes(mes);
    const hoje = this.hoje();
    const [ids, dias, ultimos, abertos] = await Promise.all([
      this.alunos.todosOsIds(),
      this.acessos.diasComEntrada(de, ate),
      this.acessos.ultimoDiaComEntrada(),
      this.alertas.abertos(),
    ]);
    const treinos = new Map<string, number>();
    for (const { alunoId } of dias) {
      treinos.set(alunoId, (treinos.get(alunoId) ?? 0) + 1);
    }
    const nivelDoAluno = new Map<string, 'comum' | 'urgente'>();
    for (const alerta of abertos) {
      if (alerta.nivel === 'urgente' || !nivelDoAluno.has(alerta.alunoId)) {
        nivelDoAluno.set(alerta.alunoId, alerta.nivel);
      }
    }
    const ordenados = ids
      .map((alunoId) => ({ alunoId, treinos: treinos.get(alunoId) ?? 0 }))
      .sort((a, b) => b.treinos - a.treinos || a.alunoId.localeCompare(b.alunoId));
    const posicao = paginacao.cursor ? lerCursor(paginacao.cursor) : null;
    const restantes = posicao
      ? ordenados.filter(
          (item) =>
            item.treinos < posicao.treinos ||
            (item.treinos === posicao.treinos && item.alunoId > posicao.alunoId),
        )
      : ordenados;
    const pagina = restantes.slice(0, paginacao.limite);
    const resumos = await this.alunos.resumos(pagina.map((item) => item.alunoId));
    const itens: FrequenciaDoAlunoNoMes[] = [];
    for (const { alunoId, treinos: feitos } of pagina) {
      const ultimo = ultimos.get(alunoId) ?? null;
      itens.push({
        alunoId,
        nome: resumos.get(alunoId)?.nome ?? '',
        planoNome: (await this.alunos.contexto(alunoId))?.planoNome ?? null,
        treinos: feitos,
        ultimoTreino: ultimo,
        diasSemTreinar: ultimo === null ? null : Math.max(0, diasEntre(ultimo, hoje)),
        alerta: nivelDoAluno.get(alunoId) ?? null,
      });
    }
    const ultimoItem = itens.at(-1);
    return {
      mes,
      itens,
      total: ordenados.length,
      proximoCursor:
        restantes.length > paginacao.limite && ultimoItem ? escreverCursor(ultimoItem) : null,
    };
  }
}
