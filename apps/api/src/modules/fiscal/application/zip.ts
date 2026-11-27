import { crc32 } from 'node:zlib';

export interface ArquivoDoZip {
  nome: string;
  conteudo: Buffer;
}

// Data e hora fixas no formato DOS (01/01/2026 00:00): o conteúdo do pacote não depende do relógio.
const DATA_DOS = ((2026 - 1980) << 9) | (1 << 5) | 1;
const HORA_DOS = 0;
const UTF8 = 0x0800;

/**
 * ZIP sem compressão (método "store"), o suficiente para a exportação ao contador: XMLs pequenos e um
 * CSV. Nomes em UTF-8 (bit 11) e sem ZIP64 (até 65 535 arquivos e 4 GB).
 */
export function montarZip(arquivos: readonly ArquivoDoZip[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let deslocamento = 0;
  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome, 'utf-8');
    const crc = crc32(arquivo.conteudo);
    const tamanho = arquivo.conteudo.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(HORA_DOS, 10);
    local.writeUInt16LE(DATA_DOS, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(tamanho, 18);
    local.writeUInt32LE(tamanho, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);
    locais.push(local, nome, arquivo.conteudo);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(HORA_DOS, 12);
    central.writeUInt16LE(DATA_DOS, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(tamanho, 20);
    central.writeUInt32LE(tamanho, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    centrais.push(central, nome);

    deslocamento += local.length + nome.length + tamanho;
  }
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}
