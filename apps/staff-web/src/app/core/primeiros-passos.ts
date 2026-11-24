import { InjectionToken } from '@angular/core';
import { type Observable, of } from 'rxjs';

/**
 * Diz se a academia já concluiu os primeiros passos. O T17 registra a implementação real (API de
 * Primeiros passos); até lá vale "concluído" e o login vai direto para o Início.
 */
export const PRIMEIROS_PASSOS_CONCLUIDOS = new InjectionToken<() => Observable<boolean>>(
  'PRIMEIROS_PASSOS_CONCLUIDOS',
  { factory: () => () => of(true) },
);

export const ROTA_DOS_PRIMEIROS_PASSOS = '/primeiros-passos/1';
export const ROTA_INICIAL = '/inicio';
