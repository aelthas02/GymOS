const ID_DO_VIDEO = /^[\w-]{11}$/;
const HOSTS_DO_YOUTUBE = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
const CAMINHOS_COM_ID = new Set(['shorts', 'embed', 'live']);
const TEM_PROTOCOLO = /^[a-z][a-z\d+.-]*:/i;

function lerUrl(texto: string): URL | null {
  try {
    return new URL(TEM_PROTOCOLO.test(texto) ? texto : `https://${texto}`);
  } catch {
    return null;
  }
}

function idNoEndereco(endereco: URL): string | null {
  const [primeiro = '', segundo = ''] = endereco.pathname.split('/').filter(Boolean);
  if (endereco.hostname === 'youtu.be') {
    return primeiro;
  }
  if (!HOSTS_DO_YOUTUBE.has(endereco.hostname)) {
    return null;
  }
  if (primeiro === 'watch') {
    return endereco.searchParams.get('v');
  }
  return CAMINHOS_COM_ID.has(primeiro) ? segundo : null;
}

/**
 * Id do vídeo em links de vídeo do YouTube (watch, youtu.be, shorts, embed e live), com ou sem
 * protocolo; null para qualquer outra coisa.
 */
export function extrairIdYoutube(url: string): string | null {
  const endereco = lerUrl(url.trim());
  if (!endereco || (endereco.protocol !== 'https:' && endereco.protocol !== 'http:')) {
    return null;
  }
  const id = idNoEndereco(endereco);
  return id !== null && ID_DO_VIDEO.test(id) ? id : null;
}

export function validarUrlYoutube(url: string): boolean {
  return extrairIdYoutube(url) !== null;
}
