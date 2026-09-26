# Función: exportar-csv

## Resumen
Exportar la lista de pedidos a CSV desde la línea de comandos, para abrirla sin problemas en una hoja de cálculo.

## Historias de Usuario (priorizadas — cada una testeable de forma independiente)

### US-1 (P1 — MVP): Exportar los pedidos a CSV
**Como** responsable de la tienda, **quiero** exportar la lista de pedidos a CSV, **para que** el contable la abra en una hoja de cálculo.
**Por qué P1:** la exportación es toda la función.
**Prueba Independiente:** Puede testearse por completo ejecutando `node src/cli.js --csv` y abriendo la salida en una hoja de cálculo.

#### Criterios de Aceptación (EARS)
1. **US-1.AC-1** — CUANDO el usuario ejecuta la CLI con `--csv` EL SISTEMA DEBE imprimir la cabecera `id,date,customer,total` seguida de una línea por pedido.
2. **US-1.AC-2** — SI un campo contiene una coma o una comilla doble ENTONCES EL SISTEMA DEBE envolver el campo entre comillas dobles y duplicar cada comilla interior.

## Criterios de Éxito (medibles, agnósticos a la tecnología)
- **SC-001** — Una exportación de todos los pedidos se abre en una hoja de cálculo con una fila por pedido más la cabecera, sin columnas desplazadas.

## Casos Límite y Manejo de Errores
- **EC-1** — Sin pedidos: solo se imprime la cabecera.

## Requisitos No Funcionales
- **NFR-1** — Exportar 10.000 pedidos tarda menos de un segundo en un portátil.

## Fuera de Alcance
- Ficheros de Excel y selección de columnas.

## Supuestos
- Todos los pedidos caben en memoria.
