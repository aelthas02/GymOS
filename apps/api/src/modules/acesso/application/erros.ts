// Erros dos casos de uso do domínio acesso; o filtro HTTP os traduz em 400, 404 e 409.

export class NaoEncontradoError extends Error {
  constructor(recurso: string) {
    super(`${recurso} não encontrado.`);
    this.name = 'NaoEncontradoError';
  }
}

export class RegistroDeAcessoInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'RegistroDeAcessoInvalidoError';
  }
}
