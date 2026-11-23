// Convenção de tabela do GymOS (ADR-003): toda tabela do schema public, fora as da lista abaixo, tem
// tenant_id uuid NOT NULL, um índice que começa por tenant_id, RLS ligado e forçado, a política de
// isolamento por app.tenant_id e DML concedido ao gymos_app. Políticas permissivas extras para o
// público ou para o gymos_app são proibidas: abririam o isolamento.

export const TABELAS_FORA_DA_CONVENCAO: readonly string[] = ['tenant', '_prisma_migrations'];

export const EXPRESSAO_DA_POLITICA =
  "tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid";

export type RegraDaConvencao =
  | 'tabela'
  | 'tenant_id'
  | 'indice'
  | 'rls'
  | 'force'
  | 'politica'
  | 'politica-extra'
  | 'privilegios';

export interface ViolacaoDaConvencao {
  tabela: string;
  regra: RegraDaConvencao;
  mensagem: string;
}

export interface Consultavel {
  query<R extends object>(sql: string, valores?: unknown[]): Promise<{ rows: R[] }>;
}

interface LinhaDaTabela {
  tabela: string;
  rls: boolean;
  forcado: boolean;
  tenant_id: boolean;
  indice: boolean;
  privilegios: boolean;
}

interface LinhaDaPolitica {
  tabela: string;
  permissiva: boolean;
  papeis: string[];
  comando: string;
  usando: string | null;
  verificando: string | null;
}

/** Ignora espaços, parênteses, caixa e os casts ::text que o Postgres acrescenta ao exibir. */
export function normalizarExpressao(expressao: string | null): string {
  return (expressao ?? '')
    .replace(/::text/g, '')
    .replace(/[\s()]/g, '')
    .toLowerCase();
}

const ESPERADA = normalizarExpressao(EXPRESSAO_DA_POLITICA);

const CONSULTA_DAS_TABELAS = `
  SELECT c.relname AS tabela,
         c.relrowsecurity AS rls,
         c.relforcerowsecurity AS forcado,
         EXISTS (
           SELECT 1 FROM pg_attribute a
           WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
             AND a.attnotnull AND a.atttypid = 'uuid'::regtype
         ) AS tenant_id,
         EXISTS (
           SELECT 1 FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
           WHERE i.indrelid = c.oid AND a.attname = 'tenant_id'
         ) AS indice,
         (has_table_privilege($2, c.oid, 'SELECT') AND has_table_privilege($2, c.oid, 'INSERT')
           AND has_table_privilege($2, c.oid, 'UPDATE')
           AND has_table_privilege($2, c.oid, 'DELETE')) AS privilegios
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname <> ALL($1::text[])
  ORDER BY c.relname`;

const CONSULTA_DAS_POLITICAS = `
  SELECT tablename AS tabela, permissive = 'PERMISSIVE' AS permissiva, roles::text[] AS papeis,
         cmd AS comando, qual AS usando, with_check AS verificando
  FROM pg_policies WHERE schemaname = 'public'`;

export async function verificarConvencaoDeRls(
  banco: Consultavel,
  opcoes: { tabelas?: string[]; papelDaApp?: string } = {},
): Promise<ViolacaoDaConvencao[]> {
  const papelDaApp = opcoes.papelDaApp ?? 'gymos_app';
  const { rows: tabelas } = await banco.query<LinhaDaTabela>(CONSULTA_DAS_TABELAS, [
    TABELAS_FORA_DA_CONVENCAO,
    papelDaApp,
  ]);
  const { rows: politicas } = await banco.query<LinhaDaPolitica>(CONSULTA_DAS_POLITICAS);
  const violacoes: ViolacaoDaConvencao[] = [];

  // Pedir uma tabela que não existe (migração esquecida) não pode passar em silêncio.
  for (const tabela of opcoes.tabelas ?? []) {
    if (!tabelas.some((linha) => linha.tabela === tabela)) {
      violacoes.push({ tabela, regra: 'tabela', mensagem: 'a tabela não existe no banco migrado' });
    }
  }

  for (const linha of tabelas) {
    if (opcoes.tabelas && !opcoes.tabelas.includes(linha.tabela)) {
      continue;
    }
    const violar = (regra: RegraDaConvencao, mensagem: string) =>
      violacoes.push({ tabela: linha.tabela, regra, mensagem });
    const daTabela = politicas.filter((politica) => politica.tabela === linha.tabela);
    const isolamento = (politica: LinhaDaPolitica) =>
      politica.permissiva &&
      politica.comando === 'ALL' &&
      politica.papeis.length === 1 &&
      politica.papeis[0] === 'public' &&
      normalizarExpressao(politica.usando) === ESPERADA &&
      normalizarExpressao(politica.verificando) === ESPERADA;
    const abreParaApp = (politica: LinhaDaPolitica) =>
      politica.permissiva &&
      politica.papeis.some((papel) => papel === 'public' || papel === papelDaApp);

    if (!linha.tenant_id) {
      violar('tenant_id', 'falta a coluna tenant_id uuid NOT NULL');
    }
    if (!linha.indice) {
      violar('indice', 'falta um índice que comece por tenant_id');
    }
    if (!linha.rls) {
      violar('rls', 'falta ENABLE ROW LEVEL SECURITY');
    }
    if (!linha.forcado) {
      violar('force', 'falta FORCE ROW LEVEL SECURITY');
    }
    if (!daTabela.some(isolamento)) {
      violar('politica', `falta a política de isolamento: ${EXPRESSAO_DA_POLITICA}`);
    }
    if (daTabela.some((politica) => abreParaApp(politica) && !isolamento(politica))) {
      violar('politica-extra', `política permissiva extra para public ou ${papelDaApp}`);
    }
    if (!linha.privilegios) {
      violar('privilegios', `${papelDaApp} precisa de SELECT, INSERT, UPDATE e DELETE`);
    }
  }
  return violacoes;
}
