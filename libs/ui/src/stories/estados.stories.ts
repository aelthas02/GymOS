import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '../lib/button/button';
import { EmptyState } from '../lib/states/empty-state';
import { ErrorState } from '../lib/states/error-state';
import { NoPermissionState } from '../lib/states/no-permission-state';
import { Skeleton } from '../lib/states/skeleton';

const meta: Meta = {
  title: 'Componentes/Estados',
  parameters: { layout: 'padded' },
  decorators: [
    moduleMetadata({ imports: [EmptyState, ErrorState, NoPermissionState, Skeleton, Button] }),
  ],
};

export default meta;

type Story = StoryObj;

const quadro = 'display:flex;flex-direction:column;gap:20px;max-width:560px';

/** "Lista vazia" e "Busca sem resultado" de Estados.html. */
export const Vazio: Story = {
  render: () => ({
    template: `<div style="${quadro}">
      <ui-empty-state
        [icon]="true"
        heading="Nenhum aluno cadastrado ainda"
        description="Cadastre o primeiro aluno ou traga todos de uma vez por planilha."
      >
        <ng-container actions>
          <ui-button variant="accent">Cadastrar aluno</ui-button>
          <ui-button variant="outline">Importar planilha</ui-button>
        </ng-container>
      </ui-empty-state>
      <ui-empty-state
        heading='Nada encontrado para "Marcelo Dias"'
        description="Confira a grafia, tente o CPF ou o telefone, ou limpe os filtros."
      >
        <ui-button actions variant="outline">Limpar filtros</ui-button>
      </ui-empty-state>
    </div>`,
  }),
};

/** "Catraca offline" (vermelho) e "Erro ao salvar" (amarelo). */
export const Erro: Story = {
  render: () => ({
    template: `<div style="${quadro}">
      <ui-error-state
        tone="error"
        [retryable]="false"
        heading="Catraca sem conexão desde 08h12"
        description="Os alunos continuam entrando pelo QR. O agente local guarda os acessos e envia tudo quando a conexão voltar."
      >
        <ng-container actions>
          <ui-button variant="outline">Testar conexão</ui-button>
          <ui-button variant="outline">Ver detalhes</ui-button>
        </ng-container>
      </ui-error-state>
      <ui-error-state
        tone="warn"
        heading="Não foi possível salvar o plano"
        description="Você está sem internet. Suas alterações continuam na tela. Tentamos de novo assim que a conexão voltar."
      />
      <ui-error-state
        tone="warn"
        [retrying]="true"
        heading="Não foi possível salvar o plano"
        description="Tentando de novo."
      />
    </div>`,
  }),
};

export const SemPermissao: Story = {
  name: 'Sem permissão',
  render: () => ({
    template: `<div style="${quadro}"><ui-no-permission-state /></div>`,
  }),
};

export const Carregando: Story = {
  render: () => ({
    template: `<div style="${quadro}" aria-busy="true">
      @for (linha of [1, 2, 3]; track linha) {
        <div style="display:flex;align-items:center;gap:12px">
          <ui-skeleton shape="circle" height="36px" />
          <div style="flex:1;display:flex;flex-direction:column;gap:6px">
            <ui-skeleton width="40%" height="14px" />
            <ui-skeleton width="25%" height="12px" />
          </div>
        </div>
      }
    </div>`,
  }),
};
