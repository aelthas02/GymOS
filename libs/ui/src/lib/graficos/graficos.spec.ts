import { Component, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AreaChart } from './area-chart';
import { BarChart } from './bar-chart';
import { Donut } from './donut';
import { Heatmap } from './heatmap';
import { HorizontalBars } from './horizontal-bars';
import { LineChart } from './line-chart';
import { ProgressBar } from './progress-bar';
import { Sparkline } from './sparkline';
import { StackedBarChart } from './stacked-bar-chart';
import { WeekDots } from './week-dots';

function render<T>(type: Type<T>, inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(type);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const real = (valor: number) => `R$ ${valor.toFixed(2).replace('.', ',')}`;
const celulas = (el: HTMLElement) =>
  [...el.querySelectorAll('table tbody tr')].map((tr) =>
    [...tr.querySelectorAll('th, td')].map((c) => c.textContent?.trim()),
  );

const horas = [
  { rotulo: '6h', valor: 0 },
  { rotulo: '12h', valor: 56 },
  { rotulo: '18h', valor: 112 },
];

describe('BarChart', () => {
  it('desenha uma barra por ponto, com alturas proporcionais', () => {
    const el = render(BarChart, { dados: horas });
    const barras = [...el.querySelectorAll<SVGRectElement>('rect.ui-barra')];

    expect(barras).toHaveLength(3);
    const alturasPx = barras.map((b) => Number(b.getAttribute('height')));
    expect(alturasPx[0]).toBe(0);
    expect(alturasPx[1]).toBeCloseTo(alturasPx[2] / 2, 5);
  });

  it('só o maior recebe a classe de destaque e o rótulo do valor', () => {
    const el = render(BarChart, { dados: horas });
    const destaque = el.querySelectorAll('rect.ui-barra--destaque');

    expect(destaque).toHaveLength(1);
    expect(destaque[0]).toBe(el.querySelectorAll('rect.ui-barra')[2]);
    expect(el.querySelector('.ui-barra-valor')?.textContent?.trim()).toBe('112');
  });

  it('é responsivo por viewBox, sem largura fixa', () => {
    const svg = render(BarChart, { dados: horas }).querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
    expect(svg.hasAttribute('width')).toBe(false);
  });

  it('lista vazia mostra o estado vazio, sem svg', () => {
    const el = render(BarChart, { dados: [] });
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('ui-empty-state')?.textContent).toContain('Sem dados');
  });

  it('a mensagem do estado vazio vem por input', () => {
    const el = render(BarChart, { dados: [], mensagemVazia: 'Nenhum check-in hoje' });
    expect(el.textContent).toContain('Nenhum check-in hoje');
  });

  it('tem role="img" com resumo e a tabela acessível lista todos os pontos formatados', () => {
    const el = render(BarChart, { dados: horas, formatar: real, resumo: 'Check-ins por hora' });
    const img = el.querySelector('svg[role="img"]')!;

    expect(img.getAttribute('aria-label')).toContain('Check-ins por hora');
    expect(celulas(el)).toEqual([
      ['6h', 'R$ 0,00'],
      ['12h', 'R$ 56,00'],
      ['18h', 'R$ 112,00'],
    ]);
    expect(el.querySelector('table')!.classList.contains('ui-sr-only')).toBe(true);
  });

  it('o resumo padrão cita o maior valor', () => {
    const el = render(BarChart, { dados: horas });
    expect(el.querySelector('svg')!.getAttribute('aria-label')).toContain('18h');
  });

  it('valor inválido (NaN) não quebra o desenho', () => {
    const el = render(BarChart, { dados: [{ rotulo: 'a', valor: Number.NaN }, horas[2]] });
    expect(el.innerHTML).not.toContain('NaN');
  });

  it('com 24 pontos, os rótulos do eixo saltam, mas a tabela traz todos', () => {
    const dia = Array.from({ length: 24 }, (_, i) => ({ rotulo: `${i}h`, valor: i }));
    const el = render(BarChart, { dados: dia });
    expect(el.querySelectorAll('text.ui-eixo').length).toBeLessThan(24);
    expect(celulas(el)).toHaveLength(24);
  });
});

