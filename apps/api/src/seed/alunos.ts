import {
  RepositorioDeCredenciaisDeAluno,
  CifraDeSenha,
} from '../modules/autenticacao/application/portas';
import { Alunos } from '../modules/alunos/application/alunos';
import {
  RepositorioDeAlunos,
  RepositorioDeContratos,
  RepositorioDePlanos,
} from '../modules/alunos/application/portas';
import { avaliarContrato, CONFIGURACAO_PADRAO } from '../modules/alunos/domain/contrato';
import type { DadosDoPlano } from '../modules/alunos/domain/plano';
import type { DataCivil } from '../modules/platform/domain/relogio';
import { SENHA_DO_SEED } from './autenticacao';
import type { ModuloDeSeed } from './modulo-de-seed';

/** Dia de referência das telas e do E2E (RELOGIO_PADRAO: 19/11/2026 em São Paulo). */
export const HOJE_DO_SEED = '2026-11-19' as DataCivil;

/** Planos de Planos.html (Aulas coletivas inativo, Anual em 9x). */
export const PLANOS_DO_SEED: readonly DadosDoPlano[] = [
  plano('Mensal', 11900, 1, 1, ['Musculação']),
  plano('Trimestral', 29700, 3, 3, ['Musculação']),
  plano('Semestral', 53400, 6, 6, ['Musculação', 'Aulas']),
  plano('Anual', 94800, 12, 9, ['Musculação', 'Spinning', 'Funcional', 'Lutas']),
  plano('Casal', 18900, 1, 1, ['Musculação']),
  { ...plano('Aulas coletivas', 14900, 1, 1, ['Aulas']), ativo: false },
];

function plano(
  nome: string,
  valorTotalCentavos: number,
  duracaoMeses: number,
  parcelas: number,
  modalidades: string[],
): DadosDoPlano {
  return {
    nome,
    valorTotalCentavos,
    duracaoMeses,
    parcelas,
    formaDeCobranca: 'cartao_ou_pix',
    modalidades,
    acessosPorSemana: null,
    renovacaoAutomatica: true,
    ativo: true,
  };
}

/** Aluno do app no E2E (papel `aluno`): entra pelo e-mail ou pelo CPF com a senha do seed. */
export const ALUNO_DO_APP = {
  nome: 'Pedro Almeida',
  cpf: '12345678909',
  email: 'pedro.almeida@email.com',
} as const;

interface AlunoDoSeed {
  nome: string;
  cpf: string;
  email?: string;
  telefone?: string;
  plano: string;
  inicio: string;
  vencimentoEmAtraso?: string;
  proximoVencimento?: string;
}

/**
 * Os alunos de Alunos.html em 19/11/2026: Rafael 6 dias em atraso ("encerra em 1 dia"), Juliana 2,
 * Camila vence em 3 dias. Pedro fica no plano Mensal (docs/design/inconsistencias.md).
 */
export const ALUNOS_DO_SEED: readonly AlunoDoSeed[] = [
  {
    nome: 'Rafael Souza',
    cpf: '52998224725',
    plano: 'Mensal',
    inicio: '2026-11-13',
    vencimentoEmAtraso: '2026-11-13',
  },
  {
    nome: 'Camila Duarte',
    cpf: '11144477735',
    plano: 'Trimestral',
    inicio: '2026-09-22',
    proximoVencimento: '2026-11-22',
  },
  {
    ...ALUNO_DO_APP,
    telefone: '11988887777',
    plano: 'Mensal',
    inicio: '2026-11-14',
    proximoVencimento: '2026-12-14',
  },
  {
    nome: 'Juliana Prado',
    cpf: '39053344705',
    plano: 'Mensal',
    inicio: '2026-11-17',
    vencimentoEmAtraso: '2026-11-17',
  },
  {
    nome: 'Bruno Lima',
    cpf: '87654321007',
    plano: 'Trimestral',
    inicio: '2026-10-05',
    proximoVencimento: '2026-12-05',
  },
  {
    nome: 'Marina Costa',
    cpf: '23456789092',
    plano: 'Semestral',
    inicio: '2026-08-10',
    proximoVencimento: '2026-12-10',
  },
  {
    nome: 'Paulo Reis',
    cpf: '34567890175',
    plano: 'Mensal',
    inicio: '2026-11-02',
    proximoVencimento: '2026-12-02',
  },
  {
    nome: 'Larissa Nunes',
    cpf: '45678901249',
    plano: 'Anual',
    inicio: '2026-03-01',
    proximoVencimento: '2026-12-01',
  },
];

const comoDia = (valor: string | undefined): DataCivil | null =>
  valor ? (valor as DataCivil) : null;

/** Planos, alunos com contrato e o acesso ao app do Pedro. Idempotente: pelo nome do plano e pelo CPF. */
export const seedDosAlunos: ModuloDeSeed = {
  nome: 'alunos',
  dependeDe: ['autenticacao'],
  async executar(app, contexto) {
    const planos = app.get(RepositorioDePlanos);
    const repositorio = app.get(RepositorioDeAlunos);
    const contratos = app.get(RepositorioDeContratos);
    const alunos = app.get(Alunos);
    const credenciais = app.get(RepositorioDeCredenciaisDeAluno);
    const cifra = app.get(CifraDeSenha);
    await contexto.noTenant(async () => {
      const idDoPlano = new Map<string, string>();
      for (const dados of PLANOS_DO_SEED) {
        const existente = await planos.porNome(dados.nome);
        idDoPlano.set(dados.nome, (existente ?? (await planos.criar(dados))).id);
      }
      for (const dados of ALUNOS_DO_SEED) {
        if (await repositorio.idPorCpf(dados.cpf)) {
          continue;
        }
        const aluno = await alunos.cadastrar(null, {
          nome: dados.nome,
          cpf: dados.cpf,
          telefone: dados.telefone ?? null,
          email: dados.email ?? null,
          dataNascimento: null,
          professorId: null,
          meta: null,
          restricoes: null,
          leadId: null,
          consentimentos: [{ finalidade: 'marketing', decisao: 'aceite' }],
          planoId: idDoPlano.get(dados.plano) ?? '',
          inicioDoContrato: dados.inicio as DataCivil,
        });
        const contrato = await contratos.vigenteDoAluno(aluno.id);
        if (contrato) {
          const parcelas = {
            vencimentoEmAtraso: comoDia(dados.vencimentoEmAtraso),
            proximoVencimento: comoDia(dados.proximoVencimento),
          };
          const { estado } = avaliarContrato(
            { ...contrato, ...parcelas },
            HOJE_DO_SEED,
            CONFIGURACAO_PADRAO,
          );
          await contratos.atualizar(contrato.id, { ...parcelas, estado });
        }
        if (dados.email) {
          await credenciais.salvar({
            alunoId: aluno.id,
            senhaHash: await cifra.cifrar(SENHA_DO_SEED),
          });
        }
      }
    });
  },
};
