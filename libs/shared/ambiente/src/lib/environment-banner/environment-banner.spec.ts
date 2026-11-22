import { render, screen } from '@testing-library/angular';
import type { AppEnvironment } from '../app-environment';
import { EnvironmentBanner } from './environment-banner';

function environment(overrides: Partial<AppEnvironment>): AppEnvironment {
  return { name: 'development', production: false, sentryDsn: '', ...overrides };
}

async function renderBanner(env: AppEnvironment) {
  return render(EnvironmentBanner, { inputs: { environment: env } });
}

describe('EnvironmentBanner', () => {
  it('renderiza "STAGING" com environment.name = "staging"', async () => {
    await renderBanner(environment({ name: 'staging' }));

    expect(screen.getByText('STAGING')).toBeTruthy();
  });

  it('renderiza "DEV" em desenvolvimento', async () => {
    await renderBanner(environment({ name: 'development' }));

    expect(screen.getByText('DEV')).toBeTruthy();
  });

  it('não renderiza nada com production = true', async () => {
    const { container } = await renderBanner(environment({ name: 'production', production: true }));

    expect(container.textContent?.trim()).toBe('');
    expect(container.querySelector('[data-environment]')).toBeNull();
  });

  it('não renderiza com production = true mesmo que o nome diga outra coisa', async () => {
    const { container } = await renderBanner(environment({ name: 'staging', production: true }));

    expect(container.textContent?.trim()).toBe('');
  });

  it('informa o ambiente por extenso para leitores de tela', async () => {
    await renderBanner(environment({ name: 'staging' }));

    expect(screen.getByRole('note', { name: 'Ambiente de staging' })).toBeTruthy();
  });
});
