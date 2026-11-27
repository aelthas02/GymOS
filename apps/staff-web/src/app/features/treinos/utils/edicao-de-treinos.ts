import { computed, signal } from '@angular/core';
import type { ExercicioEditavel, TreinoEditavel } from '../models/treinos';
import { exercicioEmBranco, proximaLetra } from './apresentacao';

/**
 * Estado de edição dos treinos (abas, exercícios, ordem), igual na ficha do aluno e no modelo. As
 * linhas são editadas no lugar; `editou()` só avisa os derivados.
 */
export class EdicaoDeTreinos {
  readonly treinos = signal<readonly TreinoEditavel[]>([]);
  readonly indice = signal(0);
  readonly selecionado = signal<ExercicioEditavel | null>(null);

  readonly treinoAtual = computed(() => this.treinos()[this.indice()] ?? null);

  definir(treinos: readonly TreinoEditavel[]): void {
    this.treinos.set(treinos);
    this.indice.set(0);
    this.selecionado.set(treinos[0]?.exercicios[0] ?? null);
  }

  /** Editor em branco: um treino A com uma linha vazia. */
  iniciar(): void {
    this.definir([{ nome: 'A', foco: '', exercicios: [exercicioEmBranco()] }]);
  }

  escolher(indice: number): void {
    this.indice.set(indice);
    this.selecionado.set(this.treinos()[indice]?.exercicios[0] ?? null);
  }

  adicionarTreino(): void {
    const treinos = this.treinos();
    this.treinos.set([
      ...treinos,
      { nome: proximaLetra(treinos), foco: '', exercicios: [exercicioEmBranco()] },
    ]);
    this.escolher(treinos.length);
  }

  adicionarExercicio(exercicio: ExercicioEditavel = exercicioEmBranco()): void {
    this.alterar((treino) => ({ ...treino, exercicios: [...treino.exercicios, exercicio] }));
    this.selecionado.set(exercicio);
  }

  remover(exercicio: ExercicioEditavel): void {
    this.alterar((treino) => ({
      ...treino,
      exercicios: treino.exercicios.filter((item) => item !== exercicio),
    }));
    if (this.selecionado() === exercicio) {
      this.selecionado.set(this.treinoAtual()?.exercicios[0] ?? null);
    }
  }

  /** A nova ordem dos exercícios do treino aberto é a que vai no `PUT`. */
  reordenar(exercicios: readonly ExercicioEditavel[]): void {
    this.alterar((treino) => ({ ...treino, exercicios: [...exercicios] }));
  }

  editou(): void {
    this.treinos.update((treinos) => [...treinos]);
  }

  private alterar(alterar: (treino: TreinoEditavel) => TreinoEditavel): void {
    const indice = this.indice();
    this.treinos.update((treinos) =>
      treinos.map((treino, posicao) => (posicao === indice ? alterar(treino) : treino)),
    );
  }
}
