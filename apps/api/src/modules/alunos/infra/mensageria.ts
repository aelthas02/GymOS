import { Injectable } from '@nestjs/common';
import { centavos, formatarBrl, ratear } from '@gymos/shared-money';
import { formatarDataBr } from '@gymos/shared-pipes/formatadores';
import type { VariavelDeMensagem } from '@gymos/shared-templates';
import type {
  ContatoDoAluno,
  FonteDeContatos,
  ProvedorDeVariavel,
} from '../../integracoes/application/portas';
import { RepositorioDeAlunos, RepositorioDeContratos } from '../application/portas';

/** Contatos dos alunos para a Mensageria (T13d): nome, telefone e e-mail revelados só no envio. */
@Injectable()
export class ContatosDosAlunos implements FonteDeContatos {
  constructor(private readonly alunos: RepositorioDeAlunos) {}

  contato(alunoId: string): Promise<ContatoDoAluno | null> {
    return this.alunos.contato(alunoId);
  }

  idPorTelefone(telefone: string): Promise<string | null> {
    return this.alunos.idPorTelefone(telefone);
  }
}

/**
 * Variáveis de mensagem cujos dados são do domínio de alunos: `{nome}` (primeiro nome), `{plano}`,
 * `{vencimento}` (parcela em atraso mais antiga, senão a próxima) e `{valor}` (parcela do plano).
 * `{professor}` é do domínio de funcionários e `{link}`, da cobrança.
 */
@Injectable()
export class VariaveisDeMensagemDosAlunos {
  constructor(
    private readonly alunos: RepositorioDeAlunos,
    private readonly contratos: RepositorioDeContratos,
  ) {}

  provedores(): ProvedorDeVariavel[] {
    const de = (
      variavel: VariavelDeMensagem,
      valor: (alunoId: string) => Promise<string | null>,
    ): ProvedorDeVariavel => ({ variavel, valor });
    return [
      de('nome', async (alunoId) => {
        const nome = await this.alunos.nome(alunoId);
        return nome ? (nome.split(' ')[0] ?? nome) : null;
      }),
      de(
        'plano',
        async (alunoId) => (await this.contratos.vigenteDoAluno(alunoId))?.planoNome ?? null,
      ),
      de('vencimento', async (alunoId) => {
        const contrato = await this.contratos.vigenteDoAluno(alunoId);
        const dia = contrato?.vencimentoEmAtraso ?? contrato?.proximoVencimento;
        return dia ? formatarDataBr(dia) : null;
      }),
      de('valor', async (alunoId) => {
        const contrato = await this.contratos.vigenteDoAluno(alunoId);
        if (!contrato) {
          return null;
        }
        const [parcela] = ratear(centavos(contrato.valorTotalCentavos), contrato.parcelas);
        return parcela === undefined ? null : formatarBrl(parcela);
      }),
    ];
  }
}
