# TutorialOverlay

Tutorial sobre a própria tela, aberto pelo botão "?" do `PageHeader`. Fidelidade visual: `TutAlunos`
e as outras `Tut*.html`. A configuração de cada tela fica com o dono da tela (T27).

## Como usar

1. Marque os blocos reais da tela com `data-tutorial="<id>"` (id estável, só letras, números e `-`):

   ```html
   <section data-tutorial="lista">…</section>
   ```

2. Escreva a configuração da tela (constante em `features/<f>/utils/` ou na própria página). O
   `numero` e o `texto` são os da `Tut*.html` da tela:

   ```ts
   import type { ConfiguracaoDeTutorial } from '@gymos/ui';

   export const TUTORIAL_ALUNOS: ConfiguracaoDeTutorial = {
     passos: [
       { alvo: 'cabecalho', numero: 1, texto: 'Cadastre um aluno novo' },
       { alvo: 'lista', numero: 2, texto: 'Situação e plano de cada aluno' },
     ],
   };
   ```

3. Ligue ao cabeçalho na página:

   ```html
   <ui-page-header heading="Alunos" (helpClick)="tutorial.set(true)" />
   <!-- … -->
   <ui-tutorial-overlay [config]="tutorialAlunos" [(open)]="tutorial" />
   ```

## Contrato

| Campo             | Tipo     | Regra                                                                  |
| ----------------- | -------- | ---------------------------------------------------------------------- |
| `passos[].alvo`   | `string` | valor do atributo `data-tutorial` do bloco (nunca seletor CSS)         |
| `passos[].numero` | `number` | número exibido; vale o da configuração, mesmo que um passo seja pulado |
| `passos[].texto`  | `string` | etiqueta curta, uma linha                                              |

- A ordem do array é a ordem de leitura por leitor de tela (lista `<ol>`).
- Passo cujo alvo não existe ou não está visível (módulo desligado, sem permissão) é ignorado; os
  demais mantêm seus números.
- O contorno usa o raio do bloco (18px se o bloco não tiver raio) e acompanha rolagem e
  redimensionamento.
- Esc ou clique fora fecham e devolvem o foco ao elemento que estava focado ao abrir (o "?"); o foco
  abre na primeira etiqueta e o Tab circula só entre as etiquetas.
- Respeita `prefers-reduced-motion` (sem animação de entrada).
- Cor do contorno: token `--tutorial` (`#F57C00`).
