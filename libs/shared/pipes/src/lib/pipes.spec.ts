import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrlPipe,
  CnpjPipe,
  CpfPipe,
  DataBrPipe,
  IniciaisPipe,
  PIPES_DE_EXIBICAO,
  PercentualPipe,
  RotuloDeStatusPipe,
  TelefonePipe,
  TempoRelativoPipe,
} from './pipes';

describe('pipes de exibição', () => {
  it('brl formata centavos e recusa fração', () => {
    expect(new BrlPipe().transform(4832000)).toBe('R$ 48.320,00');
    expect(new BrlPipe().transform(-298)).toBe('-R$ 2,98');
    expect(() => new BrlPipe().transform(1.5)).toThrow(RangeError);
  });

  it('cpf, cnpj e phone pontuam o valor cru', () => {
    expect(new CpfPipe().transform('12345678909')).toBe('123.456.789-09');
    expect(new CnpjPipe().transform('12345678000195')).toBe('12.345.678/0001-95');
    expect(new TelefonePipe().transform('11999990000')).toBe('(11) 99999-0000');
  });

  it('percent recebe pontos-base', () => {
    expect(new PercentualPipe().transform(250)).toBe('2,5%');
    expect(new PercentualPipe().transform(385, 2)).toBe('3,85%');
  });

  it('dateBr usa o fuso de São Paulo', () => {
    expect(new DataBrPipe().transform('2026-11-19T02:30:00Z')).toBe('18/11/2026');
    expect(new DataBrPipe().transform('2026-11-19T02:30:00Z', 'hora')).toBe('23:30');
  });

  it('relativeTime recebe a variante e o agora do relógio', () => {
    const agora = '2026-11-19T09:00:00-03:00';

    expect(new TempoRelativoPipe().transform('2026-11-19T07:00:00-03:00', 'curta', agora)).toBe(
      'há 2h',
    );
  });

  it('initials e statusLabel', () => {
    expect(new IniciaisPipe().transform('Rafael Souza')).toBe('RS');
    expect(new RotuloDeStatusPipe().transform('late', 6)).toBe('Em atraso, 6 dias');
  });

  it('null e undefined viram texto vazio em todos os pipes', () => {
    const agora = '2026-11-19T09:00:00-03:00';

    expect([
      new BrlPipe().transform(null),
      new CpfPipe().transform(undefined),
      new CnpjPipe().transform(null),
      new TelefonePipe().transform(null),
      new PercentualPipe().transform(undefined),
      new DataBrPipe().transform(null),
      new TempoRelativoPipe().transform(null, 'lista', agora),
      new IniciaisPipe().transform(undefined),
      new RotuloDeStatusPipe().transform(null),
    ]).toEqual(Array(9).fill(''));
  });

  it('os nomes dos pipes funcionam no template', () => {
    @Component({
      imports: [PIPES_DE_EXIBICAO],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `{{ 11900 | brl }} | {{ '12345678909' | cpf }} | {{ '12345678000195' | cnpj }} |
        {{ '1133334444' | phone }} | {{ 250 | percent }} | {{ '2026-11-19' | dateBr }} |
        {{ '2026-11-18T07:00:00-03:00' | relativeTime: 'lista' : agora }} |
        {{ 'Juliana Prado' | initials }} | {{ 'soon' | statusLabel: 3 }}`,
    })
    class Vitrine {
      readonly agora = '2026-11-19T09:00:00-03:00';
    }

    const fixture = TestBed.createComponent(Vitrine);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'R$ 119,00 | 123.456.789-09 | 12.345.678/0001-95 | (11) 3333-4444 | 2,5% | 19/11/2026 | ' +
        'Ontem | JP | Vence em 3 dias',
    );
  });
});
