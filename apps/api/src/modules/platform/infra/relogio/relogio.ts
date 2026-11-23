import { Injectable } from '@nestjs/common';
import { Relogio } from '../../domain/relogio';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';

/** Relógio da API: o do sistema, ou o instante do cabeçalho x-relogio (só em dev e teste). */
@Injectable()
export class RelogioDaRequisicao extends Relogio {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  agora(): Date {
    const fixo = this.contexto.estado()?.instanteFixo;
    return fixo ? new Date(fixo) : new Date();
  }
}

/** Relógio parado para testes; avança só quando o teste manda. */
export class RelogioFixo extends Relogio {
  private instante: Date;

  constructor(instante: Date | string) {
    super();
    this.instante = new Date(instante);
  }

  agora(): Date {
    return new Date(this.instante);
  }

  definir(instante: Date | string): void {
    this.instante = new Date(instante);
  }

  avancar(milissegundos: number): void {
    this.instante = new Date(this.instante.getTime() + milissegundos);
  }
}
