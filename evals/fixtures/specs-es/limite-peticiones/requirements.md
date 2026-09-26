# Función: limite-peticiones

## Resumen
Limitar las peticiones a la API por inquilino según su plan, para que un inquilino ruidoso no degrade a los demás.

## Historias de Usuario (priorizadas — cada una testeable de forma independiente)

### US-1 (P1 — MVP): Límite por inquilino
**Como** operador de la plataforma, **quiero** limitar las peticiones por inquilino, **para que** un inquilino ruidoso no degrade a los demás.
**Por qué P1:** sin límite, un solo inquilino puede tumbar la API para todos.
**Prueba Independiente:** Puede testearse por completo enviando 61 peticiones en un minuto con un inquilino del plan gratuito y comprobando que la número 61 recibe 429.

#### Criterios de Aceptación (EARS)
1. **US-1.AC-1** — CUANDO un inquilino supera el límite por minuto de su plan EL SISTEMA DEBE responder 429 con la cabecera `Retry-After`.
2. **US-1.AC-2** — MIENTRAS un inquilino está por debajo de su límite, CUANDO envía una petición EL SISTEMA DEBE procesarla sin rechazarla.

#### [SaaS] Criterios de Aceptación (EARS)
3. **US-1.AC-3** — CUANDO un inquilino A consume su cuota, EL SISTEMA NO DEBE reducir la cuota disponible de ningún otro inquilino.
4. **US-1.AC-4** — EL SISTEMA DEBE decidir si limita una petición en menos de 5 ms en P95.

## Criterios de Éxito (medibles, agnósticos a la tecnología)
- **SC-001** — Ningún inquilino por debajo de su límite recibe un 429 durante un pico de otro inquilino.

## Casos Límite y Manejo de Errores
- **EC-1** — El almacén de contadores no responde: se deja pasar la petición y se emite una alerta.

## Requisitos No Funcionales
- **NFR-1** — La decisión de limitar añade menos de 5 ms en P95.

## Fuera de Alcance
- Límites por usuario final o por IP.

## Supuestos
- Los límites por plan son 60 peticiones por minuto en el gratuito y 600 en el pro.
