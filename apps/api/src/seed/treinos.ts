import { RepositorioDeAlunos } from '../modules/alunos/application/portas';
import { somarDias } from '../modules/alunos/domain/datas';
import { RepositorioDeFuncionarios } from '../modules/funcionarios/application/portas';
import {
  RepositorioDeExecucoes,
  RepositorioDeExercicios,
  RepositorioDeFichas,
  RepositorioDeModelos,
} from '../modules/treinos/application/portas';
import type {
  Divisao,
  ExercicioDaFicha,
  Nivel,
  TreinoDaFicha,
} from '../modules/treinos/domain/ficha';
import type { DataCivil } from '../modules/platform/domain/relogio';
import { ALUNO_DO_APP, ALUNOS_DO_SEED, HOJE_DO_SEED } from './alunos';
import type { ModuloDeSeed } from './modulo-de-seed';

/** Biblioteca de TreinosBiblioteca.html. */
export const EXERCICIOS_DO_SEED = [
  { nome: 'Supino reto', grupoMuscular: 'Peito', equipamento: 'Barra', video: 'rT7DgCr-3pg' },
  {
    nome: 'Agachamento livre',
    grupoMuscular: 'Pernas',
    equipamento: 'Barra',
    video: 'bEv6CCg2BC8',
  },
  { nome: 'Remada curvada', grupoMuscular: 'Costas', equipamento: 'Barra', video: 'FWJR5Ve8bnQ' },
  {
    nome: 'Desenvolvimento',
    grupoMuscular: 'Ombros',
    equipamento: 'Halteres',
    video: 'qEwKCR5JCog',
  },
  { nome: 'Rosca direta', grupoMuscular: 'Braços', equipamento: 'Barra W', video: 'kwG2ipFRgfo' },
  { nome: 'Leg press', grupoMuscular: 'Pernas', equipamento: 'Máquina', video: 'IZxyjW7MPJQ' },
  { nome: 'Prancha', grupoMuscular: 'Abdômen', equipamento: 'Peso do corpo', video: 'ASdvN_XEl_c' },
  { nome: 'Puxada frontal', grupoMuscular: 'Costas', equipamento: 'Polia', video: 'CAwf7n6Luuc' },
] as const;

const COMPLEMENTARES = [
  'Supino inclinado',
  'Crucifixo',
  'Tríceps testa',
  'Tríceps corda',
  'Mergulho',
  'Elevação lateral',
  'Mesa flexora',
  'Afundo',
  'Stiff',
  'Remada baixa',
  'Rosca martelo',
  'Panturrilha em pé',
];

const DO_CORPO = new Set(['Mergulho', 'Prancha', 'Afundo']);

const exercicio = (nome: string, indice: number): ExercicioDaFicha => ({
  exercicioId: null,
  nome,
  series: 3 + (indice % 2),
  repeticoes: 10 + (indice % 3) * 2,
  cargaKg: DO_CORPO.has(nome) ? null : 10 + indice * 5,
  descansoSegundos: indice % 2 === 0 ? 60 : 45,
  videoUrl: null,
});

/** Distribui `total` exercícios do pool em treinos com os focos dados, em ordem. */
function treinosCom(focos: readonly string[], total: number): TreinoDaFicha[] {
  const pool = [...EXERCICIOS_DO_SEED.map((e) => e.nome), ...COMPLEMENTARES];
  const base = Math.floor(total / focos.length);
  const sobra = total % focos.length;
  let cursor = 0;
  return focos.map((foco, i) => {
    const quantidade = base + (i < sobra ? 1 : 0);
    const nomes = Array.from(
      { length: quantidade },
      () => pool[cursor++ % pool.length] ?? 'Prancha',
    );
    return {
      nome: focos.length === 1 ? 'Full body' : String.fromCharCode(65 + i),
      foco,
      exercicios: nomes.map(exercicio),
    };
  });
}

interface ModeloDoSeed {
  nome: string;
  divisao: Divisao;
  diasPorSemana: number;
  focos: readonly string[];
  /** Total de exercícios mostrado no cartão de TreinosModelos.html. */
  exercicios: number;
}

