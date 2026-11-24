import { gerarIndice } from './visual/relatorio';

/** Fim da execução: monta o índice do relatório de diferenças visuais (artefato do CI). */
export default async function encerrar(): Promise<void> {
  await gerarIndice();
}
