export class NaoEncontradoError extends Error {
  constructor(recurso: string) {
    super(`${recurso} não encontrado.`);
    this.name = 'NaoEncontradoError';
  }
}

/** A academia ainda não preencheu os dados fiscais (Configurações > Dados fiscais e notas). */
export class DadosFiscaisAusentesError extends Error {
  constructor() {
    super('Preencha os dados fiscais da academia antes de emitir notas.');
    this.name = 'DadosFiscaisAusentesError';
  }
}

export class DadosDaNotaInvalidosError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'DadosDaNotaInvalidosError';
  }
}
