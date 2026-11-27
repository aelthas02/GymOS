import type { Exercicio, Modelo } from '../../application/portas';
import type { FichaDoAluno, ItemDaTabelaDeFichas } from '../../application/treinos';
import { totalDeExercicios } from '../../domain/ficha';
import type { ExercicioDto, FichaDto, LinhaDeFichaDto, ModeloDto } from './dto';

export const exercicioDto = (exercicio: Exercicio): ExercicioDto => ({ ...exercicio });

export const modeloDto = (modelo: Modelo): ModeloDto => ({
  ...modelo,
  totalDeExercicios: totalDeExercicios(modelo.treinos),
});

export const fichaDto = (item: FichaDoAluno): FichaDto => ({
  id: item.ficha.id,
  alunoId: item.ficha.alunoId,
  alunoNome: item.alunoNome,
  nome: item.ficha.nome,
  objetivo: item.ficha.objetivo,
  nivel: item.ficha.nivel,
  frequenciaSemanal: item.ficha.frequenciaSemanal,
  divisao: item.ficha.divisao,
  validaAte: item.ficha.validaAte,
  restricoes: item.ficha.restricoes,
  professorId: item.ficha.professorId,
  professorNome: item.professorNome,
  situacao: item.situacao,
  origem: item.ficha.origem,
  aprovadaPor: item.aprovadaPorNome,
  aprovadaEm: item.ficha.aprovadaEm?.toISOString() ?? null,
  treinos: item.ficha.treinos,
});

export const linhaDeFichaDto = (item: ItemDaTabelaDeFichas): LinhaDeFichaDto => ({
  fichaId: item.ficha.id,
  alunoId: item.ficha.alunoId,
  alunoNome: item.alunoNome,
  nome: item.ficha.nome,
  professorNome: item.professorNome,
  validaAte: item.ficha.validaAte,
  situacao: item.situacao,
  venceEmDias: item.venceEmDias,
});
