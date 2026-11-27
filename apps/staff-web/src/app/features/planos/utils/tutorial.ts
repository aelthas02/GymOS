import type { ConfiguracaoDeTutorial } from '@gymos/ui';

/** `TutPlanos.html`: três blocos, com os alvos `data-tutorial` da página. */
export const TUTORIAL_PLANOS: ConfiguracaoDeTutorial = {
  passos: [
    { alvo: 'lista', numero: 1, texto: 'Planos vendidos, com valor, parcelas e status' },
    { alvo: 'painel', numero: 2, texto: 'Crie ou edite um plano aqui' },
    { alvo: 'cabecalho', numero: 3, texto: 'Pesquise um plano ou crie um novo' },
  ],
};
