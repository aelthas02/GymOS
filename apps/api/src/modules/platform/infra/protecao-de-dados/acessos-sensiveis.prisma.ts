import { Injectable } from '@nestjs/common';
import {
  type LeituraDoTitular,
  RegistroDeAcessoSensivel,
} from '../../application/protecao-de-dados';
import { Relogio } from '../../domain/relogio';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';

/** Grava na transação da leitura: um registro por campo sensível lido. */
@Injectable()
export class RegistroDeAcessoSensivelPrisma extends RegistroDeAcessoSensivel {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly relogio: Relogio,
  ) {
    super();
  }

  async registrar(acesso: LeituraDoTitular & { campos: string[] }): Promise<void> {
    const tenantId = this.contexto.tenant().id;
    const acessadoEm = this.relogio.agora();
    await this.contexto.cliente().acessoADadoSensivel.createMany({
      data: acesso.campos.map((campo) => ({
        tenantId,
        quem: acesso.quem,
        titularId: acesso.titularId,
        campo,
        acessadoEm,
      })),
    });
  }
}
