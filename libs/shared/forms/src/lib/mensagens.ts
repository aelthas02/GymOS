import type { ValidationErrors } from '@angular/forms';
import { TAMANHO_MINIMO_DA_SENHA } from '@gymos/shared-validation';
import type { ErroDeLimite } from './validadores';

interface ErroDeTamanho {
  requiredLength: number;
  actualLength: number;
}

/**
 * Dicionário único das mensagens de erro de formulário: as chaves dos `Validadores` e as do Angular
 * que usamos (`required`, `minlength`, `maxlength`, `pattern`). Mensagens curtas, em português.
 */
export const MENSAGENS_DE_ERRO = {
  required: 'Campo obrigatório.',
  minlength: (erro: ErroDeTamanho) => `Use pelo menos ${erro.requiredLength} caracteres.`,
  maxlength: (erro: ErroDeTamanho) => `Use no máximo ${erro.requiredLength} caracteres.`,
  pattern: 'Formato inválido.',
  cpf: 'CPF inválido.',
  cnpj: 'CNPJ inválido.',
  telefone: 'Telefone inválido.',
  email: 'E-mail inválido.',
  cep: 'CEP inválido.',
  senhaForte: `Use ${TAMANHO_MINIMO_DA_SENHA} caracteres ou mais, com letras e números.`,
  data: 'Data inválida.',
  intervaloDeDatas: 'A data final não pode ser antes da inicial.',
  competencia: 'Use o formato MM/AAAA.',
  urlYoutube: 'Link do YouTube inválido.',
  minimo: (erro: ErroDeLimite) => `O mínimo é ${erro.exibicao}.`,
  maximo: (erro: ErroDeLimite) => `O máximo é ${erro.exibicao}.`,
} as const;

export type ChaveDeErro = keyof typeof MENSAGENS_DE_ERRO;

const MENSAGEM_GENERICA = 'Valor inválido.';

function ehChaveConhecida(chave: string): chave is ChaveDeErro {
  return Object.hasOwn(MENSAGENS_DE_ERRO, chave);
}

/** Mensagem do erro a mostrar: `required` primeiro, depois o primeiro erro com tradução. */
export function mensagemDeErro(erros: ValidationErrors | null | undefined): string | null {
  const chaves = Object.keys(erros ?? {});
  if (chaves.length === 0) {
    return null;
  }
  const chave = chaves.includes('required') ? 'required' : chaves.find(ehChaveConhecida);
  if (chave === undefined || !ehChaveConhecida(chave)) {
    return MENSAGEM_GENERICA;
  }
  const mensagem = MENSAGENS_DE_ERRO[chave];
  return typeof mensagem === 'string'
    ? mensagem
    : (mensagem as (detalhe: unknown) => string)(erros?.[chave]);
}
