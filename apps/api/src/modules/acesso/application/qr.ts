import { Injectable } from '@nestjs/common';
import {
  type QrEmitido,
  emitirQr,
  gerarParDeChavesDoQr,
  motivoDeNegacaoDoQr,
  verificarQr,
  type MotivoDeNegacao,
} from '@gymos/shared-acesso';
import { Relogio } from '../../platform/domain/relogio';
import { AcademiaAtual, RegistroDeQrUsado, RepositorioDeChavesDeQr } from './portas';

/** Folga para esquecer nonces: muito além dos 65 s em que um token ainda pode ser aceito. */
const RETENCAO_DOS_NONCES_MS = 24 * 60 * 60 * 1000;

export type ConferenciaDoQrNoServidor =
  | { ok: true; alunoId: string }
  | {
      ok: false;
      motivo: Extract<MotivoDeNegacao, 'qr_ja_usado' | 'qr_expirado' | 'qr_invalido'>;
      alunoId: string | null;
    };

/**
 * QR de check-in do app (T23a). O servidor emite com a chave privada da academia (cifrada em repouso)
 * e confere assinatura, academia e validade; o nonce é consumido na tabela com unicidade, o que
 * garante o uso único mesmo com duas leituras simultâneas.
 */
@Injectable()
export class QrDeCheckin {
  constructor(
    private readonly chaves: RepositorioDeChavesDeQr,
    private readonly usados: RegistroDeQrUsado,
    private readonly academia: AcademiaAtual,
    private readonly relogio: Relogio,
  ) {}

  async emitir(alunoId: string): Promise<QrEmitido> {
    const chave = (await this.chaves.ativaComPrivada()) ?? (await this.criarChave());
    return emitirQr({
      chavePrivada: chave.chavePrivada,
      chaveId: chave.id,
      tenantId: this.academia.id(),
      alunoId,
      agora: this.relogio.agora(),
    });
  }

  private async criarChave(): Promise<{ id: string; chavePrivada: string }> {
    const par = gerarParDeChavesDoQr();
    const criada = await this.chaves.criar(par);
    return { id: criada.id, chavePrivada: par.chavePrivada };
  }

  /** Chaves públicas para o agente conferir o QR offline (`kid` → SPKI em base64). */
  async chavesPublicas(): Promise<Record<string, string>> {
    const validas = await this.chaves.validas();
    return Object.fromEntries(validas.map((chave) => [chave.id, chave.chavePublica]));
  }

  /** Confere o token e consome o nonce. Só devolve `ok` na primeira apresentação de um QR válido. */
  async conferir(token: string): Promise<ConferenciaDoQrNoServidor> {
    const agora = this.relogio.agora();
    const resultado = verificarQr(token, {
      chavesPublicas: await this.chavesPublicas(),
      tenantId: this.academia.id(),
      agora,
    });
    if (!resultado.ok) {
      return { ok: false, motivo: motivoDeNegacaoDoQr(resultado.motivo), alunoId: null };
    }
    const { alunoId, nonce } = resultado.qr;
    if (!(await this.usados.consumir(nonce, alunoId, agora))) {
      return { ok: false, motivo: 'qr_ja_usado', alunoId };
    }
    await this.usados.limparAntesDe(new Date(agora.getTime() - RETENCAO_DOS_NONCES_MS));
    return { ok: true, alunoId };
  }

  /** Registra um nonce usado offline (sincronização do agente); `false` se já constava. */
  registrarUsoOffline(nonce: string, alunoId: string, usadoEm: Date): Promise<boolean> {
    return this.usados.consumir(nonce, alunoId, usadoEm);
  }
}
