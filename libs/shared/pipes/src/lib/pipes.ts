import { Pipe, type PipeTransform } from '@angular/core';
import { centavos, formatarBrl, formatarPercentual, pontosBase } from '@gymos/shared-money';
import {
  formatarCnpj,
  formatarCpf,
  formatarDataBr,
  formatarTelefone,
  formatarTempoRelativo,
  iniciais,
  rotuloDeStatus,
  type EntradaDeInstante,
  type FormatoDeData,
  type SituacaoDoBadge,
  type VarianteDeTempoRelativo,
} from '../formatadores';

type Talvez<T> = T | null | undefined;

/** Centavos → 'R$ 48.320,00'. Valor fracionário é erro de contrato e lança RangeError. */
@Pipe({ name: 'brl' })
export class BrlPipe implements PipeTransform {
  transform(valor: Talvez<number>): string {
    return valor == null ? '' : formatarBrl(centavos(valor));
  }
}

@Pipe({ name: 'cpf' })
export class CpfPipe implements PipeTransform {
  transform(valor: Talvez<string>): string {
    return valor == null ? '' : formatarCpf(valor);
  }
}

@Pipe({ name: 'cnpj' })
export class CnpjPipe implements PipeTransform {
  transform(valor: Talvez<string>): string {
    return valor == null ? '' : formatarCnpj(valor);
  }
}

@Pipe({ name: 'phone' })
export class TelefonePipe implements PipeTransform {
  transform(valor: Talvez<string>): string {
    return valor == null ? '' : formatarTelefone(valor);
  }
}

/** Pontos-base → '2,5%'. Não confundir com o `PercentPipe` do Angular, que recebe fração. */
@Pipe({ name: 'percent' })
export class PercentualPipe implements PipeTransform {
  transform(valor: Talvez<number>, casas: 0 | 1 | 2 = 1): string {
    return valor == null ? '' : formatarPercentual(pontosBase(valor), casas);
  }
}

@Pipe({ name: 'dateBr' })
export class DataBrPipe implements PipeTransform {
  transform(valor: Talvez<EntradaDeInstante>, formato: FormatoDeData = 'data'): string {
    return valor == null ? '' : formatarDataBr(valor, formato);
  }
}

/**
 * `agora` vem do relógio da tela (um signal que avança), para o pipe continuar puro:
 * `{{ enviadaEm | relativeTime: 'curta' : agora() }}`.
 */
@Pipe({ name: 'relativeTime' })
export class TempoRelativoPipe implements PipeTransform {
  transform(
    valor: Talvez<EntradaDeInstante>,
    variante: VarianteDeTempoRelativo,
    agora: EntradaDeInstante,
  ): string {
    return valor == null ? '' : formatarTempoRelativo(valor, variante, agora);
  }
}

@Pipe({ name: 'initials' })
export class IniciaisPipe implements PipeTransform {
  transform(nome: Talvez<string>): string {
    return nome == null ? '' : iniciais(nome);
  }
}

@Pipe({ name: 'statusLabel' })
export class RotuloDeStatusPipe implements PipeTransform {
  transform(situacao: Talvez<SituacaoDoBadge>, dias?: number | null): string {
    return situacao == null ? '' : rotuloDeStatus(situacao, dias);
  }
}

/** Todos os pipes de exibição, para `imports` de um componente standalone. */
export const PIPES_DE_EXIBICAO = [
  BrlPipe,
  CpfPipe,
  CnpjPipe,
  TelefonePipe,
  PercentualPipe,
  DataBrPipe,
  TempoRelativoPipe,
  IniciaisPipe,
  RotuloDeStatusPipe,
] as const;
