import { Injectable, Logger } from '@nestjs/common';
import type { ContextoDeMensagem } from '@gymos/shared-templates';
import { EnvioDeEmail } from '../../autenticacao/application/portas';
import { Consentimentos } from '../../platform/application/protecao-de-dados';
import { PublicadorDeEventos } from '../../platform/application/eventos';
import { Relogio } from '../../platform/domain/relogio';
import {
  ASSUNTO_PADRAO,
  type CanalDeMensagem,
  type EstadoDaMensagem,
  MODELO_DE_COBRANCA,
  type MotivoDaRecusa,
  ehPedidoDeSaida,
} from '../domain/mensagens';
import { ConexoesMeta } from './conexoes-meta';
import {
  type ContatoDoAluno,
  type FonteDeContatos,
  type PedidoDeMensagem,
  RepositorioDeMensagens,
  type ResultadoDoEnvio,
  TransporteDeWhatsapp,
  TenantDoContexto,
} from './portas';
import { ModeloInvalidoError, ResolvedorDeVariaveis } from './resolvedor';

/** Ponte para o cadastro de alunos: o domínio de alunos registra a fonte no `onModuleInit`. */
@Injectable()
export class DiretorioDeAlunos {
  private fonte?: FonteDeContatos;

  registrar(fonte: FonteDeContatos): void {
    this.fonte = fonte;
  }

  private obter(): FonteDeContatos {
    if (!this.fonte) {
      throw new Error('Nenhuma fonte de contatos de alunos foi registrada na Mensageria.');
    }
    return this.fonte;
  }

  contato(alunoId: string): Promise<ContatoDoAluno | null> {
    return this.obter().contato(alunoId);
  }

  idPorTelefone(telefone: string): Promise<string | null> {
    return this.obter().idPorTelefone(telefone);
  }
}

/** Evento do webhook do WhatsApp já interpretado. */
export type EventoDoWhatsapp =
  | { tipo: 'status'; idExterno: string; status: 'entregue' | 'lida' | 'falha' }
  | { tipo: 'resposta'; telefone: string; texto: string; idExterno: string | null };

const soDigitos = (texto: string): string => texto.replace(/\D/g, '');

/** WhatsApp precisa do DDI: telefone nacional (10 ou 11 dígitos) ganha o 55. */
function paraWhatsapp(telefone: string): string {
  const digitos = soDigitos(telefone);
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}

/**
 * Envio de mensagens ao aluno por WhatsApp ou e-mail (T13d). Todo envio declara a finalidade:
 * `marketing` só vai a quem aceitou (T13c); `transacional` sempre vai. Recusas e falhas não lançam:
 * voltam em `ResultadoDoEnvio` e ficam gravadas, para a tela de quem pediu.
 */
@Injectable()
export class Mensageria {
  private readonly logger = new Logger(Mensageria.name);

  constructor(
    private readonly alunos: DiretorioDeAlunos,
    private readonly consentimentos: Consentimentos,
    private readonly conexoes: ConexoesMeta,
    private readonly resolvedor: ResolvedorDeVariaveis,
    private readonly whatsapp: TransporteDeWhatsapp,
    private readonly email: EnvioDeEmail,
    private readonly repositorio: RepositorioDeMensagens,
    private readonly publicador: PublicadorDeEventos,
    private readonly tenant: TenantDoContexto,
    private readonly relogio: Relogio,
  ) {}

  async enviar(pedido: PedidoDeMensagem): Promise<ResultadoDoEnvio> {
    const contexto: ContextoDeMensagem =
      pedido.contexto ?? (pedido.finalidade === 'marketing' ? 'marketing' : 'cobranca');
    const base = { alunoId: pedido.alunoId, finalidade: pedido.finalidade, contexto };

    const contato = await this.alunos.contato(pedido.alunoId);
    if (!contato) {
      return this.recusar(base, pedido.canal ?? 'whatsapp', 'aluno_nao_encontrado');
    }
    if (!(await this.consentimentos.elegivel(pedido.alunoId, pedido.finalidade))) {
      return this.recusar(base, pedido.canal ?? 'whatsapp', 'sem_consentimento');
    }

    const canal = await this.escolherCanal(contato, pedido.canal);
    if (typeof canal !== 'string') {
      return this.recusar(base, pedido.canal ?? 'whatsapp', canal.motivo);
    }

    let texto: string;
    try {
      texto = await this.resolvedor.resolver(
        pedido.modelo ?? MODELO_DE_COBRANCA,
        contexto,
        pedido.alunoId,
        pedido.variaveis,
      );
    } catch (err) {
      if (err instanceof ModeloInvalidoError) {
        return this.recusar(base, canal, 'modelo_invalido');
      }
      throw err;
    }

    try {
      const idExterno = await this.transmitir(canal, contato, texto, pedido, contexto);
      const gravada = await this.repositorio.criar({
        ...base,
        direcao: 'enviada',
        canal,
        texto,
        estado: 'enviada',
        motivo: null,
        idExterno,
        criadoEm: this.relogio.agora(),
      });
      return { enviada: true, mensagemId: gravada.id, canal };
    } catch (err) {
      this.logger.error({ err, canal }, 'O provedor recusou a mensagem');
      return this.recusar(base, canal, 'falha_no_provedor', texto, 'falha');
    }
  }

