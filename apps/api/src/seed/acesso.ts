import { createHash } from 'node:crypto';
import type { DirecaoDeAcesso, MotivoDeNegacao, ResultadoDeAcesso } from '@gymos/shared-acesso';
import { RepositorioDeAlunos } from '../modules/alunos/application/portas';
import { somarDias } from '../modules/alunos/domain/datas';
import { RepositorioDeAcessos } from '../modules/acesso/application/portas';
import type { DataCivil } from '../modules/platform/domain/relogio';
import { ALUNOS_DO_SEED, HOJE_DO_SEED } from './alunos';
import type { ModuloDeSeed } from './modulo-de-seed';

/** UUID determinístico (formato v4) de um nome: o seed regrava sem duplicar. */
function idDoSeed(nome: string): string {
  const h = createHash('sha256').update(`acesso-seed:${nome}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * Quantos dias distintos cada aluno de Alunos.html treinou nos 30 dias antes de 19/11/2026 e há
 * quantos dias foi a última vez: Larissa treina bem; Camila não vem há 15 dias (alerta urgente).
 */
const FREQUENCIA_DO_SEED: Readonly<Record<string, { treinos: number; ultimoHaDias: number }>> = {
  'Larissa Nunes': { treinos: 12, ultimoHaDias: 1 },
  'Bruno Lima': { treinos: 9, ultimoHaDias: 2 },
  'Marina Costa': { treinos: 8, ultimoHaDias: 1 },
  'Paulo Reis': { treinos: 5, ultimoHaDias: 3 },
  'Pedro Almeida': { treinos: 4, ultimoHaDias: 1 },
  'Camila Duarte': { treinos: 6, ultimoHaDias: 15 },
};

/** Horas de entrada que se repetem (o pico das telas é às 18h). */
const HORAS = ['06:30', '07:15', '12:10', '18:00', '18:20', '19:05'];

const emSaoPaulo = (dia: DataCivil, hora: string): Date => new Date(`${dia}T${hora}:00-03:00`);

interface AcessoDoSeed {
  nome: string;
  dia: DataCivil;
  hora: string;
  direcao: DirecaoDeAcesso;
  resultado: ResultadoDeAcesso;
  motivo: MotivoDeNegacao | null;
  metodo: 'facial' | 'biometria' | 'qr_code';
}

function acessosDoSeed(): AcessoDoSeed[] {
  const lista: AcessoDoSeed[] = [];
  for (const [nome, { treinos, ultimoHaDias }] of Object.entries(FREQUENCIA_DO_SEED)) {
    const alcance = 30 - ultimoHaDias;
    for (let i = 0; i < treinos; i += 1) {
      // Espalha os treinos entre o último dia e 30 dias atrás, sem repetir o dia.
      const dia = somarDias(HOJE_DO_SEED, -(ultimoHaDias + Math.floor((i * alcance) / treinos)));
      const hora = HORAS[(i + nome.length) % HORAS.length] ?? '18:00';
      lista.push({
        nome,
        dia,
        hora,
        direcao: 'entrada',
        resultado: 'liberado',
        motivo: null,
        metodo: 'facial',
      });
      lista.push({
        nome,
        dia,
        hora: `${String(Number(hora.slice(0, 2)) + 1).padStart(2, '0')}${hora.slice(2)}`,
        direcao: 'saida',
        resultado: 'liberado',
        motivo: null,
        metodo: 'facial',
      });
    }
  }
  // AcessoAoVivo.html: hoje Rafael (6 dias de atraso) é barrado e Juliana (2 dias) entra na tolerância.
  lista.push(
    {
      nome: 'Rafael Souza',
      dia: HOJE_DO_SEED,
      hora: '08:12',
      direcao: 'entrada',
      resultado: 'negado',
      motivo: 'mensalidade_em_atraso',
      metodo: 'biometria',
    },
    {
      nome: 'Juliana Prado',
      dia: HOJE_DO_SEED,
      hora: '08:20',
      direcao: 'entrada',
      resultado: 'tolerancia',
      motivo: null,
      metodo: 'biometria',
    },
  );
  return lista;
}

/**
 * Passagens dos alunos de Alunos.html nos 30 dias que terminam em 19/11/2026, gravadas sem evento (como
 * os pagamentos do seed). Idempotente: o id de origem é derivado do aluno, do dia e da hora.
 */
export const seedDoAcesso: ModuloDeSeed = {
  nome: 'acesso',
  dependeDe: ['alunos', 'parcelas'],
  async executar(app, contexto) {
    const alunos = app.get(RepositorioDeAlunos);
    const acessos = app.get(RepositorioDeAcessos);
    await contexto.noTenant(async () => {
      const unidadeId = await alunos.unidadePadrao();
      const idDoAluno = new Map<string, string>();
      for (const dados of ALUNOS_DO_SEED) {
        const id = await alunos.idPorCpf(dados.cpf);
        if (id) {
          idDoAluno.set(dados.nome, id);
        }
      }
      for (const item of acessosDoSeed()) {
        const alunoId = idDoAluno.get(item.nome);
        if (!alunoId) {
          continue;
        }
        await acessos.criar({
          idDeOrigem: idDoSeed(`${item.nome}:${item.dia}:${item.hora}:${item.direcao}`),
          unidadeId,
          alunoId,
          metodo: item.metodo,
          direcao: item.direcao,
          resultado: item.resultado,
          motivo: item.motivo,
          modalidade: null,
          dispositivoId: null,
          registradoEm: emSaoPaulo(item.dia, item.hora),
          registradoPor: null,
          observacao: null,
        });
      }
    });
  },
};