describe('StackedBarChart', () => {
  const dias = [
    { rotulo: 'Seg', positivo: 10, negativo: 2 },
    { rotulo: 'Ter', positivo: 0, negativo: 0 },
  ];

  it('empilha positivo (acento) e negativo, e a tabela traz as duas colunas', () => {
    const el = render(StackedBarChart, {
      dados: dias,
      rotuloPositivo: 'Adesões',
      rotuloNegativo: 'Cancelamentos',
    });

    expect(el.querySelectorAll('rect.ui-barra--positivo')).toHaveLength(2);
    expect(el.querySelectorAll('rect.ui-barra--negativo')).toHaveLength(2);
    expect(celulas(el)).toEqual([
      ['Seg', '10', '2'],
      ['Ter', '0', '0'],
    ]);
    expect(el.textContent).toContain('Adesões');
    expect(el.textContent).toContain('Cancelamentos');
  });

  it('a barra negativa fica acima da positiva', () => {
    const el = render(StackedBarChart, { dados: dias });
    const pos = el.querySelector('rect.ui-barra--positivo')!;
    const neg = el.querySelector('rect.ui-barra--negativo')!;
    expect(Number(neg.getAttribute('y')) + Number(neg.getAttribute('height'))).toBeCloseTo(
      Number(pos.getAttribute('y')),
      5,
    );
  });

  it('lista vazia mostra o estado vazio', () => {
    const el = render(StackedBarChart, { dados: [] });
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('ui-empty-state')).not.toBeNull();
  });
});

describe('HorizontalBars', () => {
  const setores = [
    { rotulo: 'Musculação', valor: 30000 },
    { rotulo: 'Aulas', valor: 15000 },
  ];

  it('a maior barra ocupa a largura toda e a outra, metade', () => {
    const el = render(HorizontalBars, { dados: setores });
    const larguras = [...el.querySelectorAll('rect.ui-barra')].map((b) =>
      Number(b.getAttribute('width')),
    );
    expect(larguras[1]).toBeCloseTo(larguras[0] / 2, 5);
  });

  it('mostra o valor formatado e a tabela acessível', () => {
    const el = render(HorizontalBars, { dados: setores, formatar: real });
    expect(el.querySelector('svg')!.textContent).toContain('R$ 30000,00');
    expect(celulas(el)).toEqual([
      ['Musculação', 'R$ 30000,00'],
      ['Aulas', 'R$ 15000,00'],
    ]);
  });

  it('lista vazia mostra o estado vazio', () => {
    const el = render(HorizontalBars, { dados: [] });
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('ui-empty-state')).not.toBeNull();
  });

  it('todos zero desenha barras de largura 0 sem NaN', () => {
    const el = render(HorizontalBars, { dados: [{ rotulo: 'a', valor: 0 }] });
    expect(el.innerHTML).not.toContain('NaN');
  });
});

describe('Donut', () => {
  const formas = [
    { rotulo: 'Pix', valor: 54 },
    { rotulo: 'Cartão', valor: 36 },
    { rotulo: 'Boleto', valor: 10 },
  ];

  it('os arcos somam a circunferência inteira', () => {
    const el = render(Donut, { dados: formas });
    const arcos = [...el.querySelectorAll<SVGCircleElement>('circle.ui-fatia')];
    const comprimentos = arcos.map((c) =>
      Number(c.getAttribute('stroke-dasharray')!.split(' ')[0]),
    );
    const circunferencia = 2 * Math.PI * Number(arcos[0].getAttribute('r'));

    expect(arcos).toHaveLength(3);
    expect(comprimentos.reduce((s, n) => s + n, 0)).toBeCloseTo(circunferencia, 1);
  });

  it('um valor zero não desenha arco, mas continua na legenda e na tabela', () => {
    const el = render(Donut, {
      dados: [formas[0], { rotulo: 'Dinheiro', valor: 0 }, formas[1]],
    });

    expect(el.querySelectorAll('circle.ui-fatia')).toHaveLength(2);
    expect(el.querySelectorAll('.ui-legenda li')).toHaveLength(3);
    expect(celulas(el)[1]).toEqual(['Dinheiro', '0']);
  });

  it('a legenda mostra rótulo, valor formatado e a parte quando recebida', () => {
    const el = render(Donut, {
      dados: formas,
      formatar: real,
      formatarParte: (f: number) => `${Math.round(f * 100)}%`,
    });
    const primeiro = el.querySelector('.ui-legenda li')!.textContent!;
    expect(primeiro).toContain('Pix');
    expect(primeiro).toContain('R$ 54,00');
    expect(primeiro).toContain('54%');
  });

  it('cada fatia usa uma cor de série diferente, por token', () => {
    const el = render(Donut, { dados: formas });
    const cores = [...el.querySelectorAll('circle.ui-fatia')].map((c) => c.getAttribute('stroke'));
    expect(new Set(cores).size).toBe(3);
    expect(cores.every((c) => c!.startsWith('var(--'))).toBe(true);
  });

  it('lista vazia ou total zero mostra o estado vazio', () => {
    expect(render(Donut, { dados: [] }).querySelector('ui-empty-state')).not.toBeNull();
    const zerado = render(Donut, { dados: [{ rotulo: 'a', valor: 0 }] });
    expect(zerado.querySelector('svg')).toBeNull();
    expect(zerado.querySelector('ui-empty-state')).not.toBeNull();
  });

  it('um valor só desenha o anel inteiro', () => {
    const el = render(Donut, { dados: [{ rotulo: 'Pix', valor: 9 }] });
    expect(el.querySelectorAll('circle.ui-fatia')).toHaveLength(1);
    expect(el.innerHTML).not.toContain('NaN');
  });

  it('tem role="img" e a tabela acessível lista todas as fatias', () => {
    const el = render(Donut, { dados: formas, formatar: real });
    expect(el.querySelector('svg')!.getAttribute('role')).toBe('img');
    expect(celulas(el)).toEqual([
      ['Pix', 'R$ 54,00'],
      ['Cartão', 'R$ 36,00'],
      ['Boleto', 'R$ 10,00'],
    ]);
  });
});

