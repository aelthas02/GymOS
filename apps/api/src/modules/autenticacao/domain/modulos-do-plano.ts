import { MODULOS_EXTRAS, type ModuloExtra } from './permissoes';

/**
 * Catálogo dos planos contratados do GymOS (`Tenant.plano`) e os módulos extras de cada um. Plano
 * desconhecido não dá módulo extra nenhum.
 */
export const PLANOS: Readonly<Record<string, readonly ModuloExtra[]>> = {
  base: [],
  completo: MODULOS_EXTRAS,
};

export type Sobrescritas = Partial<Record<ModuloExtra, boolean>>;

/** Módulos extras ativos: os do plano, com a sobrescrita manual por cima (ligar ou desligar). */
export function modulosAtivos(plano: string, sobrescritas: Sobrescritas = {}): ModuloExtra[] {
  const doPlano = Object.hasOwn(PLANOS, plano) ? (PLANOS[plano] ?? []) : [];
  return MODULOS_EXTRAS.filter((modulo) => sobrescritas[modulo] ?? doPlano.includes(modulo));
}
