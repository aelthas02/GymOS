// Erros dos casos de uso do domínio alunos; o controller os traduz em 404, 409 e 422.

export class NaoEncontradoError extends Error {
  constructor(recurso: string) {
    super(`${recurso} não encontrado.`);
    this.name = 'NaoEncontradoError';
  }
}

export class ConflitoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'ConflitoError';
  }
}
