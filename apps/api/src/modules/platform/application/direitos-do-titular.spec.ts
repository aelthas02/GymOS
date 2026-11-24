import { RelogioFixo } from '../infra/relogio/relogio';
import {
  DireitosDoTitular,
  type ModoDeExclusao,
  type ProvedorDeDadosDoTitular,
  RegistroDeProvedoresDoTitular,
  type Retencao,
} from './direitos-do-titular';

class ProvedorEspiao implements ProvedorDeDadosDoTitular {
  readonly exportados: string[] = [];
  readonly exclusoes: Array<{ alunoId: string; modo: ModoDeExclusao }> = [];

  constructor(
    readonly dominio: string,
    readonly retencao?: Retencao,
  ) {}

  async exportar(alunoId: string): Promise<unknown> {
    this.exportados.push(alunoId);
    return { dominio: this.dominio, alunoId };
  }

  async excluirOuAnonimizar(alunoId: string, modo: ModoDeExclusao): Promise<{ registros: number }> {
    this.exclusoes.push({ alunoId, modo });
    return { registros: 2 };
  }
}

describe('direitos do titular', () => {
  it('exportação do titular chama todos os provedores registrados; exclusão respeita a retenção declarada', async () => {
    const treinos = new ProvedorEspiao('treinos');
    const fiscal = new ProvedorEspiao('fiscal', {
      motivo: 'Guarda de notas fiscais (obrigação legal)',
      prazoEmAnos: 5,
    });
    const registro = new RegistroDeProvedoresDoTitular();
    registro.registrar(treinos);
    registro.registrar(fiscal);
    const direitos = new DireitosDoTitular(registro, new RelogioFixo('2026-11-23T12:00:00Z'));

    const exportacao = await direitos.exportar('aluno-1');

    expect(treinos.exportados).toEqual(['aluno-1']);
    expect(fiscal.exportados).toEqual(['aluno-1']);
    expect(exportacao).toEqual({
      alunoId: 'aluno-1',
      geradaEm: '2026-11-23T12:00:00.000Z',
      dominios: {
        treinos: { dominio: 'treinos', alunoId: 'aluno-1' },
        fiscal: { dominio: 'fiscal', alunoId: 'aluno-1' },
      },
    });

    const relatorio = await direitos.excluir('aluno-1');

    expect(treinos.exclusoes).toEqual([{ alunoId: 'aluno-1', modo: 'excluir' }]);
    expect(fiscal.exclusoes).toEqual([{ alunoId: 'aluno-1', modo: 'anonimizar' }]);
    expect(relatorio).toEqual({
      alunoId: 'aluno-1',
      executadaEm: '2026-11-23T12:00:00.000Z',
      dominios: [
        { dominio: 'treinos', modo: 'excluir', registros: 2 },
        {
          dominio: 'fiscal',
          modo: 'anonimizar',
          registros: 2,
          retencao: { motivo: 'Guarda de notas fiscais (obrigação legal)', prazoEmAnos: 5 },
        },
      ],
    });
  });
});
