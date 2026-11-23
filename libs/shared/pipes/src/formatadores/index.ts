// Formatadores sem Angular, os mesmos dos pipes, para o back (exportação para o contador, mensagens):
// import { formatarBrl } from '@gymos/shared-pipes/formatadores';
export { formatarBrl, formatarPercentual } from '@gymos/shared-money';
export {
  FUSO_DE_SAO_PAULO,
  formatarDataBr,
  formatarTempoRelativo,
  type EntradaDeInstante,
  type FormatoDeData,
  type VarianteDeTempoRelativo,
} from './datas';
export { formatarCnpj, formatarCpf, formatarTelefone } from './documentos';
export { iniciais, rotuloDeStatus, type SituacaoDoBadge } from './textos';
