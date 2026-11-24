import { Injectable } from '@nestjs/common';
import { minutoDoDiaEmSaoPaulo, minutosDoHorario } from '@gymos/shared-acesso';
import { diasEntre, somarDias } from '../../alunos/domain/datas';
import { Notificador } from '../../avisos/application/notificador';
import { Consentimentos } from '../../platform/application/protecao-de-dados';
import { FUSO_PADRAO, Relogio, dataCivilEm } from '../../platform/domain/relogio';
import {
  type AlertaApurado,
  type ConfiguracaoDeAlertas,
  type NivelDoAlerta,
  type TipoDeAlerta,
  DIAS_DA_JANELA,
  apurarAlertas,
} from '../domain/alerta';
import { RegistroDeAcessoInvalidoError } from './erros';
import {
  AlunosParaAcesso,
  RepositorioDeAcessos,
  RepositorioDeAlertas,
  RepositorioDeConfiguracaoDeAlertas,
} from './portas';

export interface PreviaDosAlertas {
  /** Alunos que seriam alertados hoje com a regra atual. */
  total: number;
  urgentes: number;
  comuns: number;
}

export interface ResultadoDaVerificacao {
  abertos: number;
  escalados: number;
  resolvidos: number;
  /** Mensagens automáticas enviadas a alunos que aceitaram marketing. */
  mensagens: number;
}

export interface AlunoEmRisco {
  alunoId: string;
  nome: string;
  professorId: string | null;
  nivel: NivelDoAlerta;
  tipo: TipoDeAlerta;
  diasSemTreinar: number | null;
  quedaPercentual: number | null;
  desde: Date;
}

export interface PaginaDeAlunosEmRisco {
  itens: AlunoEmRisco[];
  total: number;
  urgentes: number;
  comuns: number;
  proximoCursor: string | null;
  /** Quem recebe o alerta (configuração): as telas de Alunos, Recepção e Início usam. */
  destinatarios: ConfiguracaoDeAlertas['destinatarios'];
}

const chave = (alunoId: string, tipo: TipoDeAlerta): string => `${alunoId}|${tipo}`;

function lerDeslocamento(cursor: string): number {
  const valor = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new RegistroDeAcessoInvalidoError('Cursor inválido.');
  }
  return valor;
}

/**
 * Alertas de frequência (T23a): aluno que passou do prazo sem treinar ou cuja frequência caiu. Um job
 * diário, por tenant, abre, escala e resolve os alertas; a mensagem ao aluno só vai com a opção ligada
 * e com consentimento de marketing (T13d, LGPD).
 */
@Injectable()
export class AlertasDeFrequencia {
  constructor(
    private readonly alunos: AlunosParaAcesso,
    private readonly acessos: RepositorioDeAcessos,
    private readonly alertas: RepositorioDeAlertas,
    private readonly configuracao: RepositorioDeConfiguracaoDeAlertas,
    private readonly consentimentos: Consentimentos,
    private readonly notificador: Notificador,
    private readonly relogio: Relogio,
  ) {}

  /** Quem seria alertado hoje e por qual motivo, sem gravar nada. */
  private async apurar(config: ConfiguracaoDeAlertas): Promise<Map<string, AlertaApurado[]>> {
    const hoje = this.relogio.hojeEm(FUSO_PADRAO);
    const inicioDaJanelaRecente = somarDias(hoje, -(DIAS_DA_JANELA - 1));
    const inicioDaJanelaAnterior = somarDias(inicioDaJanelaRecente, -DIAS_DA_JANELA);
    const [ids, dias, ultimos] = await Promise.all([
      this.alunos.todosOsIds(),
      this.acessos.diasComEntrada(inicioDaJanelaAnterior, hoje),
      this.acessos.ultimoDiaComEntrada(),
    ]);
    const recentes = new Map<string, number>();
    const anteriores = new Map<string, number>();
    for (const { alunoId, dia } of dias) {
      const alvo = dia >= inicioDaJanelaRecente ? recentes : anteriores;
      alvo.set(alunoId, (alvo.get(alunoId) ?? 0) + 1);
    }
    const resultado = new Map<string, AlertaApurado[]>();
    for (const alunoId of ids) {
      const contexto = await this.alunos.contexto(alunoId);
      // Sem contrato ou encerrado não é aluno a reter: o alerta de afastamento não se aplica.
      if (!contexto || contexto.contrato === null || contexto.contrato === 'encerrado') {
        continue;
      }
      const ultimo = ultimos.get(alunoId) ?? null;
      const inicio = contexto.inicioDoContrato;
      // Quem acabou de assinar não está "sem treinar" desde antes do contrato.
      const desde = ultimo !== null && (inicio === null || ultimo >= inicio) ? ultimo : inicio;
      if (desde === null) {
        continue;
      }
      const apurados = apurarAlertas(
        {
          desde,
          diasRecentes: recentes.get(alunoId) ?? 0,
          diasAnteriores: anteriores.get(alunoId) ?? 0,
          trancado: contexto.contrato === 'trancado',
        },
        hoje,
        config,
      );
      if (apurados.length > 0) {
        resultado.set(alunoId, apurados);
      }
    }
    return resultado;
  }

