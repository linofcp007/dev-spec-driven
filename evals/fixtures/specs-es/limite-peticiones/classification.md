# Clasificación: limite-peticiones

## Modo
Spec

## Tracks Activos
core +saas

## Señales
- **+saas:** multi-inquilino y ruta crítica — cada petición a la API pasa por el limitador.

## Radio de Impacto
Todos los inquilinos: un límite mal calculado bloquea clientes legítimos o deja pasar abusos. Recuperable desactivando el limitador por configuración en minutos.

## ¿Ruta Crítica?
Sí — load-test.md es obligatorio.

## Proyección de Volumen / Coste
- Lanzamiento / 6m / 2a: 200 / 1.500 / 6.000 peticiones por segundo; menos de 40 USD al mes de Redis.

## Etiquetas de Cumplimiento
ninguna

## Resumen
Limitar las peticiones a la API por inquilino, según su plan.
