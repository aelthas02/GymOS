import { render } from '@testing-library/angular';
import { App } from './app';
import { appConfig } from './app.config';

describe('App (staff-web)', () => {
  it('renderiza o componente raiz com a saída do roteador e sem conteúdo de exemplo', async () => {
    const { container } = await render(App, { providers: appConfig.providers });

    expect(container.querySelector('router-outlet')).not.toBeNull();
    expect(container.textContent?.trim()).toBe('');
  });
});
