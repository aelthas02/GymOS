import { Body, Controller, Module, Put } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GLOBAL_PREFIX } from '../../../../app/configure-app';
import {
  ContratoDivergenteError,
  criarDocumentoOpenApi,
  serializarContrato,
  verificarContrato,
} from './contrato';

class ExemploDto {
  @ApiProperty()
  nome!: string;
}

class ExemploDtoAlterado {
  @ApiProperty()
  nome!: string;

  @ApiProperty()
  apelido!: string;
}

async function contratoCom(dto: typeof ExemploDto | typeof ExemploDtoAlterado): Promise<string> {
  @Controller('exemplo')
  class ExemploController {
    @Put()
    salvar(@Body() corpo: ExemploDto): ExemploDto {
      return corpo;
    }
  }
  // O nome do schema no contrato vem do nome da classe: as duas versões viram "ExemploDto".
  Object.defineProperty(dto, 'name', { value: 'ExemploDto' });
  Reflect.defineMetadata('design:paramtypes', [dto], ExemploController.prototype, 'salvar');

  @Module({ controllers: [ExemploController] })
  class ExemploModule {}

  const modulo = await Test.createTestingModule({ imports: [ExemploModule] }).compile();
  const app = modulo.createNestApplication({ logger: false });
  app.setGlobalPrefix(GLOBAL_PREFIX);
  await app.init();
  try {
    return serializarContrato(criarDocumentoOpenApi(app));
  } finally {
    await app.close();
  }
}

describe('divergência do contrato OpenAPI', () => {
  const commitado = join(mkdtempSync(join(tmpdir(), 'contrato-')), 'openapi.json');

  beforeAll(async () => {
    writeFileSync(commitado, await contratoCom(ExemploDto));
  });

  it('passa quando o contrato gerado é igual ao commitado', async () => {
    const gerado = await contratoCom(ExemploDto);

    expect(JSON.parse(gerado).paths).toHaveProperty(`/${GLOBAL_PREFIX}/exemplo`);

    expect(() => verificarContrato(commitado, gerado)).not.toThrow();
  });

  it('alterar um DTO sem regenerar o contrato falha a verificação', async () => {
    const gerado = await contratoCom(ExemploDtoAlterado);

    expect(() => verificarContrato(commitado, gerado)).toThrow(ContratoDivergenteError);
    expect(() => verificarContrato(commitado, gerado)).toThrow(/pnpm nx run api:openapi/);
  });
});
