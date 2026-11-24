// Erros dos casos de uso do domínio avisos; o controller os traduz em 404.

export class NaoEncontradoError extends Error {
  constructor(recurso: string) {
    super(`${recurso} não encontrado.`);
    this.name = 'NaoEncontradoError';
  }
}