/** Cartões de TreinosModelos.html: dias e total de exercícios iguais aos da tela. */
export const MODELOS_DO_SEED: readonly ModeloDoSeed[] = [
  {
    nome: 'Hipertrofia A/B/C',
    divisao: 'ABC',
    diasPorSemana: 5,
    focos: ['Peito e tríceps', 'Costas e bíceps', 'Pernas e ombros'],
    exercicios: 18,
  },
  {
    nome: 'Emagrecimento',
    divisao: 'ABCD',
    diasPorSemana: 4,
    focos: ['Peito e costas', 'Pernas', 'Ombros e braços', 'Abdômen e cardio'],
    exercicios: 14,
  },
  {
    nome: 'Iniciante full body',
    divisao: 'full_body',
    diasPorSemana: 3,
    focos: ['Corpo inteiro'],
    exercicios: 10,
  },
  {
    nome: 'Força A/B',
    divisao: 'AB',
    diasPorSemana: 4,
    focos: ['Superiores', 'Inferiores'],
    exercicios: 12,
  },
  {
    nome: 'Funcional',
    divisao: 'ABC',
    diasPorSemana: 3,
    focos: ['Empurrar', 'Puxar', 'Pernas'],
    exercicios: 12,
  },
  {
    nome: 'Reabilitação ombro',
    divisao: 'ABC',
    diasPorSemana: 3,
    focos: ['Mobilidade', 'Estabilidade', 'Fortalecimento'],
    exercicios: 9,
  },
];

interface FichaDoSeed {
  aluno: string;
  professor: string;
  nome: string;
  objetivo: string;
  nivel: Nivel;
  divisao: Divisao;
  frequenciaSemanal: number;
  /** Dias a partir de 19/11/2026; nulo para a ficha ainda sem validade. */
  validaAte: DataCivil | null;
  restricoes: string | null;
  situacao: 'ativa' | 'aguardando_aprovacao';
  origem: 'manual' | 'ia';
  exercicios: number;
}

/**
 * Fichas de TreinosFichas.html. Marina vence em 31 dias (20/12), fora do KPI "Vencem em 30 dias":
 * é o que a tela mostra, e o KPI só conta até 30 (inconsistencias.md).
 */
export const FICHAS_DO_SEED: readonly FichaDoSeed[] = [
  {
    aluno: 'Paulo Reis',
    professor: 'Diego Martins',
    nome: 'Hipertrofia A/B/C',
    objetivo: 'Hipertrofia',
    nivel: 'intermediario',
    divisao: 'ABC',
    frequenciaSemanal: 4,
    validaAte: '2027-01-15' as DataCivil,
    restricoes: 'Lesão leve no ombro direito: evitar desenvolvimento acima da cabeça.',
    situacao: 'ativa',
    origem: 'manual',
    exercicios: 18,
  },
  {
    aluno: 'Marina Costa',
    professor: 'Lia Fernandes',
    nome: 'Emagrecimento',
    objetivo: 'Emagrecimento',
    nivel: 'iniciante',
    divisao: 'ABCD',
    frequenciaSemanal: 4,
    validaAte: '2026-12-20' as DataCivil,
    restricoes: null,
    situacao: 'ativa',
    origem: 'manual',
    exercicios: 14,
  },
  {
    aluno: 'Pedro Almeida',
    professor: 'Diego Martins',
    nome: 'Força A/B',
    objetivo: 'Força',
    nivel: 'intermediario',
    divisao: 'AB',
    frequenciaSemanal: 4,
    validaAte: null,
    restricoes: null,
    situacao: 'aguardando_aprovacao',
    origem: 'ia',
    exercicios: 12,
  },
  {
    aluno: 'Larissa Nunes',
    professor: 'Camila Rocha',
    nome: 'Funcional',
    objetivo: 'Condicionamento',
    nivel: 'intermediario',
    divisao: 'ABC',
    frequenciaSemanal: 3,
    validaAte: '2027-03-02' as DataCivil,
    restricoes: null,
    situacao: 'ativa',
    origem: 'manual',
    exercicios: 12,
  },
  {
    aluno: 'Bruno Lima',
    professor: 'Diego Martins',
    nome: 'Hipertrofia A/B/C',
    objetivo: 'Hipertrofia',
    nivel: 'avancado',
    divisao: 'ABC',
    frequenciaSemanal: 5,
    validaAte: null,
    restricoes: 'joelho sensível',
    situacao: 'aguardando_aprovacao',
    origem: 'ia',
    exercicios: 18,
  },
];

