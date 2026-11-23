import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Table, TableCell, type TableColumn, type TableSort } from './table';

interface Aluno {
  nome: string;
  plano: string;
}

const colunas: TableColumn[] = [
  { key: 'nome', label: 'Aluno', sortable: true },
  { key: 'plano', label: 'Plano', sortable: true },
  { key: 'acoes', label: 'Ações' },
];

const alunos = (quantidade: number): Aluno[] =>
  Array.from({ length: quantidade }, (_, i) => ({ nome: `Aluno ${i + 1}`, plano: 'Mensal' }));

@Component({
  imports: [Table, TableCell],
  template: `
    <ui-table
      label="Lista de alunos"
      [columns]="colunas"
      [rows]="linhas()"
      [total]="total()"
      [page]="pagina()"
      [pageSize]="20"
      [(sort)]="ordem"
      (pageChange)="paginas.push($event)"
      (sortChange)="ordens.push($event)"
    >
      <ng-template uiTableCell="nome" let-row>
        <b class="nome">{{ row.nome }}</b>
      </ng-template>
    </ui-table>
  `,
})
class Host {
  colunas = colunas;
  linhas = signal<Aluno[]>(alunos(3));
  total = signal<number | undefined>(312);
  pagina = signal(1);
  ordem = signal<TableSort | null>(null);
  paginas: number[] = [];
  ordens: TableSort[] = [];
}

function setup(patch: { linhas?: Aluno[]; total?: number | undefined; pagina?: number } = {}) {
  const fixture = TestBed.createComponent(Host);
  const host = fixture.componentInstance;
  if (patch.linhas) host.linhas.set(patch.linhas);
  if ('total' in patch) host.total.set(patch.total);
  if (patch.pagina) host.pagina.set(patch.pagina);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const cabecalhos = () => [...el.querySelectorAll<HTMLElement>('[role=columnheader]')];
  const rodape = () => el.querySelector('.ui-table__footer')?.textContent?.replace(/\s+/g, ' ');
  const botao = (texto: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(texto));
  return { fixture, host, el, cabecalhos, rodape, botao };
}

