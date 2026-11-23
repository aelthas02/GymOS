import { provideLocationMocks } from '@angular/common/testing';
import {
  inject,
  provideAppInitializer,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { provideRouter, Router } from '@angular/router';

/**
 * Router em memória para as histórias: não mexe na URL do iframe do Storybook e já começa em
 * `url`, para mostrar a aba ou o item de menu ativo.
 */
export function roteadorEm(url: string): (EnvironmentProviders | Provider)[] {
  return [
    provideRouter([{ path: '**', children: [] }]),
    provideLocationMocks(),
    provideAppInitializer(() => {
      void inject(Router).navigateByUrl(url);
    }),
  ];
}
