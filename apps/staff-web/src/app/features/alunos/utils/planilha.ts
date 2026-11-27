import { somenteDigitos, validarCpf } from '@gymos/shared-validation';
import type { LinhaDaPlanilha } from '../models/aluno';
import { dataParaIso } from './datas';

/** Campos da API que uma coluna da planilha pode alimentar. */
export type CampoDeImportacao = keyof LinhaDaPlanilha;
export type Destino = CampoDeImportacao | '';

export const CAMPOS_DE_IMPORTACAO: readonly { campo: CampoDeImportacao; rotulo: string }[] = [
  { campo: 'nome', rotulo: 'Nome' },
  { campo: 'cpf', rotulo: 'CPF' },
  { campo: 'telefone', rotulo: 'Telefone' },
  { campo: 'email', rotulo: 'E-mail' },
  { campo: 'dataNascimento', rotulo: 'Data de nascimento' },
  { campo: 'plano', rotulo: 'Plano' },
  { campo: 'inicioDoContrato', rotulo: 'Início do contrato' },
];

/** Nome da coluna, sem acento nem pontuação, como a planilha do sistema anterior costuma trazer. */
const SINONIMOS: Readonly<Record<CampoDeImportacao, readonly string[]>> = {
  nome: ['nome', 'nomecompleto', 'aluno', 'nomedoaluno'],
  cpf: ['cpf', 'cpfdoaluno', 'documento'],
  telefone: ['telefone', 'celular', 'whatsapp', 'fone', 'tel'],
  email: ['email', 'emaildoaluno'],
  dataNascimento: ['nascimento', 'datanascimento', 'datadenascimento', 'nasc'],
  plano: ['plano', 'nomedoplano'],
  inicioDoContrato: ['inicio', 'iniciodocontrato', 'datadeinicio', 'adesao', 'datadeadesao'],
};

export type Celula = string | number | boolean | Date | null | undefined;

