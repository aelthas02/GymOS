# GymOS: pacote de design para o Traycer

Telas do protótipo, exatamente como aprovadas. Coloque esta pasta no repositório (sugestão: `docs/design/`) para o Traycer e os agentes lerem.

## Conteúdo
- `INDEX.md`: lista de todas as telas, com arquivo, rota sugerida e tamanho.
- `telas/html/`: uma página HTML por tela, **autônoma** (cor de destaque já resolvida). É a **fonte de verdade de estilos e estrutura**: espaçamentos, raios, cores, tipografia, hierarquia.
- `telas/png/`: captura de cada tela (painel 1280 px de largura; app do aluno 390×844 em 2x). Use para conferência e regressão visual.
- `tokens/design-tokens.json` e `tokens/tokens.css`: cores, fonte, raios e medidas extraídos das telas.

## Como usar com o Traycer
1. Copie a pasta para o repositório e abra o repositório no Traycer.
2. Cole o prompt (`prompt_traycer_gymos.md`) e diga: "As telas de referência estão em `docs/design/`. Implemente cada tela de `INDEX.md` fielmente a partir do HTML e do PNG."
3. Confira o plano antes de liberar a execução.

## Observações
- Os dados são fictícios (Academia Ritmo, Paulo Reis, Pedro Almeida etc.).
- As telas `Tut*` são a tela do próprio módulo com contornos laranja numerados; implemente como um componente de tutorial sobreposto, não como telas novas.
- Cada módulo extra (Aulas, Marketing, Loja, Saúde) tem uma aba "Configurações".
- No HTML a cor `#22C98A` é a cor de destaque **padrão**; na aplicação ela vem da configuração da academia.
- As telas usam a fonte Inter (Google Fonts); na aplicação, hospede a fonte localmente.
