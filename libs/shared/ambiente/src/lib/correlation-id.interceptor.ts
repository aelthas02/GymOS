import type { HttpInterceptorFn } from '@angular/common/http';

/** Mesmo nome lido pela API (apps/api/src/observabilidade/correlation-id.ts). */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

// randomUUID só existe em contexto seguro (https ou localhost); aberto por http num IP da rede,
// como no teste em celular, o UUID v4 é montado com getRandomValues.
function uuidV4(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Cabeçalho próprio em outra origem dispara preflight de CORS (ex.: upload direto ao S3).
function isSameOrigin(url: string): boolean {
  return new URL(url, location.href).origin === location.origin;
}

/** Envia um `x-correlation-id` novo em cada requisição à própria origem (a API em /api). */
export const correlationIdInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.headers.has(CORRELATION_ID_HEADER) || !isSameOrigin(request.url)) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { [CORRELATION_ID_HEADER]: uuidV4() } }));
};
