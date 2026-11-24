import { Injectable } from '@nestjs/common';
import type { ContextoDeMensagem } from '@gymos/shared-templates';
import type { Prisma } from '../../../generated/prisma/client';
import { CifraDeCampos } from '../../platform/application/protecao-de-dados';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import {
  type DadosDaConexao,
  type Mensagem,
  type NovaMensagem,
  type NovoUsoDeIA,
  RepositorioDeConexoes,
  RepositorioDeMensagens,
  RepositorioDeUsoDeIA,
} from '../application/portas';
import type { CanalMeta, ConexaoMeta, EstadoDaConexao } from '../domain/meta';
import type {
  CanalDeMensagem,
  EstadoDaMensagem,
  FinalidadeDeMensagem,
  MotivoDaRecusa,
} from '../domain/mensagens';

// Repositórios do domínio integracoes: usam o cliente da transação do tenant (RLS).

const CAMPO_DO_TOKEN = 'conexao_meta.token';

const conexao = (linha: Prisma.ConexaoMetaGetPayload<object>): ConexaoMeta => ({
  canal: linha.canal as CanalMeta,
  estado: linha.estado as EstadoDaConexao,
  contaId: linha.contaId,
  contaNome: linha.contaNome,
  expiraEm: linha.expiraEm,
  conectadoEm: linha.conectadoEm,
});

@Injectable()
export class RepositorioDeConexoesPrisma extends RepositorioDeConexoes {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly cifra: CifraDeCampos,
  ) {
    super();
  }

  async todas(): Promise<ConexaoMeta[]> {
    const linhas = await this.contexto
      .cliente()
      .conexaoMeta.findMany({ orderBy: { canal: 'asc' } });
    return linhas.map(conexao);
  }

  async porCanal(canal: CanalMeta): Promise<ConexaoMeta | null> {
    const linha = await this.contexto.cliente().conexaoMeta.findFirst({ where: { canal } });
    return linha && conexao(linha);
  }

  async salvar(dados: DadosDaConexao): Promise<ConexaoMeta> {
    const { canal, token, ...campos } = dados;
    const cifrado =
      token === undefined
        ? {}
        : { token: token === null ? null : await this.cifra.cifrar(CAMPO_DO_TOKEN, token) };
    const comum = { ...campos, ...cifrado };
    const linha = await this.contexto.cliente().conexaoMeta.upsert({
      where: { tenantId_canal: { tenantId: this.contexto.tenant().id, canal } },
      create: { tenantId: this.contexto.tenant().id, canal, ...comum },
      update: comum,
    });
    return conexao(linha);
  }

  async token(canal: CanalMeta): Promise<string | null> {
    const linha = await this.contexto
      .cliente()
      .conexaoMeta.findFirst({ where: { canal }, select: { token: true } });
    return linha?.token ? this.cifra.decifrar(CAMPO_DO_TOKEN, linha.token) : null;
  }

  async aVencer(ate: Date): Promise<ConexaoMeta[]> {
    const linhas = await this.contexto.cliente().conexaoMeta.findMany({
      where: { estado: 'conectado', expiraEm: { lte: ate } },
      orderBy: { canal: 'asc' },
    });
    return linhas.map(conexao);
  }
}

const mensagem = (linha: Prisma.MensagemGetPayload<object>): Mensagem => ({
  id: linha.id,
  alunoId: linha.alunoId,
  direcao: linha.direcao as Mensagem['direcao'],
  canal: linha.canal as CanalDeMensagem,
  finalidade: linha.finalidade as FinalidadeDeMensagem | null,
  contexto: linha.contexto as ContextoDeMensagem | null,
  texto: linha.texto,
  estado: linha.estado as EstadoDaMensagem,
  motivo: linha.motivo as MotivoDaRecusa | null,
  idExterno: linha.idExterno,
  criadoEm: linha.criadoEm,
});

@Injectable()
export class RepositorioDeMensagensPrisma extends RepositorioDeMensagens {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async criar(dados: NovaMensagem): Promise<Mensagem> {
    const linha = await this.contexto.cliente().mensagem.create({
      data: { tenantId: this.contexto.tenant().id, ...dados, atualizadoEm: dados.criadoEm },
    });
    return mensagem(linha);
  }

  async porIdExterno(idExterno: string): Promise<Mensagem | null> {
    const linha = await this.contexto.cliente().mensagem.findFirst({ where: { idExterno } });
    return linha && mensagem(linha);
  }

  async atualizarEstado(
    id: string,
    estado: EstadoDaMensagem,
    quando: Date,
    idExterno?: string,
    motivo?: MotivoDaRecusa,
  ): Promise<void> {
    await this.contexto.cliente().mensagem.update({
      where: { id },
      data: {
        estado,
        atualizadoEm: quando,
        ...(idExterno ? { idExterno } : {}),
        ...(motivo ? { motivo } : {}),
      },
    });
  }

  async doAluno(alunoId: string): Promise<Mensagem[]> {
    const linhas = await this.contexto.cliente().mensagem.findMany({
      where: { alunoId },
      orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
    });
    return linhas.map(mensagem);
  }

  async excluirDoAluno(alunoId: string): Promise<number> {
    const { count } = await this.contexto.cliente().mensagem.deleteMany({ where: { alunoId } });
    return count;
  }
}

@Injectable()
export class RepositorioDeUsoDeIAPrisma extends RepositorioDeUsoDeIA {
  constructor(private readonly contexto: ContextoDoTenant) {
    super();
  }

  async registrar(uso: NovoUsoDeIA): Promise<void> {
    await this.contexto
      .cliente()
      .usoDeIa.create({ data: { tenantId: this.contexto.tenant().id, ...uso } });
  }

  async totalDoPeriodo(
    de: Date,
    ate: Date,
  ): Promise<{ chamadas: number; tokensEntrada: number; tokensSaida: number }> {
    const soma = await this.contexto.cliente().usoDeIa.aggregate({
      where: { criadoEm: { gte: de, lt: ate } },
      _count: true,
      _sum: { tokensEntrada: true, tokensSaida: true },
    });
    return {
      chamadas: soma._count,
      tokensEntrada: soma._sum.tokensEntrada ?? 0,
      tokensSaida: soma._sum.tokensSaida ?? 0,
    };
  }
}
