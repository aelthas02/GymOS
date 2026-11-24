# Inconsistências entre telas

Registro das divergências encontradas entre as telas do protótipo (ou entre uma tela e uma regra de
negócio) e da decisão tomada. Mantido pelo Agente 10 (Qualidade). As demais pastas de `docs/design/`
são a referência visual copiada do protótipo e não devem ser alteradas.

Regra (ADR-019): o fixture de cada tela reproduz a própria tela; as regras de negócio não se curvam ao
fixture. Cada linha aponta a tela, o que diverge e o que foi decidido.

## Como registrar

- **Tela**: nome do arquivo em `telas/html/` (por exemplo `Alunos.html`); se envolver mais de uma, liste todas.
- **Divergência**: o que uma tela mostra e o que a outra (ou a regra) diz, com os valores exatos.
- **Decisão**: o que o seed, o fixture e a regra fazem, e quem decidiu (ticket ou PR).

## Registro

| Tela | Divergência | Decisão |
| ---- | ----------- | ------- |
| `Importar.html`, `Passo5.html` | O CPF `123.456.789-00` aparece como "Ok" (Importar, linha de CPF; Passo 5, Rafael Souza), mas o dígito verificador correto é `-09`. | O validador recusa `123.456.789-00`; fixture e seed usam um CPF válido (`123.456.789-09`) quando a regra importa, e o fixture visual pode manter o texto da tela. T08. |
| `Configuracoes.html`, `TutConfig.html` | O CNPJ de exemplo `12.345.678/0001-90` tem dígito verificador errado; o correto é `12.345.678/0001-95`. | O validador recusa `-90`; seed e testes de regra usam `12.345.678/0001-95`. T08. |
| `Alunos.html`, `AlunoPlano.html` | Pedro Almeida é "Anual" na lista de alunos e "Plano mensal" (R$ 119,00, vence 14/dez) no app do aluno. | O seed dá a Pedro o plano **Mensal**, porque o valor e o vencimento do app só fazem sentido nele; o fixture de cada tela mantém o que a tela mostra. T35. |
| `SaudeAvaliacoes.html`, `AlunoSaude.html` | A avaliação de 12/11/2026 do Pedro tem 82,4 kg nas duas telas, mas 18,2% de gordura em `SaudeAvaliacoes` e 21,3% (com variações de -0,8% e +0,6 kg de massa magra) em `AlunoSaude`. | O seed grava **18,2%**, a medida do profissional (`SaudeAvaliacoes`); o app do aluno só exibe o que a API devolve. Os fixtures mantêm os números de cada tela. T35. |
| `Equipe.html`, `FinFuncionarios.html` | Carla Menezes é **Gerente** em `Equipe.html` e **Recepção** em `FinFuncionarios.html`. | O seed e o login por papel usam **Gerente** (`Equipe` é o cadastro de quem acessa o painel; o tipo de acesso é o do cadastro). O fixture de `FinFuncionarios` mantém "Recepção". T35. |
