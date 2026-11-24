import type { ModuloDeSeed } from './modulo-de-seed';
import { ordenarModulosDeSeed } from './ordenar';

const modulo = (nome: string, dependeDe: string[] = []): ModuloDeSeed => ({
  nome,
  dependeDe,
  executar: async () => undefined,
});
const nomes = (modulos: ModuloDeSeed[]): string[] => modulos.map((item) => item.nome);

describe('ordenarModulosDeSeed', () => {
  it('põe cada módulo depois das suas dependências, na ordem de referência dos domínios', () => {
    const ordem = ordenarModulosDeSeed([
      modulo('alunos', ['planos']),
      modulo('planos', ['plataforma']),
      modulo('autenticacao', ['plataforma']),
      modulo('plataforma'),
      modulo('extra', ['alunos']),
    ]);

    expect(nomes(ordem)).toEqual(['plataforma', 'autenticacao', 'planos', 'alunos', 'extra']);
  });

  it('falha com mensagem clara quando a dependência não está registrada', () => {
    expect(() => ordenarModulosDeSeed([modulo('alunos', ['planos'])])).toThrow(
      /"alunos" depende de "planos", que não está registrado/,
    );
  });

  it('falha com nome repetido e com ciclo', () => {
    expect(() => ordenarModulosDeSeed([modulo('a'), modulo('a')])).toThrow(/mais de uma vez/);
    expect(() => ordenarModulosDeSeed([modulo('a', ['b']), modulo('b', ['a'])])).toThrow(
      /circular/,
    );
  });
});
