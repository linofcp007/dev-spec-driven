<!-- As linhas de teste planeadas de uma feature +mobile em português (só numa feature +tdd) — as seis células do plano
     incorporado; cada Test ID é renumerado depois dos do plano, sob "## [MOBILE] Matriz de Rastreabilidade". -->
| Test ID | Camada | Tipo | Descrição | Cobre (AC IDs) | Ficheiro |
|---|---|---|---|---|---|
| T-00 | e2e | example | modo de avião: as ações principais continuam disponíveis e as alterações em fila sincronizam ao reconectar | {{ac1}} | `tests/e2e/offline.spec.ts` |
| T-00 | integração | property | dois dispositivos editam o mesmo registo offline: a sincronização aplica a regra de conflito e não perde nada | {{ac2}} | `tests/integration/sync-conflicts.test.ts` |
| T-00 | e2e | example | uma app abaixo da versão mínima fica bloqueada com o pedido de atualização | {{ac3}} | `tests/e2e/min-version.spec.ts` |
| T-00 | e2e | example | cada permissão recusada e depois revogada: a funcionalidade explica-o e continua a funcionar | {{ac4}} | `tests/e2e/permissions.spec.ts` |
| T-00 | integração | example | a notificação push abre o ecrã de destino e não contém dados pessoais | {{ac5}} | `tests/integration/push.test.ts` |
