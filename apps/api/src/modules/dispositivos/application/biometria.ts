import { Injectable } from '@nestjs/common';
import { type Executor, AutoriaDoAcesso } from '../../acesso/application/autoria';
import { AlunosParaAcesso } from '../../acesso/application/portas';
import { Consentimentos } from '../../platform/application/protecao-de-dados';
import { Relogio } from '../../platform/domain/relogio';
import type { TipoDeBiometria } from '../domain/dispositivo';
import {
  ConsentimentoDeBiometriaNecessarioError,
  DispositivoInvalidoError,
  NaoEncontradoError,
} from './erros';
import {
  type CadastroBiometrico,
  RepositorioDeCadastrosBiometricos,
  RepositorioDeComandos,
  RepositorioDeDispositivos,
} from './portas';

/** Cadastrar face ou digital leva mais tempo que um ping: o agente tem 10 minutos. */
const VALIDADE_DO_CADASTRO_MS = 10 * 60 * 1000;
const VALIDADE_DA_REMOCAO_MS = 24 * 60 * 60 * 1000;

/**
 * Face e biometria (T23b): o servidor guarda só a referência devolvida pelo agente e o consentimento
 * `biometria` (T13c); o template nunca sai da rede da academia. O comando vai ao agente, que repassa
 * ao equipamento.
 */
@Injectable()
export class CadastrosBiometricos {
  constructor(
    private readonly cadastros: RepositorioDeCadastrosBiometricos,
    private readonly comandos: RepositorioDeComandos,
    private readonly dispositivos: RepositorioDeDispositivos,
    private readonly alunos: AlunosParaAcesso,
    private readonly consentimentos: Consentimentos,
    private readonly autoria: AutoriaDoAcesso,
    private readonly relogio: Relogio,
  ) {}

  async solicitar(
    executor: Executor,
    pedido: { alunoId: string; tipo: TipoDeBiometria; dispositivoId: string },
  ): Promise<CadastroBiometrico> {
    const aluno = await this.alunos.contexto(pedido.alunoId);
    if (!aluno) {
      throw new NaoEncontradoError('Aluno');
    }
    if (!(await this.consentimentos.elegivel(pedido.alunoId, 'biometria'))) {
      throw new ConsentimentoDeBiometriaNecessarioError();
    }
    const dispositivo = await this.dispositivos.porId(pedido.dispositivoId);
    if (!dispositivo) {
      throw new NaoEncontradoError('Dispositivo');
    }
    if (!dispositivo.agenteId) {
      throw new DispositivoInvalidoError(
        'O dispositivo ainda não está ligado a um agente pareado.',
      );
    }
    if (!dispositivo.metodos.includes(pedido.tipo)) {
      throw new DispositivoInvalidoError(`O dispositivo não aceita o método ${pedido.tipo}.`);
    }
    const agora = this.relogio.agora();
    const comando = await this.comandos.criar({
      agenteId: dispositivo.agenteId,
      dispositivoId: dispositivo.id,
      tipo: 'cadastrar_biometria',
      dados: { alunoId: pedido.alunoId, nome: aluno.nome, tipo: pedido.tipo },
      expiraEm: new Date(agora.getTime() + VALIDADE_DO_CADASTRO_MS),
    });
    const cadastro = await this.cadastros.salvar({
      alunoId: pedido.alunoId,
      tipo: pedido.tipo,
      dispositivoId: dispositivo.id,
      referencia: null,
      status: 'pendente',
      comandoId: comando.id,
      atualizadoEm: agora,
    });
    await this.autoria.registrar(executor, {
      acao: 'cadastrou-biometria',
      detalhe: `${aluno.nome}: cadastro de ${pedido.tipo === 'facial' ? 'face' : 'digital'} pedido no equipamento`,
    });
    return cadastro;
  }

  /** Resposta do agente ao comando de cadastro. */
  async concluir(comandoId: string, ok: boolean, referencia: string | null): Promise<void> {
    const cadastro = await this.cadastros.porComando(comandoId);
    if (cadastro) {
      await this.cadastros.atualizarStatus(
        cadastro.id,
        ok ? 'cadastrado' : 'falhou',
        ok ? referencia : null,
        this.relogio.agora(),
      );
    }
  }

  doAluno(alunoId: string): Promise<CadastroBiometrico[]> {
    return this.cadastros.doAluno(alunoId);
  }

  /** Pede ao agente que apague o cadastro do equipamento e apaga a referência (LGPD e remoção manual). */
  async removerDoAluno(alunoId: string): Promise<number> {
    const agora = this.relogio.agora();
    for (const cadastro of await this.cadastros.doAluno(alunoId)) {
      const dispositivo = cadastro.dispositivoId
        ? await this.dispositivos.porId(cadastro.dispositivoId)
        : null;
      if (dispositivo?.agenteId) {
        await this.comandos.criar({
          agenteId: dispositivo.agenteId,
          dispositivoId: dispositivo.id,
          tipo: 'remover_biometria',
          dados: { alunoId, tipo: cadastro.tipo, referencia: cadastro.referencia },
          expiraEm: new Date(agora.getTime() + VALIDADE_DA_REMOCAO_MS),
        });
      }
    }
    return this.cadastros.excluirDoAluno(alunoId);
  }
}