  /** Webhook de status e de resposta; roda dentro do tenant da rota. */
  async aoReceber(evento: EventoDoWhatsapp): Promise<'processado' | 'recurso-nao-encontrado'> {
    const agora = this.relogio.agora();
    if (evento.tipo === 'status') {
      const mensagem = await this.repositorio.porIdExterno(evento.idExterno);
      if (!mensagem || mensagem.direcao !== 'enviada') {
        return 'recurso-nao-encontrado';
      }
      await this.repositorio.atualizarEstado(mensagem.id, evento.status, agora);
      return 'processado';
    }

    const alunoId = await this.alunos.idPorTelefone(evento.telefone);
    if (!alunoId) {
      // Número que não é de aluno desta academia: nada é guardado.
      return 'processado';
    }
    const recebida = await this.repositorio.criar({
      alunoId,
      direcao: 'recebida',
      canal: 'whatsapp',
      finalidade: null,
      contexto: null,
      texto: evento.texto,
      estado: 'recebida',
      motivo: null,
      idExterno: evento.idExterno,
      criadoEm: agora,
    });
    if (ehPedidoDeSaida(evento.texto)) {
      await this.consentimentos.registrar({
        alunoId,
        finalidade: 'marketing',
        decisao: 'revogacao',
        origem: 'whatsapp-sair',
      });
    }
    await this.publicador.publicar({
      tipo: 'MensagemRecebida',
      payload: {
        mensagemId: recebida.id,
        conversaId: alunoId,
        alunoId,
        canal: 'whatsapp',
        recebidaEm: agora.toISOString(),
      },
    });
    return 'processado';
  }

  async doAluno(alunoId: string) {
    return this.repositorio.doAluno(alunoId);
  }

  private async escolherCanal(
    contato: ContatoDoAluno,
    pedido: CanalDeMensagem | undefined,
  ): Promise<CanalDeMensagem | { motivo: MotivoDaRecusa }> {
    const whatsappPossivel = Boolean(contato.telefone) && (await this.conexoes.whatsappConectado());
    if (pedido === 'whatsapp') {
      if (!contato.telefone) {
        return { motivo: 'sem_telefone' };
      }
      return whatsappPossivel ? 'whatsapp' : { motivo: 'whatsapp_nao_conectado' };
    }
    if (pedido === 'email') {
      return contato.email ? 'email' : { motivo: 'sem_email' };
    }
    if (whatsappPossivel) {
      return 'whatsapp';
    }
    if (contato.email) {
      return 'email';
    }
    return { motivo: contato.telefone ? 'whatsapp_nao_conectado' : 'sem_canal' };
  }

  private async transmitir(
    canal: CanalDeMensagem,
    contato: ContatoDoAluno,
    texto: string,
    pedido: PedidoDeMensagem,
    contexto: ContextoDeMensagem,
  ): Promise<string | null> {
    if (canal === 'whatsapp') {
      const { idExterno } = await this.whatsapp.enviar({
        tenantId: this.tenant.id(),
        telefone: paraWhatsapp(contato.telefone as string),
        texto,
      });
      return idExterno;
    }
    await this.email.enviar({
      para: contato.email as string,
      assunto: pedido.assunto ?? ASSUNTO_PADRAO[contexto],
      texto,
      finalidade: pedido.finalidade,
    });
    return null;
  }

  private async recusar(
    base: {
      alunoId: string;
      finalidade: PedidoDeMensagem['finalidade'];
      contexto: ContextoDeMensagem;
    },
    canal: CanalDeMensagem,
    motivo: MotivoDaRecusa,
    texto = '',
    estado: EstadoDaMensagem = 'recusada',
  ): Promise<ResultadoDoEnvio> {
    const gravada = await this.repositorio.criar({
      ...base,
      direcao: 'enviada',
      canal,
      texto,
      estado,
      motivo,
      idExterno: null,
      criadoEm: this.relogio.agora(),
    });
    return { enviada: false, mensagemId: gravada.id, motivo };
  }
}
