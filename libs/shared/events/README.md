# @gymos/shared-events

Tipos versionados dos eventos de domínio (ADR-007). Produtores publicam pelo outbox da plataforma
(`PublicadorDeEventos`) e consumidores tipam o `EventoDeDominio<'Tipo'>` que recebem; o guia de uso
está no `ARCHITECTURE.md`, em "Eventos, filas, cache e tempo real".

- O dono de cada domínio ajusta o payload do seu evento no primeiro PR do domínio.
- Mudança incompatível cria uma versão nova; a anterior fica enquanto houver consumidor dela.
- Payload em JSON: datas em ISO 8601, dinheiro em centavos inteiros, ids em UUID.
- Sem Angular nem Nest: o pacote é usado pelo back e pode ser usado pelo front.
