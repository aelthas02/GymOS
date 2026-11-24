import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CLIENTE_DA_API, URL_BASE_DA_API, type Resposta, type Schemas } from '@gymos/api-contracts';
import {
  catchError,
  finalize,
  map,
  type Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

export type Perfil = Schemas['PerfilDto'];
export type Sessao = Schemas['SessaoDto'];

/** Exigido pela API no refresh e no logout (CSRF); o cookie `gymos_rt_staff` vai junto. */
const CABECALHO_CSRF = { 'x-gymos-csrf': '1' } as const;

/**
 * Sessão do painel: o token de acesso vive só em memória; o refresh fica no cookie httpOnly
 * `gymos_rt_staff` (T12). O perfil vem de `GET /me` e alimenta menu, permissões e módulos.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly api = inject(CLIENTE_DA_API);
  private readonly base = inject(URL_BASE_DA_API);
  private readonly router = inject(Router);

  private readonly token = signal<string | null>(null);
  private readonly dadosDoPerfil = signal<Perfil | null>(null);
  private renovacao: Observable<string> | null = null;

  readonly accessToken = this.token.asReadonly();
  readonly perfil = this.dadosDoPerfil.asReadonly();
  readonly autenticado = computed(() => this.token() !== null && this.dadosDoPerfil() !== null);

  entrar(email: string, senha: string): Observable<Perfil> {
    return this.api
      .post('/api/auth/staff/login', { email, senha })
      .pipe(switchMap((sessao) => this.iniciar(sessao)));
  }

  /** Cria a senha pelo link do convite e já entra no painel. */
  aceitarConvite(token: string, nome: string, senha: string): Observable<Perfil> {
    return this.api
      .post('/api/auth/staff/convites/aceitar', { token, nome, senha })
      .pipe(switchMap((sessao) => this.iniciar(sessao)));
  }

  /**
   * Garante a sessão ao abrir uma rota protegida: sem token (recarregou a página), tenta o refresh
   * do cookie. Falso quando não há sessão a recuperar.
   */
  restaurar(): Observable<boolean> {
    if (this.autenticado()) {
      return of(true);
    }
    return this.renovar().pipe(
      switchMap(() => this.carregarPerfil()),
      map(() => true),
      catchError(() => {
        this.limpar();
        return of(false);
      }),
    );
  }

  /**
   * Troca o refresh por um novo token. Chamadas simultâneas (vários 401 de uma vez) compartilham
   * uma única renovação, porque o refresh é rotativo e o reuso revogaria a sessão.
   */
  renovar(): Observable<string> {
    this.renovacao ??= this.http
      .post<Sessao>(`${this.base}/api/auth/staff/refresh`, null, {
        headers: CABECALHO_CSRF,
        withCredentials: true,
      })
      .pipe(
        map((sessao) => sessao.accessToken),
        tap((token) => this.token.set(token)),
        finalize(() => (this.renovacao = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.renovacao;
  }

  /** O refresh falhou: limpa a sessão e leva para a tela de entrada. */
  sessaoExpirada(): Observable<never> {
    this.limpar();
    void this.router.navigateByUrl('/entrar');
    return throwError(() => new Error('Sessão expirada.'));
  }

  sair(): void {
    this.http
      .post(`${this.base}/api/auth/staff/logout`, null, {
        headers: CABECALHO_CSRF,
        withCredentials: true,
      })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.limpar();
        void this.router.navigateByUrl('/entrar');
      });
  }

  private iniciar(sessao: Sessao): Observable<Perfil> {
    this.token.set(sessao.accessToken);
    return this.carregarPerfil();
  }

  private carregarPerfil(): Observable<Perfil> {
    return this.api
      .get('/api/me')
      .pipe(tap((perfil: Resposta<'/api/me', 'get'>) => this.dadosDoPerfil.set(perfil)));
  }

  private limpar(): void {
    this.token.set(null);
    this.dadosDoPerfil.set(null);
  }
}
