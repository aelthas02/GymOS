import { tipoDeTelefone, validarTelefone } from './contato';
import { validarCnpj, validarCpf } from './documentos';

/** Gerador determinístico (mulberry32) para as propriedades serem reproduzíveis. */
function gerador(semente: number): () => number {
  let estado = semente;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALEATORIO = gerador(424242);
const inteiroAte = (limite: number): number => Math.floor(ALEATORIO() * limite);

// Algoritmo de referência, escrito de outro jeito que o de produção: pesos explícitos da esquerda
// para a direita, em vez de pesos que recomeçam contados da direita.
const PESOS_CPF_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CPF_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function dv(valores: number[], pesos: number[]): number {
  const soma = valores.reduce((total, valor, i) => total + valor * (pesos[i] ?? 0), 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cpfDe(base: number[]): number[] {
  const d1 = dv(base, PESOS_CPF_1);
  const d2 = dv([...base, d1], PESOS_CPF_2);
  return [...base, d1, d2];
}

function cnpjDe(base: number[]): number[] {
  const d1 = dv(base, PESOS_CNPJ_1);
  const d2 = dv([...base, d1], PESOS_CNPJ_2);
  return [...base, d1, d2];
}

const sorteio = (tamanho: number, maximo: number): number[] =>
  Array.from({ length: tamanho }, () => inteiroAte(maximo));
const todosIguais = (valores: number[]): boolean => valores.every((v) => v === valores[0]);

const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// CNPJ alfanumérico: valor = código ASCII − 48 (0-9 → 0-9; A → 17; Z → 42).
const caractereDe = (valor: number): string => String.fromCharCode(valor + 48);

describe('CPFs gerados por um algoritmo de referência', () => {
  const bases = Array.from({ length: 300 }, () => sorteio(9, 10)).filter((b) => !todosIguais(b));

  it('os válidos gerados passam, com e sem máscara', () => {
    for (const base of bases) {
      const cpf = cpfDe(base).join('');
      const mascarado = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;

      expect(validarCpf(cpf)).toBe(true);
      expect(validarCpf(mascarado)).toBe(true);
    }
  });

  it('a mesma base com qualquer dígito verificador alterado é inválida', () => {
    for (const base of bases) {
      const cpf = cpfDe(base);
      for (const posicao of [9, 10]) {
        for (let novo = 0; novo <= 9; novo++) {
          if (novo === cpf[posicao]) {
            continue;
          }
          const alterado = [...cpf];
          alterado[posicao] = novo;

          expect(validarCpf(alterado.join(''))).toBe(false);
        }
      }
    }
  });

  it('um dígito do corpo alterado quebra o CPF', () => {
    for (const base of bases.slice(0, 100)) {
      const cpf = cpfDe(base);
      const posicao = inteiroAte(9);
      const alterado = [...cpf];
      alterado[posicao] = ((cpf[posicao] ?? 0) + 1 + inteiroAte(9)) % 10;

      expect(validarCpf(alterado.join(''))).toBe(false);
    }
  });
});

describe('CNPJs gerados por um algoritmo de referência', () => {
  const basesNumericas = Array.from({ length: 300 }, () => sorteio(12, 10)).filter(
    (b) => !todosIguais(b),
  );
  const basesAlfanumericas = Array.from({ length: 300 }, () =>
    sorteio(12, 36).map((i) => ALFABETO.charCodeAt(i) - 48),
  );

  const emTexto = (valores: number[]): string => valores.map(caractereDe).join('');
  const comMascara = (t: string): string =>
    `${t.slice(0, 2)}.${t.slice(2, 5)}.${t.slice(5, 8)}/${t.slice(8, 12)}-${t.slice(12)}`;

  it('os numéricos e os alfanuméricos válidos passam, com e sem máscara', () => {
    for (const base of [...basesNumericas, ...basesAlfanumericas]) {
      const texto = emTexto(cnpjDe(base));

      expect(validarCnpj(texto)).toBe(true);
      expect(validarCnpj(comMascara(texto))).toBe(true);
      expect(validarCnpj(texto.toLowerCase())).toBe(true);
    }
  });

  it('a mesma base com qualquer dígito verificador alterado é inválida', () => {
    for (const base of [...basesNumericas, ...basesAlfanumericas]) {
      const cnpj = cnpjDe(base);
      for (const posicao of [12, 13]) {
        for (let novo = 0; novo <= 9; novo++) {
          if (novo === cnpj[posicao]) {
            continue;
          }
          const alterado = [...cnpj];
          alterado[posicao] = novo;

          expect(validarCnpj(emTexto(alterado))).toBe(false);
        }
      }
    }
  });

  it('letra nos dígitos verificadores é recusada', () => {
    for (const base of basesAlfanumericas.slice(0, 50)) {
      const cnpj = emTexto(cnpjDe(base));

      expect(validarCnpj(`${cnpj.slice(0, 12)}A${cnpj[13]}`)).toBe(false);
      expect(validarCnpj(`${cnpj.slice(0, 13)}B`)).toBe(false);
    }
  });
});

describe('DDDs de telefone', () => {
  const INVALIDOS = [
    10, 20, 23, 25, 26, 29, 30, 36, 39, 40, 50, 52, 56, 57, 58, 59, 60, 70, 72, 76, 78, 80, 90,
  ];
  const VALIDOS = Array.from({ length: 90 }, (_, i) => i + 10).filter(
    (ddd) => !INVALIDOS.includes(ddd),
  );

  it.each(INVALIDOS)('DDD %i é recusado em celular e fixo', (ddd) => {
    expect(validarTelefone(`(${ddd}) 99999-0000`)).toBe(false);
    expect(validarTelefone(`(${ddd}) 3333-4444`)).toBe(false);
    expect(tipoDeTelefone(`+55${ddd}999990000`)).toBeNull();
  });

  it('os outros 67 DDDs de 10 a 99 são aceitos, como celular e como fixo', () => {
    expect(VALIDOS).toHaveLength(67);
    for (const ddd of VALIDOS) {
      expect(tipoDeTelefone(`(${ddd}) 99999-0000`)).toBe('celular');
      expect(tipoDeTelefone(`${ddd}33334444`)).toBe('fixo');
      expect(tipoDeTelefone(`+55 (${ddd}) 3333-4444`)).toBe('fixo');
    }
  });

  it.each(['00', '01', '09'])('DDD %s (começa em zero) é recusado', (ddd) => {
    expect(validarTelefone(`(${ddd}) 99999-0000`)).toBe(false);
  });
});
