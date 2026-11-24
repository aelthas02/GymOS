// Erros dos casos de uso do domínio dispositivos; o filtro HTTP os traduz em 400, 401, 404 e 422.

export class NaoEncontradoError extends Error {
  constructor(recurso: string) {
    super(`${recurso} não encontrado.`);
    this.name = 'NaoEncontradoError';
  }
}

export class DispositivoInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'DispositivoInvalidoError';
  }
}

/** Código desconhecido, vencido (30 min) ou já usado: o agente não recebe credencial. */
export class CodigoDePareamentoInvalidoError extends Error {
  constructor() {
    super('Código de pareamento inválido ou vencido. Gere um novo no painel.');
    this.name = 'CodigoDePareamentoInvalidoError';
  }
}

/** Credencial do agente ausente, errada ou revogada. */
export class CredencialDoAgenteInvalidaError extends Error {
  constructor() {
    super('Credencial do agente inválida ou revogada.');
    this.name = 'CredencialDoAgenteInvalidaError';
  }
}

/** Face e biometria só com o consentimento `biometria` do aluno (LGPD, T13c). */
export class ConsentimentoDeBiometriaNecessarioError extends Error {
  constructor() {
    super('O aluno não deu o consentimento de biometria.');
    this.name = 'ConsentimentoDeBiometriaNecessarioError';
  }
}