const FOCOS_DA_DIVISAO: Record<Divisao, readonly string[]> = {
  AB: ['Superiores', 'Inferiores'],
  ABC: ['Peito e tríceps', 'Costas e bíceps', 'Pernas e ombros'],
  ABCD: ['Peito e tríceps', 'Costas e bíceps', 'Pernas', 'Ombros e abdômen'],
  full_body: ['Corpo inteiro'],
};

/** Supino do Pedro: 32, 34, 36, 36, 38 e 40 kg em 6 semanas ("+8 kg em 6 semanas"). */
const SUPINO_DO_PEDRO = [32, 34, 36, 36, 38, 40];

/**
 * Biblioteca, modelos, fichas e as execuções do Pedro (evolução de carga). Idempotente: cada grupo só
 * é criado quando ainda está vazio ou pelo nome. Dia de referência: 19/11/2026.
 */
export const seedDosTreinos: ModuloDeSeed = {
  nome: 'treinos',
  dependeDe: ['funcionarios', 'alunos'],
  async executar(app, contexto) {
    const exercicios = app.get(RepositorioDeExercicios);
    const modelos = app.get(RepositorioDeModelos);
    const fichas = app.get(RepositorioDeFichas);
    const execucoes = app.get(RepositorioDeExecucoes);
    const alunos = app.get(RepositorioDeAlunos);
    const funcionarios = app.get(RepositorioDeFuncionarios);
    await contexto.noTenant(async () => {
      for (const dados of EXERCICIOS_DO_SEED) {
        if (!(await exercicios.porNome(dados.nome))) {
          await exercicios.criar({
            nome: dados.nome,
            grupoMuscular: dados.grupoMuscular,
            equipamento: dados.equipamento,
            videoUrl: `https://youtu.be/${dados.video}`,
            instrucoes: null,
          });
        }
      }
      for (const dados of MODELOS_DO_SEED) {
        if (!(await modelos.porNome(dados.nome))) {
          await modelos.criar({
            nome: dados.nome,
            divisao: dados.divisao,
            diasPorSemana: dados.diasPorSemana,
            treinos: treinosCom(dados.focos, dados.exercicios),
          });
        }
      }
      const professores = new Map(
        (await funcionarios.ativosPorCargo(['professor'])).map((f) => [f.nome, f.id]),
      );
      const cpfDe = new Map<string, string>([
        ...ALUNOS_DO_SEED.map((aluno) => [aluno.nome, aluno.cpf] as const),
        [ALUNO_DO_APP.nome, ALUNO_DO_APP.cpf],
      ]);
      const idDoAluno = async (nome: string): Promise<string> => {
        const cpf = cpfDe.get(nome);
        const id = cpf ? await alunos.idPorCpf(cpf) : null;
        if (!id) {
          throw new Error(`Seed de treinos: o aluno ${nome} não foi encontrado.`);
        }
        return id;
      };
      const agora = new Date('2026-11-19T12:00:00Z');
      for (const dados of FICHAS_DO_SEED) {
        const alunoId = await idDoAluno(dados.aluno);
        if (await fichas.atualDoAluno(alunoId, 'sistema:seed')) {
          continue;
        }
        const ativa = dados.situacao === 'ativa';
        await fichas.criar({
          alunoId,
          professorId: professores.get(dados.professor) ?? null,
          nome: dados.nome,
          objetivo: dados.objetivo,
          nivel: dados.nivel,
          frequenciaSemanal: dados.frequenciaSemanal,
          divisao: dados.divisao,
          validaAte: dados.validaAte,
          restricoes: dados.restricoes,
          situacao: dados.situacao,
          origem: dados.origem,
          treinos: treinosCom(FOCOS_DA_DIVISAO[dados.divisao], dados.exercicios),
          aprovadaPorId: null,
          aprovadaEm: ativa ? agora : null,
          atualizadaEm: agora,
        });
      }
      // Supino do Pedro: 6 registros semanais, de 8/10 a 19/11 (6 semanas).
      const pedroId = await idDoAluno(ALUNO_DO_APP.nome);
      if ((await execucoes.doAluno(pedroId)).length === 0) {
        for (const [indice, cargaKg] of SUPINO_DO_PEDRO.entries()) {
          const dia = somarDias(HOJE_DO_SEED, -42 + indice * 8) as DataCivil;
          await execucoes.registrar({
            alunoId: pedroId,
            fichaId: null,
            exercicio: 'Supino reto',
            cargaKg,
            esforco: 6 + (indice % 3),
            realizadoEm: new Date(`${dia}T12:00:00Z`),
          });
        }
      }
    });
  },
};
