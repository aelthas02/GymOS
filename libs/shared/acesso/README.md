# @gymos/shared-acesso

Regras de acesso puras (T23a, ADR-016 e ADR-018), usadas pela API (`apps/api/src/modules/acesso`) e pelo
agente da catraca (`apps/turnstile-agent`, T24a). Sem Angular, sem Nest, sem banco e sem relógio.

- **Regras em cadeia** (`avaliarAcesso`): contrato, atraso, horário, modalidade, anti-passback, limite
  diário e acessos por semana. A primeira negação encerra; a tolerância só vale se nenhuma regra negar.
  Saída nunca é barrada. O `diasDeAtraso` do pedido vem sempre da Cobrança (ADR-018): com "bloquear
  após N dias", nega com `≥ N − 1` e libera na tolerância de 1 a `N − 2`.
- **QR de check-in** (`emitirQr`, `verificarQr`, `validarQrOffline`): token `gq1.<kid>.<payload>.<assinatura>`,
  Ed25519, 60 s de validade, nonce de uso único. O agente confere a assinatura offline só com a chave
  pública e guarda os nonces usados (`NoncesEmMemoria`) até sincronizar.
- **Acessos offline** (`consolidarAcessosOffline`): cada `idDeOrigem` uma vez, na ordem do horário de origem.
- Tempo em São Paulo (`tempo.ts`): dia, minuto do dia e semana de segunda a domingo.
