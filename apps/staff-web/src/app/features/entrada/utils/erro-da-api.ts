import { HttpErrorResponse } from '@angular/common/http';

const MENSAGEM_PADRAO = 'Não foi possível concluir agora. Tente de novo em instantes.';
const MENSAGEM_DE_LIMITE = 'Muitas tentativas. Tente de novo em alguns minutos.';

/** Texto de erro da entrada pelo status HTTP; `porStatus` traz as mensagens específicas da tela. */
export function mensagemDoErro(
  erro: unknown,
  porStatus: Readonly<Record<number, string>> = {},
): string {
  if (!(erro instanceof HttpErrorResponse)) {
    return MENSAGEM_PADRAO;
  }
  return porStatus[erro.status] ?? (erro.status === 429 ? MENSAGEM_DE_LIMITE : MENSAGEM_PADRAO);
}
