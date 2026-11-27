import type { ConfiguracaoDeTutorial } from '@gymos/ui';

/** `TutTreinos.html`: cinco blocos, com os alvos `data-tutorial` da tela de fichas. */
export const TUTORIAL_TREINOS: ConfiguracaoDeTutorial = {
  passos: [
    { alvo: 'lista', numero: 1, texto: 'Fichas dos alunos: abra, edite ou aprove' },
    { alvo: 'sugeridas', numero: 2, texto: 'Rascunhos da IA aguardando revisão' },
    { alvo: 'indicadores', numero: 3, texto: 'Situação geral das fichas' },
    { alvo: 'abas', numero: 4, texto: 'Fichas, modelos e biblioteca de exercícios' },
    { alvo: 'cabecalho', numero: 5, texto: 'Crie uma nova ficha' },
  ],
};

/** Tutoriais das telas de Treinos sem `Tut*.html` próprio (o "?" existe nas referências). */
export const TUTORIAL_MODELOS: ConfiguracaoDeTutorial = {
  passos: [
    {
      alvo: 'cartoes',
      numero: 1,
      texto: 'Cada cartão é um modelo: use para criar uma ficha ou edite',
    },
    { alvo: 'abas', numero: 2, texto: 'Fichas, modelos e biblioteca de exercícios' },
    { alvo: 'cabecalho', numero: 3, texto: 'Crie um novo modelo' },
  ],
};

export const TUTORIAL_BIBLIOTECA: ConfiguracaoDeTutorial = {
  passos: [
    { alvo: 'filtros', numero: 1, texto: 'Filtre os exercícios por grupo muscular' },
    { alvo: 'painel', numero: 2, texto: 'Cadastre um exercício com o vídeo do YouTube' },
    { alvo: 'cabecalho', numero: 3, texto: 'Comece um novo exercício' },
  ],
};

export const TUTORIAL_FICHA: ConfiguracaoDeTutorial = {
  passos: [
    { alvo: 'dados', numero: 1, texto: 'Objetivo, nível, divisão e validade da ficha' },
    { alvo: 'treinos', numero: 2, texto: 'Treinos em abas: arraste os exercícios para reordenar' },
    { alvo: 'movimento', numero: 3, texto: 'Veja o movimento e troque o vídeo do exercício' },
  ],
};
