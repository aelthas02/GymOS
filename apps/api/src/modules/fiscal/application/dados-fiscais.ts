import { Injectable } from '@nestjs/common';
import { validarCnpj } from '@gymos/shared-validation';
import { type Executor, RegistroDeAtividade } from '../../alunos/application/autoria';
import { type DataCivil, Relogio } from '../../platform/domain/relogio';
import { FUSO_FISCAL } from '../domain/nota-fiscal';
import { DadosDaNotaInvalidosError } from './erros';
import { type DadosFiscais, EmissorFiscal, RepositorioDaConfiguracaoFiscal } from './portas';

export type SituacaoDoCertificado = 'ausente' | 'valido' | 'vence_em_breve' | 'vencido';

export interface DadosFiscaisDaAcademia extends DadosFiscais {
  certificado: { validade: DataCivil | null; situacao: SituacaoDoCertificado };
  emissor: { provedor: string; conectado: boolean };
  /** Ainda sem linha salva: a tela mostra os campos vazios. */
  preenchido: boolean;
}

const DIAS_PARA_AVISAR_O_VENCIMENTO = 30;
const UM_DIA_MS = 24 * 60 * 60 * 1000;
/** ISS municipal: de 2% a 5% (LC 116/2003); aceita até 100% para não travar casos especiais. */
const ALIQUOTA_MAXIMA = 10_000;

const VAZIO: DadosFiscais = {
  razaoSocial: '',
  cnpj: '',
  regime: '',
  municipio: '',
  codigoDoServico: '',
  aliquotaIssPontosBase: 0,
  certificadoValidade: null,
  emitirNfseAoConfirmar: true,
  emitirNfceNaVenda: true,
  enviarAoAluno: true,
  emitirEmLote: false,
};

/** Bloco "Dados fiscais e notas" de Configurações (tela do T26c; os dados são deste domínio). */
@Injectable()
export class ConfiguracaoFiscal {
  constructor(
    private readonly repositorio: RepositorioDaConfiguracaoFiscal,
    private readonly emissor: EmissorFiscal,
    private readonly auditoria: RegistroDeAtividade,
    private readonly relogio: Relogio,
  ) {}

  async obter(): Promise<DadosFiscaisDaAcademia> {
    const salvo = await this.repositorio.obter();
    return this.completar(salvo ?? VAZIO, salvo !== null);
  }

  async salvar(
    executor: Executor,
    dados: Omit<DadosFiscais, 'certificadoValidade'>,
  ): Promise<DadosFiscaisDaAcademia> {
    const cnpj = dados.cnpj.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    if (!validarCnpj(cnpj)) {
      throw new DadosDaNotaInvalidosError('CNPJ inválido.');
    }
    if (dados.aliquotaIssPontosBase < 0 || dados.aliquotaIssPontosBase > ALIQUOTA_MAXIMA) {
      throw new DadosDaNotaInvalidosError('Alíquota do ISS fora do intervalo.');
    }
    const atual = await this.repositorio.obter();
    const salvo = await this.repositorio.salvar({
      ...dados,
      razaoSocial: dados.razaoSocial.trim(),
      regime: dados.regime.trim(),
      municipio: dados.municipio.trim(),
      codigoDoServico: dados.codigoDoServico.trim(),
      cnpj,
      certificadoValidade: atual?.certificadoValidade ?? null,
    });
    await this.auditoria.registrar(executor, {
      acao: 'alterou-dados-fiscais',
      detalhe: atual ? 'Dados fiscais e regra de emissão' : 'Cadastro dos dados fiscais',
    });
    return this.completar(salvo, true);
  }

  /** Certificado A1: vai ao emissor; aqui fica só a validade devolvida por ele. */
  async enviarCertificado(
    executor: Executor,
    arquivo: Buffer,
    senha: string,
  ): Promise<DadosFiscaisDaAcademia> {
    const atual = await this.repositorio.obter();
    if (!atual) {
      throw new DadosDaNotaInvalidosError('Salve os dados fiscais antes de enviar o certificado.');
    }
    if (arquivo.length === 0) {
      throw new DadosDaNotaInvalidosError('Arquivo do certificado vazio.');
    }
    const { validade } = await this.emissor.enviarCertificado(arquivo, senha);
    const salvo = await this.repositorio.salvar({ ...atual, certificadoValidade: validade });
    await this.auditoria.registrar(executor, {
      acao: 'alterou-dados-fiscais',
      detalhe: 'Trocou o certificado digital A1',
    });
    return this.completar(salvo, true);
  }

  private completar(dados: DadosFiscais, preenchido: boolean): DadosFiscaisDaAcademia {
    return {
      ...dados,
      certificado: {
        validade: dados.certificadoValidade,
        situacao: this.situacaoDoCertificado(dados.certificadoValidade),
      },
      emissor: { provedor: this.emissor.provedor, conectado: true },
      preenchido,
    };
  }

  private situacaoDoCertificado(validade: DataCivil | null): SituacaoDoCertificado {
    if (!validade) {
      return 'ausente';
    }
    const hoje = this.relogio.hojeEm(FUSO_FISCAL);
    if (validade < hoje) {
      return 'vencido';
    }
    const dias = Math.round(
      (Date.parse(`${validade}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / UM_DIA_MS,
    );
    return dias <= DIAS_PARA_AVISAR_O_VENCIMENTO ? 'vence_em_breve' : 'valido';
  }
}
