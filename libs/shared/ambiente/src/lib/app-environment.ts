export type EnvironmentName = 'development' | 'staging' | 'production';

/** Forma dos arquivos `environment.*.ts` dos apps; cada build troca o arquivo (fileReplacements). */
export interface AppEnvironment {
  readonly name: EnvironmentName;
  readonly production: boolean;
  /** DSN pública do projeto no Sentry; vazia desliga o Sentry. */
  readonly sentryDsn: string;
}
