import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..', '..', '..');
const script = join(raiz, 'tools', 'deploy', 'deploy.sh');
// No Windows, `bash` do PATH costuma ser o do WSL (System32); usa o Git Bash.
const bash =
  process.platform === 'win32'
    ? (process.env['GYMOS_BASH'] ?? 'C:\\Program Files\\Git\\bin\\bash.exe')
    : 'bash';

function deploy(args: string[], env: Record<string, string> = {}) {
  const r = spawnSync(bash, [script, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env['PATH'] ?? '', ...env },
  });
  return { status: r.status, saida: `${r.stdout}${r.stderr}` };
}

describe('tools/deploy/deploy.sh', () => {
  it('sem DEPLOY_PROVEDOR o deploy fica desabilitado e termina com sucesso', () => {
    const r = deploy(['staging', 'v1.2.3']);

    expect(r.status).toBe(0);
    expect(r.saida).toMatch(/desabilitado/);
  });

  it.each([[[]], [['staging']], [['homolog', 'v1.0.0']], [['production', 'latest']]])(
    'rejeita argumentos inválidos %j',
    (args) => {
      expect(deploy(args as string[]).status).toBe(2);
    },
  );

  it('delega ao script do provedor com ambiente e tag', () => {
    const dir = mkdtempSync(join(tmpdir(), 'provedores-'));
    try {
      const provedor = join(dir, 'fake.sh');
      writeFileSync(provedor, '#!/usr/bin/env bash\necho "chamado:$1:$2"\n');
      chmodSync(provedor, 0o755);

      const r = deploy(['production', 'v2.0.1'], {
        DEPLOY_PROVEDOR: 'fake',
        DEPLOY_PROVEDORES_DIR: dir,
      });

      expect(r.status).toBe(0);
      expect(r.saida).toContain('chamado:production:v2.0.1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falha quando o provedor configurado não tem script', () => {
    const r = deploy(['staging', 'v1.0.0'], { DEPLOY_PROVEDOR: 'inexistente' });

    expect(r.status).toBe(1);
  });
});
