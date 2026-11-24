/**
 * Núcleo do teclado virtual, sem Angular: o serviço e a diretiva só o envolvem, e a página de
 * demonstração do harness (`@gymos/shared-testing`) o executa de verdade no navegador.
 */

/** Abaixo disso a diferença é barra de endereço do navegador, não teclado. */
export const LIMITE_DO_TECLADO_PX = 80;
/** Espera o teclado terminar de abrir antes de rolar até o campo. */
export const ATRASO_DA_ROLAGEM_MS = 300;
/** Variável CSS lida pelos rodapés de ação fixos: `bottom: var(--teclado-altura, 0px)`. */
export const VARIAVEL_DA_ALTURA = '--teclado-altura';

export interface EstadoDoTeclado {
  aberto: boolean;
  /** Quanto do layout o teclado cobre; no Android (`resizes-content`) o layout encolhe e fica 0. */
  alturaDoTeclado: number;
  /** Altura da área que o usuário enxerga. */
  alturaVisivel: number;
}

export const TECLADO_FECHADO: EstadoDoTeclado = {
  aberto: false,
  alturaDoTeclado: 0,
  alturaVisivel: 0,
};

type JanelaComViewport = Pick<
  Window,
  'innerHeight' | 'innerWidth' | 'visualViewport' | 'addEventListener' | 'removeEventListener'
>;

/** Calcula o teclado pela diferença entre o layout e o `visualViewport` (altura e `offsetTop`). */
export function calcularTeclado(
  janela: JanelaComViewport,
  alturaDeReferencia = janela.innerHeight,
): EstadoDoTeclado {
  const viewport = janela.visualViewport;
  if (!viewport) {
    return { ...TECLADO_FECHADO, alturaVisivel: janela.innerHeight };
  }
  const coberto = Math.max(
    0,
    Math.round(janela.innerHeight - viewport.height - viewport.offsetTop),
  );
  // Android (resizes-content): o layout encolhe, então o teclado só aparece contra a altura de referência.
  const encolhido = Math.max(0, alturaDeReferencia - janela.innerHeight);
  const aberto = Math.max(coberto, encolhido) >= LIMITE_DO_TECLADO_PX;
  return {
    aberto,
    alturaDoTeclado: coberto >= LIMITE_DO_TECLADO_PX ? coberto : 0,
    alturaVisivel: Math.round(viewport.height),
  };
}

/** Publica a altura do teclado em `--teclado-altura` no elemento raiz. */
export function publicarAltura(documento: Document, alturaDoTeclado: number): void {
  documento.documentElement.style.setProperty(VARIAVEL_DA_ALTURA, `${alturaDoTeclado}px`);
}

/** Observa `resize` e `scroll` do `visualViewport` e avisa o estado a cada mudança (e já na chamada). */
export function observarTeclado(
  janela: JanelaComViewport,
  aoMudar: (estado: EstadoDoTeclado) => void,
): () => void {
  // Maior altura de layout vista na largura atual: é a janela sem teclado (zera ao girar o aparelho).
  let largura = janela.innerWidth;
  let referencia = janela.innerHeight;
  const atualizar = (): void => {
    if (janela.innerWidth !== largura) {
      largura = janela.innerWidth;
      referencia = janela.innerHeight;
    }
    referencia = Math.max(referencia, janela.innerHeight);
    aoMudar(calcularTeclado(janela, referencia));
  };
  const viewport = janela.visualViewport;
  viewport?.addEventListener('resize', atualizar);
  viewport?.addEventListener('scroll', atualizar);
  janela.addEventListener('resize', atualizar);
  atualizar();
  return () => {
    viewport?.removeEventListener('resize', atualizar);
    viewport?.removeEventListener('scroll', atualizar);
    janela.removeEventListener('resize', atualizar);
  };
}

export function ehCampoEditavel(alvo: EventTarget | null): alvo is HTMLElement {
  if (!(alvo instanceof HTMLElement)) {
    return false;
  }
  return (
    alvo instanceof HTMLInputElement ||
    alvo instanceof HTMLTextAreaElement ||
    alvo instanceof HTMLSelectElement ||
    alvo.isContentEditable
  );
}

/**
 * O `scrollIntoView` centraliza no layout; com o teclado cobrindo parte dele (iOS) o centro do layout
 * pode ficar fora da área visível. Se o campo não coube, corrige a rolagem pelo `visualViewport`.
 */
function centralizarNaAreaVisivel(campo: HTMLElement): void {
  const janela = campo.ownerDocument.defaultView;
  const viewport = janela?.visualViewport;
  if (!janela || !viewport) {
    return;
  }
  const caixa = campo.getBoundingClientRect();
  const topo = viewport.offsetTop;
  const base = topo + viewport.height;
  if (caixa.top < topo || caixa.bottom > base) {
    janela.scrollBy(0, (caixa.top + caixa.bottom) / 2 - (topo + base) / 2);
  }
}

/**
 * Ao focar um campo da `raiz`, espera o teclado abrir e rola o campo para o centro da área visível.
 * Sem teclado aberto (desktop) não faz nada. Devolve a função que desliga o comportamento.
 */
export function rolarCampoFocadoParaOCentro(
  raiz: HTMLElement,
  teclado: () => EstadoDoTeclado,
  atrasoMs = ATRASO_DA_ROLAGEM_MS,
): () => void {
  let pendente: ReturnType<typeof setTimeout> | undefined;
  const aoFocar = (evento: FocusEvent): void => {
    const alvo = evento.target;
    if (!ehCampoEditavel(alvo)) {
      return;
    }
    clearTimeout(pendente);
    pendente = setTimeout(() => {
      if (teclado().aberto) {
        alvo.scrollIntoView({ block: 'center' });
        centralizarNaAreaVisivel(alvo);
      }
    }, atrasoMs);
  };
  raiz.addEventListener('focusin', aoFocar);
  return () => {
    clearTimeout(pendente);
    raiz.removeEventListener('focusin', aoFocar);
  };
}
