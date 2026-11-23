import {
  CATALOGO_POR_CONTEXTO,
  NOME_DO_CONTEXTO,
  ehVariavelDeMensagem,
  type ContextoDeMensagem,
  type VariavelDeMensagem,
} from './catalogo';

export type ParteDoModelo =
  | { tipo: 'texto'; texto: string; posicao: number }
  | { tipo: 'variavel'; nome: string; posicao: number; comprimento: number };

export type CodigoDeErroDoModelo =
  | 'variavel-desconhecida'
  | 'variavel-fora-do-contexto'
  | 'chave-sem-fechamento'
  | 'chave-sem-abertura';

/** `posicao` é o índice (a partir de 0) do primeiro caractere do trecho com erro. */
export interface ErroDoModelo {
  codigo: CodigoDeErroDoModelo;
  posicao: number;
  comprimento: number;
  mensagem: string;
}

export interface AnaliseDoModelo {
  partes: ParteDoModelo[];
  erros: ErroDoModelo[];
}

export interface ValidacaoDoModelo extends AnaliseDoModelo {
  valido: boolean;
  /** Variáveis usadas, cada uma uma vez, na ordem em que aparecem. */
  variaveis: VariavelDeMensagem[];
}

// Uma variável completa, sem chave dentro, ou uma chave solta.
const SIMBOLO = /\{([^{}]*)\}|[{}]/g;

function adicionarTexto(partes: ParteDoModelo[], texto: string, posicao: number): void {
  const anterior = partes.at(-1);
  if (anterior?.tipo === 'texto') {
    anterior.texto += texto;
  } else {
    partes.push({ tipo: 'texto', texto, posicao });
  }
}

/** Separa texto e variáveis e aponta as chaves soltas. Os nomes são conferidos em `validarModelo`. */
export function analisarModelo(texto: string): AnaliseDoModelo {
  const partes: ParteDoModelo[] = [];
  const erros: ErroDoModelo[] = [];
  let fimDoAnterior = 0;

  for (const simbolo of texto.matchAll(SIMBOLO)) {
    const posicao = simbolo.index;
    if (posicao > fimDoAnterior) {
      adicionarTexto(partes, texto.slice(fimDoAnterior, posicao), fimDoAnterior);
    }
    const [trecho, nome] = simbolo;
    fimDoAnterior = posicao + trecho.length;

    if (nome !== undefined) {
      partes.push({ tipo: 'variavel', nome, posicao, comprimento: trecho.length });
      continue;
    }
    adicionarTexto(partes, trecho, posicao);
    erros.push(
      trecho === '{'
        ? {
            codigo: 'chave-sem-fechamento',
            posicao,
            comprimento: 1,
            mensagem: 'Falta fechar esta chave.',
          }
        : {
            codigo: 'chave-sem-abertura',
            posicao,
            comprimento: 1,
            mensagem: 'Esta chave fecha sem ter sido aberta.',
          },
    );
  }

  if (fimDoAnterior < texto.length) {
    adicionarTexto(partes, texto.slice(fimDoAnterior), fimDoAnterior);
  }
  return { partes, erros };
}

function erroDeVariavel(
  nome: string,
  contexto: ContextoDeMensagem,
  posicao: number,
  comprimento: number,
): ErroDoModelo | null {
  if (!ehVariavelDeMensagem(nome)) {
    return {
      codigo: 'variavel-desconhecida',
      posicao,
      comprimento,
      mensagem: `A variável {${nome}} não existe.`,
    };
  }
  if (!CATALOGO_POR_CONTEXTO[contexto].includes(nome)) {
    return {
      codigo: 'variavel-fora-do-contexto',
      posicao,
      comprimento,
      mensagem: `{${nome}} não pode ser usada em mensagens de ${NOME_DO_CONTEXTO[contexto]}.`,
    };
  }
  return null;
}

/** Confere a sintaxe e se cada variável existe e pertence ao catálogo do contexto. */
export function validarModelo(texto: string, contexto: ContextoDeMensagem): ValidacaoDoModelo {
  const { partes, erros } = analisarModelo(texto);
  const variaveis = new Set<VariavelDeMensagem>();

  for (const parte of partes) {
    if (parte.tipo === 'texto') {
      continue;
    }
    const erro = erroDeVariavel(parte.nome, contexto, parte.posicao, parte.comprimento);
    if (erro) {
      erros.push(erro);
    } else {
      variaveis.add(parte.nome as VariavelDeMensagem);
    }
  }

  erros.sort((a, b) => a.posicao - b.posicao);
  return { valido: erros.length === 0, partes, erros, variaveis: [...variaveis] };
}