  /** "Com esta regra, hoje seriam alertados 27 alunos · 8 em nível urgente · 19 em nível comum." */
  async previa(): Promise<PreviaDosAlertas> {
    const apurados = await this.apurar(await this.configuracao.obter());
    let urgentes = 0;
    for (const alertas of apurados.values()) {
      if (alertas.some((alerta) => alerta.nivel === 'urgente')) {
        urgentes += 1;
      }
    }
    return { total: apurados.size, urgentes, comuns: apurados.size - urgentes };
  }

  /**
   * O job: abre o alerta de quem entrou na regra, sobe para urgente quem passou do prazo e resolve o
   * de quem voltou a treinar. Idempotente: repetir no mesmo dia não duplica nem reenvia mensagem.
   */
  async verificar(): Promise<ResultadoDaVerificacao> {
    const config = await this.configuracao.obter();
    const agora = this.relogio.agora();
    const apurados = await this.apurar(config);
    const abertos = new Map(
      (await this.alertas.abertos()).map((alerta) => [chave(alerta.alunoId, alerta.tipo), alerta]),
    );
    const resultado: ResultadoDaVerificacao = {
      abertos: 0,
      escalados: 0,
      resolvidos: 0,
      mensagens: 0,
    };
    const novos: { alunoId: string; alerta: AlertaApurado }[] = [];
    for (const [alunoId, lista] of apurados) {
      for (const alerta of lista) {
        const existente = abertos.get(chave(alunoId, alerta.tipo));
        abertos.delete(chave(alunoId, alerta.tipo));
        if (!existente) {
          await this.alertas.abrir(alunoId, alerta, agora);
          novos.push({ alunoId, alerta });
          resultado.abertos += 1;
          continue;
        }
        await this.alertas.atualizar(existente.id, alerta, agora);
        if (existente.nivel === 'comum' && alerta.nivel === 'urgente') {
          resultado.escalados += 1;
        }
      }
    }
    // O que sobrou aberto e não foi apurado hoje: o aluno voltou, trancou ou encerrou.
    for (const sobra of abertos.values()) {
      await this.alertas.resolver(sobra.id, agora);
      resultado.resolvidos += 1;
    }
    if (config.mensagemAoAluno && novos.length > 0) {
      resultado.mensagens = await this.mensagensAosAlunos(novos);
    }
    return resultado;
  }

  /**
   * Roda a verificação se já passou da hora configurada e ainda não rodou hoje (uma vez por dia, mesmo
   * com vários processos). Devolve `null` quando não era a hora.
   */
  async verificarSeDevido(): Promise<ResultadoDaVerificacao | null> {
    const config = await this.configuracao.obter();
    if (minutoDoDiaEmSaoPaulo(this.relogio.agora()) < minutosDoHorario(config.horaDaVerificacao)) {
      return null;
    }
    if (!(await this.configuracao.reivindicarVerificacao(this.relogio.hojeEm(FUSO_PADRAO)))) {
      return null;
    }
    return this.verificar();
  }

