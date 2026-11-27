import type { ConfiguracaoDeTutorial } from '@gymos/ui';

/** `TutAlunos.html`: quatro blocos, com os alvos `data-tutorial` da lista. */
export const TUTORIAL_ALUNOS: ConfiguracaoDeTutorial = {
  passos: [
    { alvo: 'lista', numero: 1, texto: 'Lista com plano e situação. Use os ícones de ação' },
    { alvo: 'filtros', numero: 2, texto: 'Filtre por situação de pagamento e plano' },
    { alvo: 'cabecalho', numero: 3, texto: 'Pesquise ou cadastre um aluno' },
    { alvo: 'abas', numero: 4, texto: 'Alterne entre a lista e a importação por planilha' },
  ],
};
