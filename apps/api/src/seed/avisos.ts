import { RepositorioDeAlunos } from '../modules/alunos/application/portas';
import { RepositorioDeAvisos } from '../modules/avisos/application/portas';
import type { TipoDeAviso } from '../modules/avisos/domain/aviso';
import type { ModuloDeSeed } from './modulo-de-seed';

interface AvisoDoSeed {
  tipo: TipoDeAviso;
  titulo: string;
  texto: string;
  link: string | null;
  criadoEm: string;
  lido: boolean;
}

/**
 * Avisos de AlunoAvisos.html para o Pedro, com o dia de referência de 19/11/2026 (quinta): dois não
 * lidos ("Plano vence em 14/dez" e "Zumba aos sábados, 9h"), os demais lidos.
 */
export const AVISOS_DO_PEDRO: readonly AvisoDoSeed[] = [
  {
    tipo: 'plano',
    titulo: 'Plano vence em 14/dez',
    texto: 'Renove com 1 toque e mantenha seus acessos.',
    link: '/plano',
    criadoEm: '2026-11-19T09:00:00-03:00',
    lido: false,
  },
  {
    tipo: 'aula',
    titulo: 'Zumba aos sábados, 9h',
    texto: 'Nova turma com a Profa. Camila. Reserve pelo app.',
    link: '/aulas',
    criadoEm: '2026-11-18T18:00:00-03:00',
    lido: false,
  },
  {
    tipo: 'reserva',
    titulo: 'Reserva confirmada',
    texto: 'Spinning, quarta 18h30, bike 12.',
    link: '/aulas',
    criadoEm: '2026-11-18T10:30:00-03:00',
    lido: true,
  },
  {
    tipo: 'ficha',
    titulo: 'Ficha atualizada',
    texto: 'Seu professor ajustou o treino A.',
    link: '/treino',
    criadoEm: '2026-11-16T08:00:00-03:00',
    lido: true,
  },
  {
    tipo: 'comunicado',
    titulo: 'Manutenção da piscina',
    texto: 'Fechada no domingo, das 8h às 12h.',
    link: null,
    criadoEm: '2026-11-14T12:00:00-03:00',
    lido: true,
  },
];

/** Avisos do Pedro (o aluno do E2E do app). Idempotente: só cria quando ele ainda não tem avisos. */
export const seedDosAvisos: ModuloDeSeed = {
  nome: 'avisos',
  dependeDe: ['alunos'],
  async executar(app, contexto) {
    const avisos = app.get(RepositorioDeAvisos);
    const alunos = app.get(RepositorioDeAlunos);
    await contexto.noTenant(async () => {
      const pedroId = await alunos.idPorEmail('pedro.almeida@email.com');
      if (!pedroId) {
        throw new Error('Seed de avisos: o aluno Pedro Almeida não foi encontrado.');
      }
      const destinatario = { tipo: 'aluno', id: pedroId } as const;
      if ((await avisos.doDestinatario(destinatario)).length > 0) {
        return;
      }
      await avisos.criar(
        AVISOS_DO_PEDRO.map(({ lido, criadoEm, ...dados }) => ({
          destinatario,
          ...dados,
          criadoEm: new Date(criadoEm),
          lidoEm: lido ? new Date(criadoEm) : null,
        })),
      );
    });
  },
};
