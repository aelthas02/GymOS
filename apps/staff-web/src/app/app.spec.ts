import { signal } from '@angular/core';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { App } from './app';
import { appConfig } from './app.config';
import { TenantStore } from './core/tenant/tenant.store';

describe('App (staff-web)', () => {
  it('renderiza o banner de ambiente e a saída do roteador, sem conteúdo de exemplo', async () => {
    const tenantSemRede = { carregar: () => of(undefined), identidade: signal(null) };
    const { container } = await render(App, {
      providers: [...appConfig.providers, { provide: TenantStore, useValue: tenantSemRede }],
    });

    expect(container.querySelector('router-outlet')).not.toBeNull();
    expect(container.querySelector('gymos-environment-banner')?.textContent?.trim()).toBe('DEV');
    expect(container.textContent?.trim()).toBe('DEV');
  });
});
