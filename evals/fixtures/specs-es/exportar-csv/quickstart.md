# Quickstart: exportar-csv

## Precondiciones
- Node 20 instalado.

## Pasos (camino feliz — US-1 / P1)
1. Ejecutar `node src/cli.js --csv > pedidos.csv`.
2. Abrir pedidos.csv en una hoja de cálculo.
3. **Esperado:** una fila por pedido bajo la cabecera, el cliente "Bruno, Lda" en una sola celda (SC-001).

## Camino negativo
1. Vaciar la lista de pedidos y exportar de nuevo.
2. **Esperado:** solo la cabecera.

## Terminado cuando
- [ ] El camino feliz produce el resultado esperado.
- [ ] El camino negativo se maneja correctamente.
- [ ] Los Criterios de Éxito (SC-001) se cumplen de forma observable.
