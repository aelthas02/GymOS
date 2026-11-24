import type { TipoDeAcesso } from '../../../autenticacao/domain/tipos-de-acesso';
import type { Funcionario } from '../../application/portas';
import { CARGOS } from '../../domain/funcionario';
import type { FuncionarioDto } from './dto';

const NOMES_DOS_CARGOS = new Map(CARGOS.map((cargo) => [cargo.chave, cargo.nome]));

export function funcionarioDto(
  funcionario: Funcionario,
  tipos: ReadonlyMap<string, TipoDeAcesso>,
): FuncionarioDto {
  const tipo = funcionario.tipoDeAcessoId ? tipos.get(funcionario.tipoDeAcessoId) : undefined;
  return {
    id: funcionario.id,
    nome: funcionario.nome,
    cargo: funcionario.cargo,
    cargoNome:
      funcionario.cargoDescricao ?? NOMES_DOS_CARGOS.get(funcionario.cargo) ?? funcionario.cargo,
    cargoDescricao: funcionario.cargoDescricao,
    telefone: funcionario.telefone,
    email: funcionario.email,
    tipoDeAcesso: tipo ? { id: tipo.id, nome: tipo.nome } : null,
    ativo: funcionario.ativo,
    custoMensalCentavos: funcionario.custoMensalCentavos,
  };
}
