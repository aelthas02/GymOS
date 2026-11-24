import { NotFoundException } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { FalhaNaoEncontradaError, type FilasBullMQ } from '../../infra/filas/filas.bullmq';
import { FalhasController } from './falhas.controller';
import { protecaoDoPainel } from './painel-de-filas';

const CHAVE = 'chave-de-operacao-de-teste';

function chamar(headers: Record<string, string>) {
  const proximo = vi.fn();
  const res = { statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
  protecaoDoPainel(CHAVE)(
    { headers } as unknown as IncomingMessage,
    res as unknown as ServerResponse,
    proximo,
  );
  return { proximo, res };
}

const basic = (usuario: string, senha: string) =>
  `Basic ${Buffer.from(`${usuario}:${senha}`).toString('base64')}`;

describe('protecaoDoPainel', () => {
  it('aceita a chave no cabeçalho', () => {
    expect(chamar({ 'x-chave-de-operacao': CHAVE }).proximo).toHaveBeenCalledOnce();
  });

  it('aceita a chave como senha do Basic, com qualquer usuário e senha com ":"', () => {
    expect(chamar({ authorization: basic('operacao', CHAVE) }).proximo).toHaveBeenCalledOnce();
    expect(chamar({ authorization: basic('', CHAVE) }).proximo).toHaveBeenCalledOnce();
  });

  it.each([
    ['sem credenciais', {}],
    ['chave errada no cabeçalho', { 'x-chave-de-operacao': 'errada' }],
    ['Basic com senha errada', { authorization: basic('u', 'errada') }],
    ['Basic sem credenciais', { authorization: 'Basic' }],
    ['esquema Bearer', { authorization: `Bearer ${CHAVE}` }],
  ])('responde 401 com desafio Basic: %s', (_nome, headers) => {
    const { proximo, res } = chamar(headers);

    expect(proximo).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="Filas do GymOS"');
    expect(res.end).toHaveBeenCalledOnce();
  });
});

describe('FalhasController', () => {
  it('traduz falha inexistente em 404', async () => {
    const filas = {
      reprocessarFalha: vi.fn().mockRejectedValue(new FalhaNaoEncontradaError('f1')),
    } as unknown as FilasBullMQ;

    await expect(new FalhasController(filas).reprocessar('f1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('repassa outros erros e conclui sem erro quando reprocessa', async () => {
    const reprocessarFalha = vi.fn().mockRejectedValueOnce(new Error('redis caiu'));
    const controller = new FalhasController({ reprocessarFalha } as unknown as FilasBullMQ);

    await expect(controller.reprocessar('f1')).rejects.toThrow('redis caiu');
    await expect(controller.reprocessar('f2')).resolves.toBeUndefined();
    expect(reprocessarFalha).toHaveBeenLastCalledWith('f2');
  });
});
