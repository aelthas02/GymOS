import type { Schemas } from '@gymos/api-contracts';

export type PainelDeFichas = Schemas['PainelDeFichasDto'];
export type LinhaDeFicha = Schemas['LinhaDeFichaDto'];
export type FichaSugerida = Schemas['FichaSugeridaDto'];
export type Ficha = Schemas['FichaDto'];
export type TreinoDaFicha = Schemas['TreinoDaFichaDto'];
export type ExercicioDaFicha = Schemas['ExercicioDaFichaDto'];
export type Exercicio = Schemas['ExercicioDto'];
export type DadosDoExercicio = Schemas['DadosDoExercicioDto'];
export type Modelo = Schemas['ModeloDto'];
export type SalvarFicha = Schemas['SalvarFichaDto'];
export type GerarFicha = Schemas['GerarFichaDto'];
export type Divisao = Schemas['SalvarFichaDto']['divisao'];
export type Nivel = Schemas['SalvarFichaDto']['nivel'];

export type EstadoDaTela = 'carregando' | 'pronto' | 'erro' | 'sem-permissao';

/** Linha editável de um exercício: texto como o usuário digita, convertido ao salvar. */
export interface ExercicioEditavel {
  exercicioId: string | null;
  nome: string;
  series: string;
  repeticoes: string;
  /** "Corpo" ou vazio é peso do corpo. */
  carga: string;
  descanso: string;
  videoUrl: string;
}

export interface TreinoEditavel {
  nome: string;
  foco: string;
  exercicios: ExercicioEditavel[];
}