describe('LineChart e AreaChart', () => {
  const meses = [
    { rotulo: 'Jun', valor: 40 },
    { rotulo: 'Jul', valor: 55 },
    { rotulo: 'Ago', valor: 70 },
  ];

  it('LineChart traça a linha, sem área', () => {
    const el = render(LineChart, { dados: meses });
    expect(el.querySelector('polyline.ui-linha')).not.toBeNull();
    expect(el.querySelector('polygon.ui-area')).toBeNull();
    expect(el.querySelectorAll('circle.ui-ponto')).toHaveLength(3);
  });

  it('AreaChart acrescenta a área sob a linha', () => {
    const el = render(AreaChart, { dados: meses });
    expect(el.querySelector('polyline.ui-linha')).not.toBeNull();
    expect(el.querySelector('polygon.ui-area')).not.toBeNull();
  });

  it('a tabela acessível traz todos os pontos formatados', () => {
    const el = render(LineChart, { dados: meses, formatar: real });
    expect(celulas(el)).toEqual([
      ['Jun', 'R$ 40,00'],
      ['Jul', 'R$ 55,00'],
      ['Ago', 'R$ 70,00'],
    ]);
    expect(el.querySelector('svg')!.getAttribute('role')).toBe('img');
  });

  it('lista vazia mostra o estado vazio, nos dois', () => {
    for (const tipo of [LineChart, AreaChart]) {
      const el = render(tipo, { dados: [] });
      expect(el.querySelector('svg')).toBeNull();
      expect(el.querySelector('ui-empty-state')).not.toBeNull();
    }
  });

  it('um ponto só e série constante não geram NaN', () => {
    expect(render(LineChart, { dados: [meses[0]] }).innerHTML).not.toContain('NaN');
    const plano = [meses[0], { rotulo: 'Jul', valor: 40 }];
    expect(render(AreaChart, { dados: plano }).innerHTML).not.toContain('NaN');
  });
});

describe('Sparkline', () => {
  it('desenha a linha e a área e tem resumo e tabela', () => {
    const el = render(Sparkline, {
      valores: [1, 2, 3],
      rotulos: ['a', 'b', 'c'],
      resumo: 'Tendência',
    });
    expect(el.querySelector('polyline')).not.toBeNull();
    expect(el.querySelector('svg')!.getAttribute('aria-label')).toContain('Tendência');
    expect(celulas(el)).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
    ]);
  });

  it('sem rótulos, numera os pontos', () => {
    expect(celulas(render(Sparkline, { valores: [4, 5] }))[0][0]).toBe('1');
  });

  it('lista vazia mostra o estado vazio', () => {
    const el = render(Sparkline, { valores: [] });
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('ui-empty-state')).not.toBeNull();
  });
});

