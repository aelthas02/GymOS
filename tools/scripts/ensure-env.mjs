import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const env = resolve(root, '.env');

if (!existsSync(env)) {
  copyFileSync(resolve(root, '.env.example'), env);
  console.log('.env criado a partir do .env.example (valores do docker-compose de dev).');
}
