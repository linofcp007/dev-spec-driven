# Estándares Móviles

## Plataformas
- Versiones mínimas: iOS [16] · Android [API 26] · el framework: [nativo | React Native | Flutter] · los dispositivos en los que probamos: [lista].

## Lanzamientos
- Tiempo de revisión de las tiendas: [N días] · despliegue escalonado: [1% → 10% → 50% → 100%] con criterios de parada (sesiones sin fallos por debajo de [99,5%]).
- Actualización obligatoria cuando: [un cambio incompatible de la API] · la versión más antigua de la app que la API aún sirve: [versión].

## Sin Conexión y Sincronización
- Qué debe funcionar sin conexión: [lista] · regla de conflicto: [gana la última escritura | fusión | preguntar al usuario] · la cola sobrevive a un reinicio de la app.

## Permisos
- Se piden en contexto, nunca al arrancar · primero una pantalla con la justificación · cada función tiene un camino para un permiso denegado.

## Rendimiento y Batería
- Arranque en frío ≤ [2 s] en [un dispositivo de gama baja] · tamaño de la app ≤ [N MB] · trabajo en segundo plano como máximo cada [N minutos].

## Notificaciones Push
- Sin datos personales en la pantalla de bloqueo · cada notificación abre un enlace profundo · como máximo [N] por usuario al día · una opción de baja por categoría.