describe('Table', () => {
  it('é uma tabela nomeada com cabeçalhos e uma linha por registro', () => {
    const { el, cabecalhos } = setup();

    expect(el.querySelector('[role=table]')?.getAttribute('aria-label')).toBe('Lista de alunos');
    expect(cabecalhos().map((c) => c.textContent?.trim())).toEqual(['Aluno', 'Plano', 'Ações']);
    expect(el.querySelectorAll('[role=row]')).toHaveLength(4);
  });

  it('célula sem slot mostra o valor da coluna; com slot usa o template', () => {
    const { el } = setup();
    const primeira = el.querySelectorAll('[role=row]')[1]!;

    expect(primeira.querySelector('.nome')?.textContent).toBe('Aluno 1');
    expect(primeira.textContent).toContain('Mensal');
  });

  describe('ordenação', () => {
    it('clicar no cabeçalho emite coluna e direção; o servidor ordena', () => {
      const { host, cabecalhos } = setup();

      cabecalhos()[0]?.querySelector('button')?.click();

      expect(host.ordens).toEqual([{ column: 'nome', direction: 'asc' }]);
    });

    it('clicar de novo na mesma coluna inverte a direção', () => {
      const { fixture, host, cabecalhos } = setup();

      cabecalhos()[0]?.querySelector('button')?.click();
      fixture.detectChanges();
      cabecalhos()[0]?.querySelector('button')?.click();

      expect(host.ordens.at(-1)).toEqual({ column: 'nome', direction: 'desc' });
    });

    it('outra coluna começa em ascendente', () => {
      const { fixture, host, cabecalhos } = setup();

      cabecalhos()[0]?.querySelector('button')?.click();
      cabecalhos()[0]?.querySelector('button')?.click();
      fixture.detectChanges();
      cabecalhos()[1]?.querySelector('button')?.click();

      expect(host.ordens.at(-1)).toEqual({ column: 'plano', direction: 'asc' });
    });

    it('aria-sort acompanha a ordem e só existe em coluna ordenável', () => {
      const { fixture, host, cabecalhos } = setup();
      expect(cabecalhos().map((c) => c.getAttribute('aria-sort'))).toEqual(['none', 'none', null]);

      host.ordem.set({ column: 'plano', direction: 'desc' });
      fixture.detectChanges();

      expect(cabecalhos().map((c) => c.getAttribute('aria-sort'))).toEqual([
        'none',
        'descending',
        null,
      ]);

      host.ordem.set({ column: 'nome', direction: 'asc' });
      fixture.detectChanges();

      expect(cabecalhos()[0]?.getAttribute('aria-sort')).toBe('ascending');
    });

    it('coluna sem sortable não tem botão', () => {
      expect(setup().cabecalhos()[2]?.querySelector('button')).toBeNull();
    });

    it('não reordena as linhas por conta própria', () => {
      const { el, cabecalhos } = setup({
        linhas: [
          { nome: 'Zé', plano: 'A' },
          { nome: 'Ana', plano: 'B' },
        ],
      });

      cabecalhos()[0]?.querySelector('button')?.click();

      const nomes = [...el.querySelectorAll('.nome')].map((n) => n.textContent);
      expect(nomes).toEqual(['Zé', 'Ana']);
    });
  });

  describe('rodapé', () => {
    it('mostra "Mostrando X a Y de Z"', () => {
      expect(setup().rodape()).toContain('Mostrando 1 a 20 de 312');
    });

    it('acompanha a página, inclusive a última, incompleta', () => {
      expect(setup({ pagina: 2 }).rodape()).toContain('Mostrando 21 a 40 de 312');
      expect(setup({ pagina: 16 }).rodape()).toContain('Mostrando 301 a 312 de 312');
    });

    it('total zero mostra "0 a 0 de 0"', () => {
      expect(setup({ linhas: [], total: 0 }).rodape()).toContain('Mostrando 0 a 0 de 0');
    });

    it('Anterior fica desabilitado na primeira página e Próxima na última', () => {
      expect(setup().botao('Anterior')?.disabled).toBe(true);
      expect(setup().botao('Próxima')?.disabled).toBe(false);
      expect(setup({ pagina: 16 }).botao('Próxima')?.disabled).toBe(true);
      expect(setup({ pagina: 16 }).botao('Anterior')?.disabled).toBe(false);
    });

    it('Anterior e Próxima emitem a nova página', () => {
      const { host, botao } = setup({ pagina: 3 });

      botao('Próxima')?.click();
      botao('Anterior')?.click();

      expect(host.paginas).toEqual([4, 2]);
    });

    it('sem total não há rodapé', () => {
      expect(setup({ total: undefined }).rodape()).toBeUndefined();
    });
  });

  describe('virtualização', () => {
    it('até 100 linhas renderiza tudo, sem viewport virtual', () => {
      const { el } = setup({ linhas: alunos(100) });

      expect(el.querySelector('cdk-virtual-scroll-viewport')).toBeNull();
      expect(el.querySelectorAll('[role=row]')).toHaveLength(101);
    });

    it('com mais de 100 linhas usa o viewport virtual do CDK', () => {
      const { el } = setup({ linhas: alunos(101) });

      expect(el.querySelector('cdk-virtual-scroll-viewport')).not.toBeNull();
    });
  });

  it('a rolagem horizontal é uma região nomeada e alcançável pelo teclado', () => {
    const { el } = setup();
    const regiao = el.querySelector<HTMLElement>('.ui-table__scroll')!;

    expect(regiao.getAttribute('role')).toBe('region');
    expect(regiao.getAttribute('aria-label')).toBe('Lista de alunos');
    expect(regiao.tabIndex).toBe(0);
  });
});
