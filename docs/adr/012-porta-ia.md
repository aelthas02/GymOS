# ADR-012: Porta para IA (fichas de treino e legendas), com adapter fake

- Status: Proposto
- Data: 2026-11-21
- Ticket: T01 (registro); porta e fake no T13d

## Contexto

As telas mostram ficha de treino gerada por IA e legenda de publicação sugerida, sempre com aprovação
humana. O provedor ainda não foi escolhido.

## Decisão

Porta `GeradorIA` com adapter **fake determinístico** para dev e testes. Todo conteúdo gerado nasce
"Aguardando aprovação" e só chega ao aluno depois de aprovado.

## Premissa

Aprovação humana obrigatória em toda saída de IA, como nas telas.

**Quando decidir:** fase 2 do Agente 7.

## Alternativas consideradas

- **Publicar a saída da IA direto**: contraria as telas e expõe o aluno a ficha sem revisão.

## Consequências

- O provedor pode mudar sem tocar nos domínios de Treinos e Marketing.
