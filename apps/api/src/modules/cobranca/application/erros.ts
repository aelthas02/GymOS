// Erros dos casos de uso do domínio cobrança; o controller os traduz em 404 e 409.

export class NaoEncontradoError extends Error {
  constructor(recurso: string) {
    super(`${recurso} não encontrado.`);
    this.name = 'NaoEncontradoError';
  }
}