/** A planilha lida: a primeira linha vira os cabeçalhos e as demais, os dados (como texto). */
export interface Planilha {
  readonly cabecalhos: readonly string[];
  readonly linhas: readonly (readonly string[])[];
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Cada campo fica com a primeira coluna que o nomeia; o resto vem como "Não importar". */
export function mapearColunas(cabecalhos: readonly string[]): readonly Destino[] {
  const usados = new Set<CampoDeImportacao>();
  return cabecalhos.map((cabecalho) => {
    const chave = normalizar(cabecalho);
    const campo = CAMPOS_DE_IMPORTACAO.find(
      (item) => !usados.has(item.campo) && SINONIMOS[item.campo].includes(chave),
    )?.campo;
    if (!campo) {
      return '';
    }
    usados.add(campo);
    return campo;
  });
}

function textoDaCelula(celula: Celula): string {
  if (celula == null) {
    return '';
  }
  if (celula instanceof Date) {
    return celula.toISOString().slice(0, 10);
  }
  return String(celula).trim();
}

/** Monta a planilha a partir das linhas cruas (xlsx ou csv), ignorando linhas totalmente vazias. */
export function montarPlanilha(cruas: readonly (readonly Celula[])[]): Planilha {
  const linhas = cruas
    .map((linha) => linha.map(textoDaCelula))
    .filter((linha) => linha.some((texto) => texto !== ''));
  const [cabecalhos = [], ...dados] = linhas;
  return { cabecalhos, linhas: dados };
}

/** CSV com `;` ou `,` (o Excel brasileiro salva com `;`), aspas duplas e quebras dentro de campo. */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? '';
  const separador = primeira.split(';').length >= primeira.split(',').length ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const letra = limpo.charAt(i);
    if (aspas) {
      if (letra === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (letra === '"') {
        aspas = false;
      } else {
        campo += letra;
      }
    } else if (letra === '"') {
      aspas = true;
    } else if (letra === separador) {
      linha.push(campo);
      campo = '';
    } else if (letra === '\n' || letra === '\r') {
      if (letra === '\r' && limpo[i + 1] === '\n') {
        i++;
      }
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else {
      campo += letra;
    }
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

/** Lê `.xlsx` ou `.csv`; o leitor de xlsx só carrega quando alguém envia a planilha. */
export async function lerArquivo(arquivo: File): Promise<Planilha> {
  if (/\.csv$/i.test(arquivo.name)) {
    return montarPlanilha(lerCsv(await arquivo.text()));
  }
  const { readSheet } = await import('read-excel-file/browser');
  return montarPlanilha((await readSheet(arquivo)) as readonly (readonly Celula[])[]);
}

/** Linhas da planilha prontas para a API; `numeros` guarda o número de cada uma na planilha (de 1). */
export interface LinhasParaImportar {
  readonly linhas: readonly LinhaDaPlanilha[];
  readonly numeros: readonly number[];
  /** Linhas que nem seguem para a API: sem nome. */
  readonly semNome: readonly { linha: number; cpf: string }[];
}

/** O Excel guarda CPF como número e perde os zeros da frente: devolve os 11 dígitos. */
function cpfDaPlanilha(texto: string): string {
  return /^\d{1,10}$/.test(texto) ? somenteDigitos(texto).padStart(11, '0') : texto;
}

export function prepararLinhas(planilha: Planilha, mapa: readonly Destino[]): LinhasParaImportar {
  const linhas: LinhaDaPlanilha[] = [];
  const numeros: number[] = [];
  const semNome: { linha: number; cpf: string }[] = [];
  planilha.linhas.forEach((celulas, indice) => {
    const valores: Partial<Record<CampoDeImportacao, string>> = {};
    mapa.forEach((destino, coluna) => {
      if (destino) {
        valores[destino] = celulas[coluna] ?? '';
      }
    });
    const cpf = cpfDaPlanilha(valores.cpf ?? '');
    const numero = indice + 1;
    if (!valores.nome) {
      semNome.push({ linha: numero, cpf });
      return;
    }
    linhas.push({
      nome: valores.nome,
      cpf,
      telefone: valores.telefone || null,
      email: valores.email || null,
      dataNascimento: dataParaIso(valores.dataNascimento),
      plano: valores.plano || null,
      inicioDoContrato: dataParaIso(valores.inicioDoContrato),
    });
    numeros.push(numero);
  });
  return { linhas, numeros, semNome };
}

/** Quantas linhas têm CPF válido (as que a API vai tentar criar). */
export function contarCpfsValidos(linhas: readonly LinhaDaPlanilha[]): number {
  return linhas.filter((linha) => validarCpf(linha.cpf)).length;
}

/** Nomes de plano da planilha (sem repetir) que o cadastro de Planos não tem. */
export function planosInexistentes(
  linhas: readonly LinhaDaPlanilha[],
  existentes: readonly string[],
): readonly string[] {
  const conhecidos = new Set(existentes.map((nome) => nome.trim().toLowerCase()));
  const faltando = new Map<string, string>();
  for (const linha of linhas) {
    const nome = linha.plano?.trim() ?? '';
    if (nome !== '' && validarCpf(linha.cpf) && !conhecidos.has(nome.toLowerCase())) {
      faltando.set(nome.toLowerCase(), nome);
    }
  }
  return [...faltando.values()];
}

/** Modelo para baixar: cabeçalhos que o mapeamento automático reconhece e CPFs válidos de exemplo. */
export const MODELO_DE_PLANILHA: readonly (readonly string[])[] = [
  [
    'Nome completo',
    'CPF',
    'Telefone',
    'E-mail',
    'Data de nascimento',
    'Plano',
    'Início do contrato',
  ],
  [
    'Rafael Souza',
    '529.982.247-25',
    '(11) 99999-0000',
    'rafael@email.com',
    '15/03/1992',
    'Mensal',
    '19/11/2026',
  ],
  [
    'Camila Duarte',
    '111.444.777-35',
    '(11) 98888-1111',
    'camila@email.com',
    '02/08/1995',
    'Trimestral',
    '19/11/2026',
  ],
  [
    'Pedro Almeida',
    '123.456.789-09',
    '(11) 97777-2222',
    'pedro@email.com',
    '21/01/1988',
    'Anual',
    '19/11/2026',
  ],
];
