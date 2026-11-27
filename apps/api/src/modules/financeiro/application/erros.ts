export class LancamentoInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'LancamentoInvalidoError';
  }
}

export class FiltroInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'FiltroInvalidoError';
  }
}
