import { computed, Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  readonly message: string;
  readonly tone?: ToastTone;
  /** Milissegundos na tela; 0 deixa o aviso até ser dispensado. */
  readonly duration?: number;
}

export interface ToastItem {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
  readonly duration: number;
}

export const TOAST_DEFAULT_DURATION = 5000;
export const TOAST_MAX_VISIBLE = 3;

/**
 * Fila de avisos. Só `TOAST_MAX_VISIBLE` ficam na tela; os demais esperam e o tempo de cada um só
 * começa a contar quando ele aparece.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly fila = signal<readonly ToastItem[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private ultimo = 0;

  readonly visible = computed(() => this.fila().slice(0, TOAST_MAX_VISIBLE));

  show(options: ToastOptions): number {
    const item: ToastItem = {
      id: ++this.ultimo,
      message: options.message,
      tone: options.tone ?? 'info',
      duration: options.duration ?? TOAST_DEFAULT_DURATION,
    };

    this.fila.update((itens) => [...itens, item]);
    this.agendar();
    return item.id;
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.fila.update((itens) => itens.filter((item) => item.id !== id));
    this.agendar();
  }

  clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.fila.set([]);
  }

  /** Começa a contar o tempo dos avisos que acabaram de ficar visíveis. */
  private agendar(): void {
    for (const item of this.visible()) {
      if (item.duration > 0 && !this.timers.has(item.id)) {
        this.timers.set(
          item.id,
          setTimeout(() => this.dismiss(item.id), item.duration),
        );
      }
    }
  }
}
