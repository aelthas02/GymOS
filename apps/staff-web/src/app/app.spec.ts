import { render } from '@testing-library/angular';
import { App } from './app';
import { appConfig } from './app.config';

describe('App (staff-web)', () => {
  it('renderiza o banner de ambiente e a saída do roteador, sem conteúdo de exemplo', async () => {
    const { container } = await render(App, { providers: appConfig.providers });

    expect(container.querySelector('router-outlet')).not.toBeNull();
    expect(container.querySelector('gymos-environment-banner')?.textContent?.trim()).toBe('DEV');
    expect(container.textContent?.trim()).toBe('DEV');
  });
});
