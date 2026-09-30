<!-- Las filas de prueba planificadas de una función +mobile en español (solo en una función +tdd) — las seis celdas del plan
     incorporado; cada Test ID se renumera después de los del plan, bajo "## [MOBILE] Matriz de Trazabilidad". -->
| Test ID | Capa | Tipo | Descripción | Cubre (AC IDs) | Archivo |
|---|---|---|---|---|---|
| T-00 | e2e | example | modo avión: las acciones principales siguen disponibles y los cambios encolados se sincronizan al reconectar | {{ac1}} | `tests/e2e/offline.spec.ts` |
| T-00 | integración | property | dos dispositivos editan el mismo registro sin conexión: la sincronización aplica la regla de conflicto y no pierde nada | {{ac2}} | `tests/integration/sync-conflicts.test.ts` |
| T-00 | e2e | example | una app por debajo de la versión mínima queda bloqueada con el aviso de actualización | {{ac3}} | `tests/e2e/min-version.spec.ts` |
| T-00 | e2e | example | cada permiso denegado y luego revocado: la función lo explica y sigue funcionando | {{ac4}} | `tests/e2e/permissions.spec.ts` |
| T-00 | integración | example | la notificación push abre la pantalla de destino y no contiene datos personales | {{ac5}} | `tests/integration/push.test.ts` |
