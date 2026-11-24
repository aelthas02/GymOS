export { MENSAGENS_DE_ERRO, mensagemDeErro, type ChaveDeErro } from './lib/mensagens';
export { Validadores, type ErroDeLimite } from './lib/validadores';

export { MascaraBase, type AtributosPadrao } from './lib/mascaras/mascara-base';
export { MascaraCnpj, MascaraCpf, MascaraCpfOuEmail } from './lib/mascaras/documentos';
export {
  CampoDeCodigo,
  CampoDeEmail,
  CampoDeSenha,
  MascaraCep,
  MascaraTelefone,
} from './lib/mascaras/contato';
export { MascaraBrl, MascaraDecimal, MascaraPercentual } from './lib/mascaras/numeros';
export { MascaraCompetencia, MascaraData, MascaraHorario } from './lib/mascaras/datas';

export {
  Autofocus,
  ClickOutside,
  DebounceClick,
  OnlyNumbers,
  Trim,
} from './lib/diretivas/utilitarias';
export {
  FEATURE_FLAGS,
  FeatureFlag,
  PERMISSION_CHECKER,
  Permission,
  type FeatureFlags,
  type PermissionChecker,
} from './lib/diretivas/acesso';
export { ErrorFor, FieldError, mensagemVisivel } from './lib/diretivas/erro';

export { KeyboardAwareService } from './lib/teclado/keyboard-aware.service';
export { KeyboardSafe } from './lib/teclado/keyboard-safe.directive';
