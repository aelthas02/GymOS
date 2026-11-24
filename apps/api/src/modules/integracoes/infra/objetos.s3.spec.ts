import { consultaAssinadaSigV4 } from './objetos.s3';

describe('URL pré-assinada SigV4 do armazenamento S3', () => {
  it('reproduz o exemplo oficial da AWS (GET /test.txt, 24 h)', () => {
    const consulta = consultaAssinadaSigV4({
      metodo: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      caminho: '/test.txt',
      regiao: 'us-east-1',
      chaveDeAcesso: 'AKIAIOSFODNN7EXAMPLE',
      segredo: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      agora: new Date('2013-05-24T00:00:00Z'),
      expiraEmSegundos: 86400,
    });

    expect(consulta).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });
});