describe('Heatmap', () => {
  const entrada = {
    colunas: ['Seg', 'Ter'],
    linhas: ['Manhã', 'Noite'],
    valores: [
      [0, 10],
      [5, 20],
    ],
  };

  it('desenha uma célula por linha e coluna, mais forte onde o valor é maior', () => {
    const el = render(Heatmap, entrada);
    const celulasSvg = [...el.querySelectorAll<SVGRectElement>('rect.ui-celula')];
    const opacidade = celulasSvg.map((c) => Number(c.getAttribute('fill-opacity')));

    expect(celulasSvg).toHaveLength(4);
    expect(opacidade[3]).toBe(1);
    expect(opacidade[2]).toBeGreaterThan(opacidade[0]);
    expect(opacidade[3]).toBeGreaterThan(opacidade[1]);
  });

  it('a tabela acessível traz linha, dia e valor formatado', () => {
    const el = render(Heatmap, { ...entrada, formatar: (n: number) => `${n} check-ins` });
    expect(celulas(el)).toEqual([
      ['Manhã', '0 check-ins', '10 check-ins'],
      ['Noite', '5 check-ins', '20 check-ins'],
    ]);
  });

  it('sem linhas ou sem colunas mostra o estado vazio', () => {
    const el = render(Heatmap, { colunas: [], linhas: [], valores: [] });
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('ui-empty-state')).not.toBeNull();
  });

  it('célula ausente na matriz conta como zero', () => {
    const el = render(Heatmap, { colunas: ['a', 'b'], linhas: ['x'], valores: [[3]] });
    expect(el.innerHTML).not.toContain('NaN');
    expect(celulas(el)[0]).toEqual(['x', '3', '0']);
  });
});

describe('ProgressBar', () => {
  const largura = (el: HTMLElement) =>
    el.querySelector<HTMLElement>('.ui-progresso__fill')!.style.width;

  it('expõe role=progressbar com valor e rótulo', () => {
    const el = render(ProgressBar, { valor: 40, rotulo: 'Meta da semana' });
    const barra = el.querySelector('[role="progressbar"]')!;

    expect(barra.getAttribute('aria-valuenow')).toBe('40');
    expect(barra.getAttribute('aria-valuemin')).toBe('0');
    expect(barra.getAttribute('aria-valuemax')).toBe('100');
    expect(barra.getAttribute('aria-label')).toBe('Meta da semana');
    expect(largura(el)).toBe('40%');
  });

  it('limita o preenchimento entre 0 e o máximo', () => {
    expect(largura(render(ProgressBar, { valor: 150, rotulo: 'x' }))).toBe('100%');
    expect(largura(render(ProgressBar, { valor: -3, rotulo: 'x' }))).toBe('0%');
  });

  it('usa o máximo recebido e o texto formatado', () => {
    const el = render(ProgressBar, {
      valor: 3,
      max: 4,
      rotulo: 'Treinos',
      formatar: (n: number) => `${n} de 4`,
    });
    expect(largura(el)).toBe('75%');
    expect(el.querySelector('[role="progressbar"]')!.getAttribute('aria-valuetext')).toBe('3 de 4');
  });

  it('máximo zero não gera NaN', () => {
    expect(largura(render(ProgressBar, { valor: 1, max: 0, rotulo: 'x' }))).toBe('0%');
  });
});

describe('WeekDots', () => {
  it('mostra S T Q Q S S D e marca os dias ativos', () => {
    const el = render(WeekDots, { ativos: [true, true, false, false, false, false, false] });
    const pontos = [...el.querySelectorAll('li')];

    expect(pontos.map((li) => li.querySelector('[aria-hidden="true"]')!.textContent)).toEqual([
      'S',
      'T',
      'Q',
      'Q',
      'S',
      'S',
      'D',
    ]);
    expect(pontos.map((li) => li.classList.contains('ui-dia--ativo'))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('o leitor de tela recebe o nome do dia e se treinou', () => {
    const el = render(WeekDots, { ativos: [true] });
    const textos = [...el.querySelectorAll('li .ui-sr-only')].map((s) => s.textContent!.trim());
    expect(textos[0]).toBe('Segunda: treinou');
    expect(textos[1]).toBe('Terça: não treinou');
    expect(textos).toHaveLength(7);
  });

  it('lista vazia completa com dias inativos', () => {
    expect(render(WeekDots, { ativos: [] }).querySelectorAll('li.ui-dia--ativo')).toHaveLength(0);
  });
});

@Component({
  imports: [BarChart],
  template: `<ui-bar-chart [dados]="dados" />`,
})
class Host {
  dados = horas;
}

describe('uso em template', () => {
  it('renderiza dentro de um host', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('rect.ui-barra')).toHaveLength(3);
  });
});