  /** Mensagem automática só para quem aceitou marketing; quem não aceitou não recebe nada. */
  private async mensagensAosAlunos(
    novos: readonly { alunoId: string; alerta: AlertaApurado }[],
  ): Promise<number> {
    const elegiveis = new Set(
      await this.consentimentos.elegiveis(
        novos.map((novo) => novo.alunoId),
        'marketing',
      ),
    );
    let enviadas = 0;
    const jaAvisados = new Set<string>();
    for (const { alunoId, alerta } of novos) {
      if (!elegiveis.has(alunoId) || jaAvisados.has(alunoId)) {
        continue;
      }
      jaAvisados.add(alunoId);
      await this.notificador.notificar({
        destinatario: { tipo: 'aluno', id: alunoId },
        tipo: 'comunicado',
        titulo: 'Sentimos sua falta',
        texto:
          alerta.tipo === 'sem_treinar'
            ? `Faz ${alerta.diasSemTreinar} dias que você não treina. Que tal voltar hoje?`
            : 'Sua frequência caiu nas últimas semanas. Podemos ajudar a retomar?',
        link: '/treino',
        push: true,
      });
      enviadas += 1;
    }
    return enviadas;
  }

  /** Alunos em risco hoje: o alerta aberto de cada um (o mais grave), urgentes primeiro. */
  async emRisco(filtro: {
    nivel?: NivelDoAlerta;
    professorId?: string;
    limite: number;
    cursor?: string;
  }): Promise<PaginaDeAlunosEmRisco> {
    const [abertos, config] = await Promise.all([
      this.alertas.abertos(),
      this.configuracao.obter(),
    ]);
    const hoje = this.relogio.hojeEm(FUSO_PADRAO);
    const porAluno = new Map<string, (typeof abertos)[number]>();
    for (const alerta of abertos) {
      const atual = porAluno.get(alerta.alunoId);
      const maisGrave =
        !atual ||
        (alerta.nivel === 'urgente' && atual.nivel === 'comum') ||
        (alerta.nivel === atual.nivel &&
          (alerta.diasSemTreinar ?? 0) > (atual.diasSemTreinar ?? 0));
      if (maisGrave) {
        porAluno.set(alerta.alunoId, alerta);
      }
    }
    const resumos = await this.alunos.resumos([...porAluno.keys()]);
    const todos: AlunoEmRisco[] = [];
    for (const alerta of porAluno.values()) {
      const resumo = resumos.get(alerta.alunoId);
      if (!resumo) {
        continue;
      }
      todos.push({
        alunoId: alerta.alunoId,
        nome: resumo.nome,
        professorId: resumo.professorId,
        nivel: alerta.nivel,
        tipo: alerta.tipo,
        // O alerta guarda o atraso do dia da verificação; a lista mostra os dias de hoje.
        diasSemTreinar:
          alerta.diasSemTreinar === null
            ? null
            : alerta.diasSemTreinar +
              Math.max(0, diasEntre(dataCivilEm(alerta.atualizadoEm, FUSO_PADRAO), hoje)),
        quedaPercentual: alerta.quedaPercentual,
        desde: alerta.criadoEm,
      });
    }
    const doFiltro = todos
      .filter((item) => (filtro.nivel ? item.nivel === filtro.nivel : true))
      .filter((item) => (filtro.professorId ? item.professorId === filtro.professorId : true))
      .sort(
        (a, b) =>
          Number(b.nivel === 'urgente') - Number(a.nivel === 'urgente') ||
          (b.diasSemTreinar ?? 0) - (a.diasSemTreinar ?? 0) ||
          a.nome.localeCompare(b.nome, 'pt-BR'),
      );
    const inicio = filtro.cursor ? lerDeslocamento(filtro.cursor) : 0;
    const itens = doFiltro.slice(inicio, inicio + filtro.limite);
    const urgentes = doFiltro.filter((item) => item.nivel === 'urgente').length;
    return {
      itens,
      total: doFiltro.length,
      urgentes,
      comuns: doFiltro.length - urgentes,
      proximoCursor:
        inicio + filtro.limite < doFiltro.length
          ? Buffer.from(String(inicio + filtro.limite)).toString('base64url')
          : null,
      destinatarios: config.destinatarios,
    };
  }
}
