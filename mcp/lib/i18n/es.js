"use strict";

/**
 * dev-spec-driven i18n — Spanish (es).
 *
 * Every table's es block: the artifact builders (BUILD), the steering stubs, the evals README, the tool messages (MSG
 * with its quality / designWeigh groups) and the task-brief labels. mcp/lib/i18n.js assembles the tables and is what the
 * engine requires. Blocks keep the indentation they had inside i18n.js's tables.
 */
const { DEV_SPEC, MARKER_TRACK_ORDER, greenLine, signalTracks, templateTestRows, templateTests, coreSuperseded } = require("./common.js"); // load time
// The assembled tables — call-time use only; mcp/lib/i18n.js links them once every language has loaded.
let BUILD, MSG;
function __link(T) { ({ BUILD, MSG } = T); }

// ===========================================================================
// Artifact builders, one set per language. EN is the canonical reference; since 1.13 its templates are
// internally consistent (every template AC planned and tasked) — the gates would otherwise flag the scaffold.
// ===========================================================================
const build = {
    classification(a) {
      const sig = a.signals || { tdd: [], saas: [], ai: [] };
      const sigLine = (t) =>
        a.tracks.includes(t)
          ? `- **+${t}:** ${[...new Set(sig[t] || [])].slice(0, 6).join(", ") || "[señal]"} — [por qué se aplica]`
          : null;
      const signalLines = signalTracks(a.tracks).map(sigLine).filter(Boolean).join("\n") || "- ninguno además de core";
      return (
`# Clasificación: ${a.name}

## Modo
Spec

## Tracks Activos
${a.label}

## Señales
${signalLines}

## Radio de Impacto
[¿Qué se rompe si esto está mal? ¿A quién afecta? ¿Recuperable? ¿En cuánto tiempo?]
${a.tracks.includes("saas") ? "\n## ¿Ruta Crítica?\n[Sí/No — si sí, load-test.md es obligatorio.]\n" : ""}${a.tracks.includes("ai") ? "\n## Nivel de Autonomía\n[Consultivo | Semi-autónomo | Autónomo]\n" : ""}${a.tracks.includes("saas") || a.tracks.includes("ai") ? "\n## Proyección de Volumen / Coste\n- Lanzamiento / 6m / 2a: [carga, ~$/mes]\n" : ""}
## Etiquetas de Cumplimiento
[GDPR | PCI | HIPAA | SOC2 | ninguna]

${a.summary ? "## Resumen\n" + a.summary + "\n" : ""}`
      );
    },

    requirements(a) {
      const saasAc = a.tracks.includes("saas")
        ? "\n\n#### [SaaS] Criterios de Aceptación (EARS)\n5. **US-1.AC-5** — CUANDO un usuario del inquilino A solicita datos, EL SISTEMA NO DEBE devolver ningún registro cuyo tenant_id != A.\n6. **US-1.AC-6** — EL SISTEMA DEBE responder en [N]ms en P95."
        : "";
      const aiAc = a.tracks.includes("ai")
        ? "\n\n#### [AI] Criterios de Aceptación (EARS)\n7. **US-1.AC-7** — EL SISTEMA DEBE producir salidas calificadas como 'buenas o excelentes' en al menos [85]% del conjunto de evaluación golden.\n8. **US-1.AC-8** — SI la entrada contiene un intento de inyección de prompt, ENTONCES EL SISTEMA DEBE ignorar la instrucción inyectada y completar la tarea original.\n9. **US-1.AC-9** — EL SISTEMA DEBE costar como máximo $[0.03] por solicitud de usuario en tamaño P95."
        : "";
      const secAc = a.tracks.includes("sec")
        ? "\n\n#### [SEC] Criterios de Aceptación (EARS)\n10. **US-1.AC-10** — SI una solicitud no autenticada llega a un endpoint protegido, ENTONCES EL SISTEMA DEBE rechazarla con 401 y no devolver datos protegidos.\n11. **US-1.AC-11** — SI un usuario autenticado solicita un recurso al que no tiene autorización de acceso, ENTONCES EL SISTEMA DEBE denegarlo con 403 y registrar un evento de auditoría de seguridad.\n12. **US-1.AC-12** — EL SISTEMA NO DEBE incluir secretos, credenciales, tokens de sesión ni stack traces en ninguna respuesta ni entrada de log."
        : "";
      const privacyAc = a.tracks.includes("privacy")
        ? "\n\n#### [PRIVACY] Criterios de Aceptación (EARS)\n13. **US-1.AC-13** — CUANDO un interesado solicita una copia de sus datos personales, EL SISTEMA DEBE exportarlos en un formato estructurado y de lectura mecánica en el plazo de un mes.\n14. **US-1.AC-14** — CUANDO se acepta la solicitud de supresión de un interesado, EL SISTEMA DEBE eliminar o anonimizar de forma irreversible sus datos personales en todos los almacenes en el plazo de un mes.\n15. **US-1.AC-15** — CUANDO vence el plazo de conservación de un registro, EL SISTEMA DEBE eliminarlo o anonimizarlo."
        : "";
      const distAc = a.tracks.includes("dist")
        ? "\n\n#### [DIST] Criterios de Aceptación (EARS)\n16. **US-1.AC-16** — SI la publicación [del evento] falla después del commit de la transacción en la base de datos, ENTONCES EL SISTEMA DEBE entregarlo más tarde, al menos una vez, sin perderlo (outbox transaccional).\n17. **US-1.AC-17** — CUANDO el mismo mensaje se entregue más de una vez, EL SISTEMA DEBE aplicar su efecto exactamente una vez (consumidor idempotente).\n18. **US-1.AC-18** — CUANDO dos solicitudes actualicen la misma [entidad] de forma concurrente, EL SISTEMA NO DEBE perder ninguna de las actualizaciones (bloqueo optimista o una restricción de unicidad).\n19. **US-1.AC-19** — SI [la dependencia] no está disponible, ENTONCES EL SISTEMA DEBE [degradarse / reintentar con retroceso exponencial y jitter] y NO DEBE bloquear [la ruta crítica]."
        : "";
      const apiAc = a.tracks.includes("api")
        ? "\n\n#### [API] Criterios de Aceptación (EARS)\n20. **US-1.AC-20** — SI una petición omite [un campo obligatorio] o lo envía mal formado, ENTONCES EL SISTEMA DEBE responder 400 con un cuerpo application/problem+json que nombra el campo y lleva un código de error estable.\n21. **US-1.AC-21** — CUANDO un cliente repite [una petición de creación] con la misma Idempotency-Key y el mismo cuerpo, EL SISTEMA DEBE devolver la primera respuesta sin aplicar el efecto otra vez.\n22. **US-1.AC-22** — SI una actualización trae un ETag If-Match que ya no coincide con el recurso, ENTONCES EL SISTEMA DEBE responder 412 y dejar el recurso sin cambios.\n23. **US-1.AC-23** — SI un cambio en el contrato pudiera romper un cliente existente, ENTONCES EL SISTEMA DEBE publicarlo solo en una nueva [versión de la API] y mantener la versión actual en funcionamiento hasta su fecha de Sunset anunciada."
        : "";
      const uiAc = a.tracks.includes("ui")
        ? "\n\n#### [UI] Criterios de Aceptación (EARS)\n24. **US-1.AC-24** — CUANDO un usuario maneja [la vista] solo con el teclado, EL SISTEMA DEBE hacer cada acción alcanzable y operable en un orden de foco lógico, con un indicador de foco visible.\n25. **US-1.AC-25** — SI un formulario enviado tiene campos no válidos, ENTONCES EL SISTEMA DEBE conservar todos los valores introducidos, identificar cada error en texto junto a su campo y mover el foco a un resumen de errores.\n26. **US-1.AC-26** — MIENTRAS [la lista] no tenga elementos, EL SISTEMA DEBE mostrar un estado vacío que explica por qué y ofrece la siguiente acción.\n27. **US-1.AC-27** — SI la carga [de los datos] falla, ENTONCES EL SISTEMA DEBE mostrar un mensaje de error con una acción Reintentar y conservar el contenido ya mostrado."
        : "";
      const obsAc = a.tracks.includes("obs")
        ? "\n\n#### [OBS] Criterios de Aceptación (EARS)\n28. **US-1.AC-28** — EL SISTEMA DEBE emitir [la métrica de la petición] con la latencia, el resultado y un ID de correlación para cada [petición], y registrar cada error con ese ID de correlación y sin datos personales.\n29. **US-1.AC-29** — CUANDO la tasa de consumo del presupuesto de errores [del SLO] supere [14,4]× durante [una hora], EL SISTEMA DEBE avisar a la persona de guardia (on-call) con un enlace al runbook.\n30. **US-1.AC-30** — SI la tasa de error del canario supera [la referencia] en [N] puntos porcentuales, ENTONCES EL SISTEMA DEBE detener el despliegue y revertir automáticamente a la versión anterior.\n31. **US-1.AC-31** — MIENTRAS [una dependencia] no esté disponible, EL SISTEMA DEBE indicar que no está listo (comprobación de disponibilidad) sin dejar de estar vivo, y recuperarse sin reinicio cuando vuelva."
        : "";
      const dataAc = a.tracks.includes("data") // +data (1.21 F4)
        ? "\n\n#### [DATA] Criterios de Aceptación (EARS)\n32. **US-1.AC-32** — CUANDO un lote contenga una fila que incumpla [una regla de calidad de datos], EL SISTEMA DEBE poner esa fila en cuarentena con la regla que incumplió y NO DEBE cargarla en [la tabla de destino].\n33. **US-1.AC-33** — SI el job se vuelve a ejecutar para una partición ya cargada, ENTONCES EL SISTEMA DEBE producir el mismo resultado que una sola ejecución, sin filas duplicadas ni ausentes (una reejecución y un backfill idempotentes).\n34. **US-1.AC-34** — SI los datos más recientes de [la tabla] son más antiguos que [su SLA de frescura], ENTONCES EL SISTEMA DEBE avisar a [la persona responsable] y marcar la tabla como desactualizada para sus consumidores.\n35. **US-1.AC-35** — CUANDO cambie el esquema de [el origen], EL SISTEMA DEBE aceptar un cambio aditivo y retrocompatible y DEBE rechazar un cambio incompatible (una columna eliminada o renombrada, un tipo más restringido) antes de que ninguna fila llegue a [los consumidores]."
        : "";
      // 1.21 F5 — tamaño S (el EN es la referencia): una historia, dos criterios core (CUANDO · SI…ENTONCES), todos los de los tracks.
      if (a.size === "s") {
        return (
`# Función: ${a.name}

## Resumen
${a.summary || "[1-2 frases: qué hace y por qué importa]"}

## Historia de Usuario

### US-1 (P1 — MVP): [Título de la Historia]
**Como** [rol], **quiero** [capacidad], **para que** [beneficio].
**Prueba Independiente:** Puede testearse por completo mediante [acción específica] y entrega [valor específico].

#### Criterios de Aceptación (EARS)
1. **US-1.AC-1** — CUANDO [disparador] EL SISTEMA DEBE [comportamiento]
2. **US-1.AC-2** — SI [condición de error] ENTONCES EL SISTEMA DEBE [recuperación]${saasAc}${aiAc}${secAc}${privacyAc}${distAc}${apiAc}${uiAc}${obsAc}${dataAc}

## Criterios de Éxito (medibles, agnósticos a la tecnología)
- **SC-001** — [p.ej., 90% de los usuarios completan [tarea] en menos de [N] segundos]

## Fuera de Alcance
- [Lo que esta función NO incluye]

<!-- Tamaño S: una historia. Cada AC contiene DEBE y es testeable; mantén IDs de AC estables. Marca cualquier ambigüedad
     inline con un marcador como  [NEEDS CLARIFICATION: ¿qué proveedor?] . Una segunda historia, casos límite o NFR = tamaño m. -->
`
        );
      }
      return (
`# Función: ${a.name}

## Resumen
${a.summary || "[1-2 frases: qué hace y por qué importa]"}

## Historias de Usuario (priorizadas — cada una testeable de forma independiente)

Prioridades: **P1** = crítica, un MVP viable por sí solo · **P2** = secundaria · **P3** = mejora.
Cada historia debe entregar valor autónomo si se lanza sola.

### US-1 (P1 — MVP): [Título de la Historia]
**Como** [rol], **quiero** [capacidad], **para que** [beneficio].
**Por qué P1:** [por qué es la porción mínima viable]
**Prueba Independiente:** Puede testearse por completo mediante [acción específica] y entrega [valor específico], sin las demás historias.

#### Criterios de Aceptación (EARS)
1. **US-1.AC-1** — CUANDO [disparador] EL SISTEMA DEBE [comportamiento]
2. **US-1.AC-2** — MIENTRAS [estado], CUANDO [disparador] EL SISTEMA DEBE [comportamiento]
3. **US-1.AC-3** — SI [condición de error] ENTONCES EL SISTEMA DEBE [recuperación]
4. **US-1.AC-4** — [ubicuo] EL SISTEMA DEBE [propiedad siempre verdadera]${saasAc}${aiAc}${secAc}${privacyAc}${distAc}${apiAc}${uiAc}${obsAc}${dataAc}

### US-2 (P2): [Título de la Historia]
**Como** [rol], **quiero** [capacidad], **para que** [beneficio].
**Prueba Independiente:** [cómo testear esta sola]

#### Criterios de Aceptación (EARS)
1. **US-2.AC-1** — CUANDO [disparador] EL SISTEMA DEBE [comportamiento]

## Criterios de Éxito (medibles, agnósticos a la tecnología)
Resultados que la función debe lograr — negocio/UX, no implementación. Cuantifica cada uno.
- **SC-001** — [p.ej., 90% de los usuarios completan [tarea] en menos de [N] segundos]
- **SC-002** — [p.ej., la tasa de error en [flujo] se mantiene por debajo de [N]%]

## Casos Límite y Manejo de Errores
- **EC-1** — [Escenario]: [Comportamiento esperado]

## Requisitos No Funcionales
- **NFR-1** — [restricción medible de rendimiento / seguridad / accesibilidad]

## Fuera de Alcance
- [Lo que esta función NO incluye]

## Supuestos
- [Algo asumido como verdadero que, si es falso, cambia la spec]

<!-- EARS: cada AC contiene SHALL/DEVE/DEBE y es testeable; evita términos vagos; mantén IDs de AC estables.
     Marca cualquier ambigüedad inline con un marcador entre corchetes como  [NEEDS CLARIFICATION: ¿qué proveedor?] .
     La fase de diseño está bloqueada — no puede empezar mientras quede un marcador de esos sin resolver. -->
`
      );
    },

    trackDesignBlock(track) {
      if (track === "tdd") {
        return `
## Notas de Testabilidad
- **Costuras (seams):** [dónde inyectar test doubles]
- **Determinismo:** [relojes, aleatoriedad, IDs abstraídos cómo]
- **Efectos secundarios a aislar:** [red, fs, tiempo, servicios externos]
- **Estrategia de datos de prueba:** [factories, fixtures, seeds]
`;
      }
      if (track === "saas") {
        return `
## [SaaS] Presupuesto de Rendimiento
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Objetivos de latencia P50/P95/P99 · tiempo máx. de query · memoria máx./solicitud · objetivo de throughput.

## [SaaS] Diseño de Escala
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Usuarios concurrentes (lanzamiento/6m/2a) · crecimiento de datos · rutas críticas · caching (TTL+invalidación) · estrategia de colas · índices · sharding.

## [SaaS] Modelo Multiinquilino
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Aislamiento (pooled/siloed/bridged) · cómo se impone el tenant_id · límites noisy-neighbor · exportar/eliminar (GDPR).

## [SaaS] Observabilidad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Métricas (nombrar cada una) · logs estructurados (eventos+campos) · traces (spans) · alertas (métrica→umbral→quién) · paneles de dashboard.

## [SaaS] Presupuesto de Coste
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- $/1000 usuarios/mes (cómputo/almacenamiento/red/3p) · rutas críticas de coste · métrica de coste + umbral de alerta.
`;
      }
      if (track === "ai") {
        return `
## [AI] 1. Estrategia de Modelo
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Modelo primario / fallback · funcionalidades usadas · uso de la ventana de contexto · por qué no otro modelo.

## [AI] 2. Arquitectura de Prompt
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
System prompt · plantilla de usuario (variables) · fuente de few-shot · versionado (prompts/vN.md, no inline).

## [AI] 3. Economía de Tokens
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Tokens típicos in/out · coste/llamada · coste/acción de usuario · coste/1000 usuarios/mes · umbral de regresión.

## [AI] 4. Presupuesto de Latencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Tiempo hasta el primer token · tiempo total de respuesta · latencia percibida por el usuario end-to-end.

## [AI] 5. Estrategia de Evaluación
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Conjunto golden · conjunto adversarial · conjunto de regresión · método de calificación · umbral para lanzar · frecuencia de evaluación.

## [AI] 6. Seguridad y Abuso
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Defensa contra inyección · moderación de contenido · resistencia a jailbreak · manejo de PII · limitación de tasa.

## [AI] 7. Fallback y Degradación
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Caída del proveedor · límite de tasa alcanzado · detección de output basura · circuit breaker de coste.

## [AI] 8. Observabilidad de IA
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Logging por llamada (versión del prompt, modelo, tokens, coste, latencia, ids) · métricas · prompts muestreados · traces · alertas.

## [AI] 9. Ciclo de Vida del Modelo
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
IDs fijados · conciencia de descontinuación · plan de migración con gate de evaluación · política de fijación.

## [AI] 10. Multimodalidad (si aplica)
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
Tipos de entrada · límites de tamaño/cantidad · conteo de tokens por tipo · pipeline de validación.
`;
      }
      if (track === "sec") {
        return `
## [SEC] Modelo de Amenazas
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Activos · actores · fronteras de confianza · puntos de entrada · STRIDE por componente / frontera (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) → mitigación · riesgo residual.

## [SEC] Requisitos de Seguridad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Nivel OWASP ASVS objetivo (L1 / L2 / L3) y por qué · los controles ASVS y los riesgos del OWASP Top 10 en alcance → cómo los cumple el diseño.

## [SEC] Autenticación y Autorización
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Quién puede hacer qué (matriz de roles / permisos) · autenticación (sesión, token, MFA) · comprobación a nivel de objeto, denegar por defecto · duración y revocación de la sesión.

## [SEC] Gestión de Secretos y Claves
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Secretos que necesita la función · dónde viven (un almacén de secretos — nunca en el código, los logs ni los tickets) · rotación · cifrado en reposo / en tránsito y quién custodia las claves.

## [SEC] Pruebas de Seguridad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- SAST · análisis de dependencias y de secretos · DAST si está expuesto · una prueba de caso de abuso por amenaza relevante — todo ejecutable en local antes del merge.
`;
      }
      if (track === "privacy") {
        return `
## [PRIVACY] Inventario de Datos Personales
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Cada campo de datos personales · categoría (categorías especiales — art. 9 — señaladas) · origen · dónde se almacena · quién puede leerlo.

## [PRIVACY] Base Jurídica y Finalidad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Finalidad por actividad de tratamiento · su base jurídica (art. 6: consentimiento, contrato, obligación legal, intereses vitales, interés público, interés legítimo) · cómo se registra y se retira el consentimiento.

## [PRIVACY] Conservación y Supresión
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Plazo de conservación por categoría de datos y por qué · el proceso de supresión / anonimización · copias de seguridad y logs · bloqueos por obligación legal.

## [PRIVACY] Derechos de los Interesados
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Acceso · rectificación · supresión · limitación · portabilidad · oposición — cómo se verifica, atiende y responde cada solicitud en el plazo de un mes.

## [PRIVACY] Encargados del Tratamiento y Transferencias Internacionales
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Encargados / subencargados y sus contratos (art. 28) · dónde se almacenan y tratan los datos · transferencias fuera del EEE y su garantía (decisión de adecuación, cláusulas contractuales tipo).

## [PRIVACY] EIPD (cuando sea obligatoria — art. 35)
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- ¿Es obligatoria? (alto riesgo: categorías especiales a gran escala, observación sistemática, elaboración de perfiles con efectos jurídicos…) · si lo es: riesgos → medidas → riesgo residual; si no: por qué no.
`;
      }
      if (track === "dist") {
        return `
## [DIST] Modelo de Consistencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Qué debe ser atómico (una transacción) · si se requiere ACID, con qué nivel de aislamiento y por qué · dónde la consistencia es fuerte y dónde eventual · el retraso que el negocio acepta · necesidades de leer las propias escrituras.

## [DIST] Escrituras entre Sistemas
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Cada escritura que toca más de un sistema (BD + broker, BD + caché, BD + API externa) → su mitigación: outbox transaccional (+ relay / CDC), inbox, saga con compensaciones — o el riesgo aceptado explícitamente, y por quién.

## [DIST] Entrega e Idempotencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Garantía de entrega (al menos una vez) · claves de idempotencia o idempotencia natural · deduplicación (tabla inbox, restricción de unicidad) · política de reintentos (retroceso exponencial + jitter, máximo de intentos, lo que nunca se reintenta) · DLQ / mensajes envenenados · necesidades de orden.

## [DIST] Concurrencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Condiciones de carrera en cada registro compartido · bloqueo optimista (columna de versión) o pesimista (SELECT … FOR UPDATE) · restricciones de unicidad · anomalías de aislamiento descartadas (actualización perdida, write skew) · tiempos de espera de bloqueo y deadlocks.

## [DIST] Modos de Fallo
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Fallos parciales y tiempos de espera por dependencia · qué ocurre cuando cada dependencia está caída (degradar, encolar, fallar rápido) · particiones de red: el compromiso CAP / PACELC elegido · recuperación y reconciliación (reprocesamiento, compensación, un proceso de reconciliación).
`;
      }
      if (track === "api") {
        return `
## [API] Contrato de la API
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Estilo (REST / GraphQL / gRPC) · recursos y operaciones (método + ruta, o query / mutation / RPC) · esquemas de petición y de respuesta · dónde está el fichero del contrato (documento OpenAPI, ficheros .proto, esquema GraphQL) — escrito primero, revisado antes de los handlers · scopes de autorización por operación.

## [API] Versionado y Compatibilidad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Estrategia de versionado (URL / cabecera / fecha) · qué es aquí un cambio incompatible (un campo eliminado o renombrado, un nuevo dato obligatorio, un tipo o código de estado cambiado, una validación más estricta) · solo cambios aditivos dentro de una versión · obsolescencia: las cabeceras Deprecation / Sunset, el plazo de aviso, cómo se avisa a los clientes.

## [API] Modelo de Errores
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Formato de los errores: application/problem+json (RFC 9457 — type, title, status, detail, instance) · los códigos de error estables en los que los clientes pueden basarse · errores de validación por campo · los códigos de estado que devuelve cada operación · ningún stack trace ni detalle interno en una respuesta.

## [API] Paginación, Idempotencia y Concurrencia
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Paginación: un cursor opaco con orden estable y un tamaño máximo de página (u offset, y por qué) · Idempotency-Key en las creaciones no idempotentes (su ámbito, cuánto tiempo se guarda una clave, una clave reutilizada con otro cuerpo → 422) · ETag / If-Match en las actualizaciones (412 en una versión obsoleta) · operaciones largas (202 + un recurso de estado).

## [API] Límites de Tasa y Cuotas
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Límites por cliente / clave / inquilino y sus ventanas · 429 con Retry-After y las cabeceras RateLimit · cuotas y cómo un cliente sabe cuánto le queda · qué queda exento.
`;
      }
      if (track === "ui") {
        return `
## [UI] Uso del Design System
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Los componentes del design system usados y los tokens (color, espaciado, tipografía) · cada componente nuevo: por qué no sirven los existentes y cómo entra en el sistema (documentado, revisado, en la biblioteca de componentes) · ningún estilo suelto ni color fijo en el código.

## [UI] Estados de la Interfaz
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Por vista, una matriz de estados: cargando · vacío · error (con Reintentar) · parcial · sin conexión · sin permiso · éxito — qué ve y qué puede hacer el usuario en cada uno; validación de formularios (en el campo + un resumen, los valores conservados).

## [UI] Accesibilidad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- WCAG 2.2 AA: operable con el teclado y orden de foco visible · nombre / etiqueta en cada control · contraste (4,5:1 en el texto, 3:1 en la interfaz) · tamaño de los objetivos (24×24 px) · movimiento reducido · errores identificados en texto · cómo se prueba (una comprobación automática + una pasada manual con teclado y lector de pantalla).

## [UI] Diseño Adaptable e i18n
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Breakpoints y cómo se adapta el layout · expansión del texto (+30–40 %) · layouts de derecha a izquierda · formatos del locale (fechas, números, moneda) · todas las cadenas en el catálogo de traducciones.

## [UI] Presupuesto de Rendimiento de la Interfaz
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Core Web Vitals en el percentil 75: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 · el presupuesto de JS / imágenes de esta vista · cómo se mide (laboratorio + usuarios reales).
`;
      }
      if (track === "obs") {
        return `
## [OBS] SLIs y SLOs
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Los recorridos de usuario que importan → sus SLIs (disponibilidad, latencia, corrección) · el SLO de cada uno en una ventana (p. ej., 99,5 % de las peticiones válidas por debajo de 800 ms, 28 días) · el presupuesto de errores y qué pasa cuando se agota · alertas por tasa de consumo (rápida y lenta).

## [OBS] Telemetría
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Métricas (RED por endpoint / USE por recurso, un contador de negocio; cardinalidad de labels acotada) · logs estructurados con un ID de correlación / traza — sin datos personales · trazas con el contexto propagado entre llamadas y colas (OpenTelemetry) · las métricas que emite cada tarea.

## [OBS] Alertas y Runbooks
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Cada alerta: el síntoma (un consumo del SLO, no una causa), el umbral, la severidad y a quién se avisa · cada aviso enlaza un runbook (triaje, mitigación, verificación) · qué es un ticket y no un aviso · dashboards por recorrido.

## [OBS] Despliegue y Reversión
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Feature flags (quién es dueño de cada una, cuándo se retira) · los pasos del canario / despliegue progresivo y las métricas que deciden cada paso · criterios de reversión (p. ej., tasa de error por encima de la referencia) y cuánto tarda una reversión · migraciones reversibles (expand / contract).

## [OBS] Salud y Capacidad
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Comprobaciones de vida frente a disponibilidad (qué verifica cada una — nunca una dependencia en la de vida) · las señales de capacidad (saturación, profundidad de colas, uso de pools) y sus umbrales · la carga esperada y dónde está el primer cuello de botella.
`;
      }
      if (track === "data") {
        return `
## [DATA] Contratos de Datos y Evolución del Esquema
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Cada conjunto de datos producido o consumido: su productor, sus consumidores y el responsable del contrato · el esquema (columnas, tipos, nulabilidad, claves, unidades) y dónde vive (un fichero de esquema, el YAML de un modelo dbt, un registro de esquemas) · la regla de compatibilidad (solo cambios aditivos; una columna eliminada o renombrada → una versión nueva con un periodo de retirada) · cómo se detiene un cambio incompatible antes de publicarlo.

## [DATA] Calidad de los Datos
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Las comprobaciones por conjunto de datos: claves no nulas, unicidad, valores y rangos aceptados, integridad referencial, anomalías de recuento de filas y de volumen, frescura · dónde se ejecuta cada una (en la ingesta, tras cada transformación, antes de publicar) · qué hace un fallo (poner las filas en cuarentena, detener la carga, avisar al responsable) — ninguna fila errónea llega a un consumidor en silencio.

## [DATA] Idempotencia del Pipeline y Backfills
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- La unidad de trabajo (una partición: un día, una hora, un ID de lote) y cómo la sustituye una reejecución (sobrescribir la partición o MERGE sobre una clave — nunca un append a ciegas) · datos que llegan tarde: la ventana de lookback y cómo se integran las filas tardías · el procedimiento de backfill (rango, paralelismo, coste, una ejecución de prueba, quién lo aprueba) · grandes volúmenes: references/distributed-data-patterns.md.

## [DATA] Linaje y Responsables
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- Orígenes → transformaciones → consumidores (un diagrama de linaje o el DAG de dbt) · el responsable de cada conjunto de datos y a quién se avisa cuando falla · el SLA de frescura del que dependen los consumidores · el historial que guarda cada tabla (dimensiones lentamente cambiantes: el tipo 1 sobrescribe, el tipo 2 guarda versiones).

## [DATA] Retención y Coste
> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).
- La retención por conjunto de datos y por nivel de almacenamiento (la zona bruta frente a la curada; caliente / templado / frío) — los datos personales siguen references/privacy-track.md · particionado y clustering para que una consulta lea solo lo que necesita · el coste esperado de almacenamiento y de consultas al mes y la alerta cuando se desvía.
`;
      }
      return "";
    },

    design(a) {
      const extra = ["tdd", ...MARKER_TRACK_ORDER].filter((t) => a.tracks.includes(t)).map((t) => BUILD.es.trackDesignBlock(t)).join("");
      if (a.size) return BUILD.es.sizedDesign(a, extra);
      return (
`# Diseño: ${a.name}

## Visión General
[Cómo se integra esto con el sistema existente. Decisiones clave y justificación.]

## Arquitectura
\`\`\`mermaid
graph TD
    A[Componente] -->|acción| B[Componente]
    B -->|query| C[(Base de Datos)]
\`\`\`

## Reutilización e Integración
<!-- Buscar antes de escribir (references/code-reuse-and-quality.md): lo que esta función aprovecha del código existente
     antes de añadir nada. Una fila por unidad, con su ruta. Reutilizar = un módulo, componente, helper o servicio
     existente usado tal cual; Extender = una unidad existente que esta función cambia (quien ya la usa sigue
     funcionando); Nuevo = nada de lo existente sirve — qué se buscó y por qué. En un proyecto nuevo, basta una línea
     que lo diga. -->
| Tipo | Qué | Dónde (ruta) | Por qué / notas |
|---|---|---|---|
| Reutilizar | [módulo, componente, helper o servicio existente] | [su ruta] | [lo que ya hace por esta función] |
| Extender | [unidad existente que esta función cambia] | [su ruta] | [el cambio — quien ya la usa sigue funcionando] |
| Nuevo | [nueva unidad] | [dónde vivirá] | [por qué nada de lo existente sirve — qué se buscó] |

**Límites de módulos:** [dónde vive el código nuevo, qué expone y qué puede importar — las funciones dependen del código compartido, nunca al revés]

## Alternativas y Compensaciones
<!-- Las opciones sopesadas para cada decisión clave — p.ej. consistencia fuerte vs eventual, monolito vs servicio,
     síncrono vs asíncrono, bloqueo optimista vs pesimista. Al menos dos por decisión (una opción sola nunca se
     sopesó), lo que costaría elegir mal, la elegida y por qué. Una fila por opción. -->
| Decisión | Opción | Pros | Contras | Coste si falla | Elegida |
|---|---|---|---|---|---|
| [decisión clave] | [opción A] | [pros] | [contras] | [coste de equivocarse] | [✓ — por qué] |
| [decisión clave] | [opción B] | [pros] | [contras] | [coste de equivocarse] | [✗ — por qué no] |

## Modelos de Datos
\`\`\`typescript
interface Entity {
  id: string;
  // campos con comentarios que explican el propósito
}
\`\`\`

## Contratos de API
### POST /api/resource
- **Request:** \`{ field: type }\`
- **Response (200):** \`{ field: type }\`
- **Errors:** 400 (validación), 401 (auth), 404 (no encontrado)

## Consideraciones de Seguridad
[Auth, validación, riesgos de exposición de datos]

## Manejo de Errores
[Estrategia por modo de fallo a partir de los requisitos]

## Estrategia de Pruebas
- Unit / Integración / E2E: [qué cubre cada uno]

## Riesgos
<!-- Lo que podría hacer que este diseño sea erróneo o retrasar la entrega — técnico, entrega, datos, negocio. Una fila
     por riesgo; un honesto "ningún riesgo relevante, porque X" sirve — en blanco no. -->
| Riesgo | Probabilidad | Impacto | Mitigación | Responsable |
|---|---|---|---|---|
| [qué podría salir mal] | [baja / media / alta] | [bajo / medio / alto] | [cómo lo evitamos o detectamos] | [quién lo vigila] |

## Verificación de la Constitución
Verifica este diseño contra cada principio en \`steering/constitution.md\`. GATE: debe pasar antes
de la implementación; revisa de nuevo tras cualquier cambio de diseño.
- [ ] [Principio 1] — cumple
- [ ] [Principio 2] — cumple
(Si un principio no puede cumplirse, NO lo rompas en silencio — regístralo en Seguimiento de Complejidad abajo.)

## Seguimiento de Complejidad
Justifica todo lo que viole un principio de la constitución o añada complejidad no obvia. Vacío es bueno.
| Qué | Por qué es necesario | Alternativa más simple rechazada porque |
|---|---|---|
| [p.ej., segunda capa de caché] | [razón] | [por qué la opción simple falla] |
${extra}
<!-- Tracks activos: ${a.label}. Las secciones obligatorias de los tracks de arriba deben tener
     contenido real — un honesto "no hace falta porque X" sirve; en blanco no. -->
`
      );
    },

    // 1.21 F5 — el diseño de una función CON TAMAÑO (el EN es la referencia: las mismas secciones y slots).
    sizedDesign(a, extra) {
      const s = a.size === "s";
      const out = [`# Diseño: ${a.name}`, "", "## Visión General", "[Cómo se integra esto con el sistema existente. Decisiones clave y justificación.]", "",
        "## Arquitectura", "```mermaid", "graph TD", "    A[Componente] -->|acción| B[Componente]", "    B -->|query| C[(Base de Datos)]", "```", ""];
      if (s) {
        out.push("## Decisiones, reutilización y riesgos",
          "<!-- Una respuesta corta a cada una. Lo que esto reutiliza (con su ruta) — o \"nada que reutilizar\"; la opción elegida,",
          "     la descartada y por qué — o \"ninguna alternativa que sopesar\"; lo que podría salir mal y cómo se detecta — o",
          "     \"ningún riesgo relevante, porque X\". En blanco no es una respuesta. -->",
          "- **Reutilización:** [módulo o helper existente reutilizado, con su ruta — o nada que reutilizar]",
          "- **Decisión:** [la opción elegida, la descartada y por qué]",
          "- **Riesgo:** [lo que podría salir mal y cómo se detecta — o ningún riesgo relevante, porque …]", "");
      } else {
        out.push("## Reutilización e Integración",
          "<!-- Buscar antes de escribir (references/code-reuse-and-quality.md): lo que esta función aprovecha del código existente",
          "     antes de añadir nada. Una fila por unidad, con su ruta — Reutilizar (tal cual), Extender (cambiada; quien ya la usa sigue",
          "     funcionando) o Nuevo (nada de lo existente sirve — qué se buscó). En un proyecto nuevo, basta una línea que lo diga. -->",
          "| Tipo | Qué | Dónde (ruta) | Por qué / notas |", "|---|---|---|---|",
          "| [Reutilizar / Extender / Nuevo] | [la unidad] | [su ruta] | [por qué — en un Nuevo: qué se buscó] |", "",
          "**Límites de módulos:** [dónde vive el código nuevo, qué expone y qué puede importar — las funciones dependen del código compartido, nunca al revés]", "",
          "## Alternativas y Compensaciones",
          "<!-- Las opciones sopesadas para cada decisión clave — p.ej. consistencia fuerte vs eventual, monolito vs servicio,",
          "     síncrono vs asíncrono, bloqueo optimista vs pesimista. Al menos dos por decisión (una opción sola nunca se",
          "     sopesó), lo que costaría elegir mal, la elegida y por qué. Una fila por opción. -->",
          "| Decisión | Opción | Pros | Contras | Coste si falla | Elegida |", "|---|---|---|---|---|---|",
          "| [decisión clave] | [opción A] | [pros] | [contras] | [coste de equivocarse] | [✓ — por qué] |",
          "| [decisión clave] | [opción B] | [pros] | [contras] | [coste de equivocarse] | [✗ — por qué no] |", "",
          "## Modelos de Datos", "```typescript", "interface Entity {", "  id: string;", "  // campos con comentarios que explican el propósito", "}", "```", "");
        if (!coreSuperseded(a, "apiContracts")) out.push("## Contratos de API", "### POST /api/resource", "- **Request:** `{ field: type }`", "- **Response (200):** `{ field: type }`",
          "- **Errors:** 400 (validación), 401 (auth), 404 (no encontrado)", "");
        if (!coreSuperseded(a, "securityConsiderations")) out.push("## Consideraciones de Seguridad", "[Auth, validación, riesgos de exposición de datos]", "");
      }
      if (!coreSuperseded(a, "errorHandling")) out.push("## Manejo de Errores",
        "Cada criterio SI…ENTONCES de requirements.md ya nombra un fallo y su recuperación — añade aquí solo lo que comparten (reintentos, alternativas, los mensajes que ve el usuario), o nada más.", "");
      if (!s && !coreSuperseded(a, "testingStrategy")) out.push("## Estrategia de Pruebas", "- Unit / Integración / E2E: [qué cubre cada uno]", "");
      if (!s) out.push("## Riesgos",
        "<!-- Lo que podría hacer que este diseño sea erróneo o retrasar la entrega — técnico, entrega, datos, negocio. Una fila",
        "     por riesgo; un honesto \"ningún riesgo relevante, porque X\" sirve — en blanco no. -->",
        "| Riesgo | Probabilidad | Impacto | Mitigación | Responsable |", "|---|---|---|---|---|",
        "| [qué podría salir mal] | [baja / media / alta] | [bajo / medio / alto] | [cómo lo evitamos o detectamos] | [quién lo vigila] |", "");
      out.push("## Verificación de la Constitución", "Verifica este diseño contra cada principio en `steering/constitution.md`. GATE: debe pasar antes",
        "de la implementación; revisa de nuevo tras cualquier cambio de diseño.", "- [ ] [Principio 1] — cumple", "- [ ] [Principio 2] — cumple",
        "(Si un principio no puede cumplirse, NO lo rompas en silencio — regístralo en Seguimiento de Complejidad abajo.)", "",
        "## Seguimiento de Complejidad", "Justifica todo lo que viole un principio de la constitución o añada complejidad no obvia. Vacío es bueno.",
        "| Qué | Por qué es necesario | Alternativa más simple rechazada porque |", "|---|---|---|");
      return out.join("\n") + "\n" + extra + `
<!-- Tracks activos: ${a.label} · tamaño ${a.size}. Las secciones obligatorias de los tracks de arriba deben tener contenido
     real — un honesto "n/a — <por qué no aplica>" sirve; en blanco, o solo la línea de orientación de la plantilla, no. -->
`;
    },

    tasks(a) {
      const green = a.tracks.includes("tdd") ? templateTests(a.tracks) : null;
      const evalMarker = a.tracks.includes("ai") ? "\n  - _Affects evals: golden (maintain baseline)_" : "";
      const metricMarker = a.tracks.includes("saas") ? "\n  - _Emits metrics: req_duration_ms{feature=" + a.slug + "}_" : "";
      let n = 0;
      const id = () => ++n;
      // 1.21 F5 — tamaño S (el EN es la referencia): una tarea core (los dos criterios de US-1) y los bloques de los tracks.
      if (a.size === "s") {
        const green1 = a.tracks.includes("tdd") ? templateTests(a.tracks, "s") : null;
        let body =
`## Historia US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Comportamiento central para US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2_${greenLine(green1, "US-1.AC-1", "US-1.AC-2")}${metricMarker}${evalMarker}
  - _Verify: [comando que lo demuestra, p. ej.: npm test -- ruta/fichero.test.js]_
**Checkpoint:** US-1 está totalmente funcional y es testeable/lanzable de forma independiente.
`;
        for (const t of MARKER_TRACK_ORDER) {
          if (!a.tracks.includes(t)) continue;
          const block = BUILD.es.trackTasks({ track: t, start: n + 1, green: green1 });
          body += block;
          n += (block.match(/^- \[ \] \d+\./gm) || []).length;
        }
        return (
`# Tareas: ${a.name}

<!-- Tracks: ${a.label} · tamaño s. Una historia; cada tarea lleva _Requirements:_ (las TDD _Makes green:_) y un
     _Verify: <comando>_ — spec_complete_task registra el resultado como evidencia de la tarea. Usa _Implements: ruta_
     para vincular una tarea a un archivo de código real. -->

## Restricciones Globales
<!-- Valores exactos que toda tarea debe respetar, copiados tal cual de la spec/steering — spec_task_brief copia esta
     sección en cada brief. -->
- [p. ej.: Node >= 20 · sin dependencias de runtime nuevas · campos de la API en snake_case]

${body}`
        );
      }
      let phases =
`## Fase: Setup
- [ ] ${id()}. [shared][P] [setup de proyecto/dev si hace falta — deps, scaffolding]

## Fase: Fundacional (bloquea todas las historias)
- [ ] ${id()}. [shared] [Modelos, schemas, índices compartidos entre historias]
  - _Requirements: US-1.AC-1_${metricMarker}

## Historia US-1 (P1 — MVP)
- [ ] ${id()}. [US1] [Comportamiento central para US-1]
  - _Requirements: US-1.AC-1, US-1.AC-2, US-1.AC-3_${greenLine(green, "US-1.AC-1", "US-1.AC-2", "US-1.AC-3")}${evalMarker}
  - _Verify: [comando que lo demuestra, p. ej.: npm test -- ruta/fichero.test.js]_
- [ ] ${id()}. [US1][P] [tarea paralelizable — archivo distinto, sin deps]
  - _Requirements: US-1.AC-4_${greenLine(green, "US-1.AC-4")}
**Checkpoint:** US-1 está totalmente funcional y es testeable/lanzable de forma independiente.
`;
      for (const t of MARKER_TRACK_ORDER) {
        if (!a.tracks.includes(t)) continue;
        const block = BUILD.es.trackTasks({ track: t, start: n + 1, green });
        phases += block;
        n += (block.match(/^- \[ \] \d+\./gm) || []).length;
      }
      phases +=
`
## Historia US-2 (P2)
- [ ] ${id()}. [US2] [Comportamiento para US-2]
  - _Requirements: US-2.AC-1_${greenLine(green, "US-2.AC-1")}
**Checkpoint:** US-2 funciona sin romper US-1.

## Fase: Pulido (transversal)
- [ ] ${id()}. [shared][P] [docs, limpieza, robustez de casos límite]
`;
      return (
`# Tareas: ${a.name}

<!-- Tracks: ${a.label}. Organizado por historia de usuario para que cada una sea lanzable de forma
     independiente (P1 primero). Cada tarea se marca con su historia: [US1]/[US2] o [shared] para
     trabajo transversal. [P] = paralelizable (archivos distintos, sin deps). Cada tarea lleva
     _Requirements:_; las tareas TDD llevan _Makes green:_. Usa _Implements: ruta_ para vincular una tarea
     a un archivo de código real. Un **Checkpoint** marca dónde una historia es testeable de forma independiente.
     Si las historias NO son lanzables de forma independiente, se trocearon mal — vuelve a trocearlas, o
     recurre a un layout por capa técnica (Fundación→Lógica→API→…) manteniendo las tags [US1]. -->

## Restricciones Globales
<!-- Valores exactos que toda tarea debe respetar, copiados tal cual de la spec/steering (versiones
     mínimas, reglas de nombres, límites, formatos) — spec_task_brief copia esta sección en cada brief.
     Da a cada tarea un _Verify: <comando>_: spec_complete_task registra el resultado como evidencia. -->
- [p. ej.: Node >= 20 · sin dependencias de runtime nuevas · campos de la API en snake_case]

${phases}`
      );
    },

    trackTasks(a) {
      let n = a.start - 1;
      const id = () => ++n;
      if (a.track === "saas") {
        return `
## Historia US-1 — Observabilidad y Escala
- [ ] ${id()}. [US1] Emitir métricas, añadir dashboard, configurar alertas
  - _Requirements: US-1.AC-6_
- [ ] ${id()}. [US1] Prueba de carga — verificar el presupuesto de rendimiento del design.md (solo ruta crítica)
  - _Requirements: US-1.AC-6_${greenLine(a.green, "US-1.AC-6")}
- [ ] ${id()}. [US1] Imponer el aislamiento de inquilino — toda query filtrada por tenant_id
  - _Requirements: US-1.AC-5_${greenLine(a.green, "US-1.AC-5")}
`;
      }
      if (a.track === "ai") {
        return `
## Historia US-1 — IA
- [ ] ${id()}. [US1] Prompt v1 + conexión al harness de evaluación (tarea separada por cambio de prompt)
  - _Requirements: US-1.AC-7, US-1.AC-8_
  - _Affects evals: golden, adversarial, regression_${greenLine(a.green, "US-1.AC-7", "US-1.AC-8")}
- [ ] ${id()}. [US1] Monitorización de coste — emitir métrica de coste + alerta
  - _Requirements: US-1.AC-9_${greenLine(a.green, "US-1.AC-9")}
`;
      }
      if (a.track === "sec") {
        return `
## Historia US-1 — Seguridad
- [ ] ${id()}. [US1] Modelar las amenazas de la función (STRIDE por frontera de confianza); registrar cada mitigación en el design.md
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
- [ ] ${id()}. [US1] Imponer autenticación y autorización a nivel de objeto en todos los endpoints (denegar por defecto)
  - _Requirements: US-1.AC-10, US-1.AC-11_${greenLine(a.green, "US-1.AC-10", "US-1.AC-11")}
- [ ] ${id()}. [US1] Mantener los secretos fuera del código, las respuestas y los logs — almacén de secretos + ocultación en los logs
  - _Requirements: US-1.AC-12_${greenLine(a.green, "US-1.AC-12")}
- [ ] ${id()}. [US1] Pruebas de seguridad — SAST, auditoría de dependencias y las pruebas de casos de abuso, ejecutables en local
  - _Requirements: US-1.AC-10, US-1.AC-11, US-1.AC-12_
`;
      }
      if (a.track === "privacy") {
        return `
## Historia US-1 — Privacidad
- [ ] ${id()}. [US1] Inventario de datos personales + base jurídica por finalidad en el design.md; actualizar la política de privacidad
  - _Requirements: US-1.AC-13, US-1.AC-14, US-1.AC-15_
- [ ] ${id()}. [US1] Solicitudes de los interesados — acceso/exportación y supresión de extremo a extremo, en todos los almacenes y encargados
  - _Requirements: US-1.AC-13, US-1.AC-14_${greenLine(a.green, "US-1.AC-13", "US-1.AC-14")}
- [ ] ${id()}. [US1] Conservación — supresión/anonimización programada de los registros con el plazo de conservación vencido
  - _Requirements: US-1.AC-15_${greenLine(a.green, "US-1.AC-15")}
`;
      }
      if (a.track === "dist") {
        return `
## Historia US-1 — Consistencia de Datos
- [ ] ${id()}. [US1] Outbox transaccional — escribir la fila del outbox en la misma transacción que el cambio de estado; un relay (polling o CDC) la publica y la marca como enviada
  - _Requirements: US-1.AC-16_${greenLine(a.green, "US-1.AC-16")}
- [ ] ${id()}. [US1] Consumidor idempotente — una tabla inbox / de mensajes procesados con la clave en el ID del mensaje, escrita en la misma transacción que el efecto
  - _Requirements: US-1.AC-17_${greenLine(a.green, "US-1.AC-17")}
- [ ] ${id()}. [US1] Control de concurrencia — una columna de versión (bloqueo optimista) o una restricción de unicidad; un conflicto es un error, nunca una sobrescritura silenciosa
  - _Requirements: US-1.AC-18_${greenLine(a.green, "US-1.AC-18")}
- [ ] ${id()}. [US1] Resiliencia — tiempos de espera, reintentos con retroceso exponencial + jitter (nunca una llamada no idempotente sin clave), una DLQ, la ruta degradada cuando una dependencia está caída
  - _Requirements: US-1.AC-19_${greenLine(a.green, "US-1.AC-19")}
- [ ] ${id()}. [US1] Pruebas de inyección de fallos — caída entre el commit y la publicación, entrega duplicada, actualizaciones concurrentes, una dependencia caída — ejecutables localmente
  - _Requirements: US-1.AC-16, US-1.AC-17, US-1.AC-18, US-1.AC-19_
`;
      }
      if (a.track === "api") {
        return `
## Historia US-1 — Contrato de la API
- [ ] ${id()}. [US1] Contrato primero — el documento OpenAPI / los ficheros .proto / el esquema GraphQL en el repositorio, revisado antes de los handlers (el fichero es el marcador Implements de esta tarea)
  - _Requirements: US-1.AC-20, US-1.AC-21, US-1.AC-22, US-1.AC-23_
- [ ] ${id()}. [US1] Modelo de errores — cada error un cuerpo application/problem+json con un código estable; un error de validación nombra cada campo
  - _Requirements: US-1.AC-20_${greenLine(a.green, "US-1.AC-20")}
- [ ] ${id()}. [US1] Idempotencia y concurrencia — una Idempotency-Key en las creaciones (se devuelve de nuevo la respuesta guardada), ETag / If-Match en las actualizaciones (412 en una versión obsoleta)
  - _Requirements: US-1.AC-21, US-1.AC-22_${greenLine(a.green, "US-1.AC-21", "US-1.AC-22")}
- [ ] ${id()}. [US1] Barrera de compatibilidad — una comparación del contrato con la versión publicada que detecta cambios incompatibles, ejecutable en local; lo que se elimine queda obsoleto con una fecha de Sunset
  - _Requirements: US-1.AC-23_${greenLine(a.green, "US-1.AC-23")}
- [ ] ${id()}. [US1] Pruebas de contrato — la implementación verificada contra el contrato (cada código de estado, esquema y cabecera documentado), ejecutables en local
  - _Requirements: US-1.AC-20, US-1.AC-21, US-1.AC-22, US-1.AC-23_
`;
      }
      if (a.track === "ui") {
        return `
## Historia US-1 — Interfaz de Usuario
- [ ] ${id()}. [US1] Construir la vista con componentes y tokens del design system — un componente nuevo solo a través del sistema (documentado, revisado)
  - _Requirements: US-1.AC-24, US-1.AC-25, US-1.AC-26, US-1.AC-27_
- [ ] ${id()}. [US1] Estados de la interfaz — cargando, vacío, error con Reintentar, parcial, sin conexión, sin permiso, éxito — según la matriz de estados de design.md
  - _Requirements: US-1.AC-26, US-1.AC-27_${greenLine(a.green, "US-1.AC-26", "US-1.AC-27")}
- [ ] ${id()}. [US1] Formularios y teclado — valores conservados en un error, errores en texto con un resumen, orden de foco lógico, foco visible
  - _Requirements: US-1.AC-24, US-1.AC-25_${greenLine(a.green, "US-1.AC-24", "US-1.AC-25")}
- [ ] ${id()}. [US1] Comprobaciones de accesibilidad — una comprobación automática (axe o equivalente) ejecutable en local + una pasada manual con teclado y lector de pantalla (los hallazgos en el informe)
  - _Requirements: US-1.AC-24, US-1.AC-25_
- [ ] ${id()}. [US1] Diseño adaptable, i18n y el presupuesto de rendimiento — los breakpoints, la expansión del texto, RTL, los formatos del locale; LCP / INP / CLS dentro del presupuesto
  - _Requirements: US-1.AC-24, US-1.AC-26, US-1.AC-27_
`;
      }
      if (a.track === "obs") {
        return `
## Historia US-1 — Operabilidad
- [ ] ${id()}. [US1] SLIs, SLOs y alertas por tasa de consumo — definidos en código / configuración junto al servicio, cada alerta enlazada a su runbook
  - _Requirements: US-1.AC-29_${greenLine(a.green, "US-1.AC-29")}
- [ ] ${id()}. [US1] Telemetría — las métricas, los logs estructurados con el ID de correlación (sin datos personales) y los spans de traza que indica el diseño
  - _Requirements: US-1.AC-28_${greenLine(a.green, "US-1.AC-28")}
  - _Emits metrics: requests_total, request_duration_seconds, errors_total_
- [ ] ${id()}. [US1] Despliegue — una feature flag y un canario / despliegue progresivo decidido por las métricas del SLO; reversión automática según los criterios de design.md
  - _Requirements: US-1.AC-30_${greenLine(a.green, "US-1.AC-30")}
- [ ] ${id()}. [US1] Comprobaciones de salud — endpoints de vida y de disponibilidad (una dependencia caída → no listo, sigue vivo); señales de capacidad con umbrales
  - _Requirements: US-1.AC-31_${greenLine(a.green, "US-1.AC-31")}
- [ ] ${id()}. [US1] Pruebas de operabilidad — inyección de fallos (una dependencia caída, una dependencia lenta), una alerta que salta en un fallo escenificado, un simulacro de reversión — ejecutables en local o en staging
  - _Requirements: US-1.AC-28, US-1.AC-29, US-1.AC-30, US-1.AC-31_
`;
      }
      if (a.track === "data") {
        return `
## Historia US-1 — Pipeline de Datos
- [ ] ${id()}. [US1] Contrato de datos primero — el esquema de cada conjunto de datos (columnas, tipos, nulabilidad, claves), el responsable y la regla de compatibilidad en el repositorio, revisados antes de las transformaciones
  - _Requirements: US-1.AC-35_${greenLine(a.green, "US-1.AC-35")}
- [ ] ${id()}. [US1] Comprobaciones de calidad de datos — no nulos, únicos, rangos aceptados, recuentos de filas y frescura en la ingesta y antes de publicar; una fila que falla queda en cuarentena con su regla, nunca se carga
  - _Requirements: US-1.AC-32, US-1.AC-34_${greenLine(a.green, "US-1.AC-32", "US-1.AC-34")}
- [ ] ${id()}. [US1] Cargas idempotentes — cada ejecución sustituye su partición (sobrescribir o MERGE sobre una clave, nunca un append a ciegas); filas tardías integradas dentro de la ventana de lookback
  - _Requirements: US-1.AC-33_${greenLine(a.green, "US-1.AC-33")}
- [ ] ${id()}. [US1] Backfill — el procedimiento para un rango de fechas (paralelismo, coste, una ejecución de prueba), ensayado en una partición y comparado con una sola ejecución
  - _Requirements: US-1.AC-33_
- [ ] ${id()}. [US1] Linaje, responsables y retención — orígenes → transformaciones → consumidores documentados, un responsable por conjunto de datos, la retención y el particionado de design.md aplicados
  - _Requirements: US-1.AC-32, US-1.AC-33, US-1.AC-34, US-1.AC-35_
`;
      }
      return "";
    },

    bugReport(a) {
      return `# Bug: ${a.name}

<!-- Flujo de bugfix (depuración sistemática): reproducir → encontrar la CAUSA RAÍZ con evidencia → escribir
     la prueba de regresión que falla → corregir la causa, no el síntoma → verificar. spec_doctor falla
     mientras la "Causa Raíz" no esté rellenada: ninguna corrección antes de conocer la causa. -->

## Resumen
${a.summary || "[una línea: qué está roto, para quién, desde cuándo]"}

## Reproducción
${a.reproduction || "> **TODO** — pasos, entrada y entorno exactos que lo reproducen siempre."}

## Esperado vs Actual
- **Esperado:** ${a.behaviour || "[comportamiento correcto]"}
- **Actual:** [lo que ocurre — mensaje de error, salida, líneas de log]

## Causa Raíz
${a.rootCause || "> **TODO** — la causa, con evidencia (stack trace, log, aserción que falla, el cambio que la introdujo). No \"probablemente\"."}

## Corrección
[Qué cambia y por qué elimina la causa raíz — una corrección, no un paquete.]

## Prueba de Regresión
- **T-01** — reproduce el bug: falla antes de la corrección y pasa después.
`;
    },

    bugRequirements(a) {
      return `# Bugfix: ${a.name}

## Resumen
${a.summary || "[una línea: el bug a corregir]"}

## Historias de Usuario

### US-1 (P1 — corrección): ${a.name}
**Prueba Independiente:** la prueba de regresión T-01 reproduce el bug antes de la corrección y pasa después.

#### Criterios de Aceptación (EARS)
1. **US-1.AC-1** — SI ${a.condition || "[la condición que provoca el bug]"} ENTONCES EL SISTEMA DEBE ${a.behaviour || "[el comportamiento correcto]"}
2. **US-1.AC-2** — EL SISTEMA DEBE mantener [el comportamiento vecino que ya funcionaba] sin cambios

## Criterios de Éxito
- **SC-001** — los pasos de reproducción de bug.md dejan de reproducir el bug.

## Casos Límite y Manejo de Errores
- **EC-1** — [entradas cercanas que deben seguir funcionando]

## Fuera de Alcance
- Refactorizaciones no relacionadas — regístralas como trabajo aparte.
`;
    },

    bugTestPlan(name) {
      return `# Test Plan: ${name}

<!-- Tipo: example (una entrada concreta → resultado esperado) o property (una invariante sobre entradas generadas — p. ej.
     "toda entrada fuera de la condición del bug se comporta como antes" protege bien US-1.AC-2). Los valores quedan example / property.
     Pon el Test ID en el nombre de la prueba (test("T-01 …"), def test_T01_…) para que trace_check {code: true} lo encuentre. -->

| Test ID | Capa | Tipo | Descripción | Cubre (AC IDs) | Fichero |
|---------|------|------|-------------|----------------|---------|
| T-01 | [unit/integración] | example | regresión — reproduce el bug (rojo antes de la corrección) | US-1.AC-1, SC-001 | \`[ruta]\` |
| T-02 | [unit/integración] | example | el comportamiento vecino sigue funcionando | US-1.AC-2 | \`[ruta]\` |
`;
    },

    bugTasks(name, size) {
      // 1.21 F5 — un bugfix XS (el EN es la referencia): sin las tareas "reproducir" / "causa raíz" — los gates ya las exigen.
      if (size === "xs") {
        return `# Tareas: ${name}

<!-- Bugfix XS: bug.md → Reproducción y Causa Raíz se escriben y aprueban primero (los gates de los requisitos y del diseño).
     La tarea 1 es roja por diseño (su prueba debe FALLAR): su _Verify:_ ejecuta T-01 y _Expect: fail_ hace de esa
     ejecución que falla la prueba (una que pase se rechaza). La suite que debe pasar va en la tarea del arreglo (2).
     T-02 protege un comportamiento que ya funciona — en verde antes y después del arreglo, así que no entra en el
     _Makes green:_ de ninguna tarea. -->

## Restricciones Globales
- [valores exactos que la corrección debe respetar — versiones, límites, formatos]

## Fase: Corrección
- [ ] 1. [US1] Escribir la prueba de regresión T-01 y verla fallar por la razón correcta (pegar la salida); añadir la prueba de protección T-02 (ya pasa)
  - _Requirements: US-1.AC-1_
  - _Verify: [comando que ejecuta T-01]_
  - _Expect: fail_
- [ ] 2. [US1] Corregir la causa raíz — un cambio, no un paquete; la prueba de protección T-02 sigue en verde
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01_
  - _Verify: [comando de la suite de pruebas completa]_
**Checkpoint:** el bug deja de reproducirse y la suite completa está en verde.
`;
      }
      return `# Tareas: ${name}

<!-- El orden de un bugfix es fijo: reproducir → causa raíz → prueba de regresión que falla → corregir → verificar.
     Ninguna corrección antes de que bug.md → Causa Raíz esté rellenada con evidencia.
     La tarea 3 es roja por diseño (su prueba debe FALLAR): su _Verify:_ ejecuta T-01 y _Expect: fail_ hace de esa
     ejecución que falla la prueba (una que pase se rechaza). La suite que debe pasar va en la tarea del arreglo (4).
     T-02 protege un comportamiento que ya funciona — en verde antes y después del arreglo, así que no entra en el
     _Makes green:_ de ninguna tarea. -->

## Restricciones Globales
- [valores exactos que la corrección debe respetar — versiones, límites, formatos]

## Fase: Corrección
- [ ] 1. [shared] Reproducir el bug de forma fiable y escribir los pasos en bug.md → Reproducción
  - _Requirements: US-1.AC-1_
- [ ] 2. [shared] Encontrar la causa raíz con evidencia; rellenar bug.md → Causa Raíz (aún sin corregir)
  - _Requirements: US-1.AC-1_
- [ ] 3. [US1] Escribir la prueba de regresión T-01 y verla fallar por la razón correcta (pegar la salida); añadir la prueba de protección T-02 (ya pasa)
  - _Requirements: US-1.AC-1_
  - _Verify: [comando que ejecuta T-01]_
  - _Expect: fail_
- [ ] 4. [US1] Corregir la causa raíz — un cambio, no un paquete; la prueba de protección T-02 sigue en verde
  - _Requirements: US-1.AC-1, US-1.AC-2_
  - _Makes green: T-01_
  - _Verify: [comando de la suite de pruebas completa]_
**Checkpoint:** el bug deja de reproducirse y la suite completa está en verde.
`;
    },

    testPlan(name, tracks, acs, size) {
      const rows = templateTestRows(tracks, (t, layer, kind, desc, ac, file) => `| ${t} | ${layer} | ${kind} | ${desc} | ${ac} | \`${file}\` |`,
        { integration: "integración", load: "carga", behavior: "[comportamiento]", acSlot: "[los IDs de AC que cubre esta prueba]", recovery: "[condición de error → recuperación]", property: "[propiedad siempre verdadera]",
          tenant: "el inquilino A nunca lee registros del inquilino B", latency: "latencia P95 dentro del presupuesto de rendimiento",
          golden: "conjunto golden ≥ umbral de calidad", injection: "adversarial: las instrucciones inyectadas se ignoran", cost: "coste por solicitud dentro del presupuesto",
          unauthenticated: "caso de abuso: una solicitud no autenticada recibe 401 y ningún dato", forbidden: "caso de abuso: el usuario B nunca lee el recurso del usuario A (403 + evento de auditoría)",
          noSecrets: "ningún secreto, token ni stack trace en respuestas o logs", exportData: "la exportación de un interesado contiene todos sus datos personales, en formato de lectura mecánica",
          erasure: "tras la supresión ningún almacén conserva los datos personales del interesado", retention: "los registros con el plazo de conservación vencido se eliminan o anonimizan",
          outboxCrash: "caída entre el commit en la BD y la publicación: el evento se entrega igualmente", duplicateDelivery: "el mismo mensaje entregado dos (o N) veces tiene exactamente un efecto",
          lostUpdate: "actualizaciones concurrentes del mismo registro: ninguna se pierde en silencio", dependencyDown: "una dependencia caída: degradar / reintentar con retroceso, la ruta crítica no se bloquea",
          contract: "contrato", problemJson: "prueba de contrato: una petición sin un campo obligatorio recibe 400 problem+json que lo nombra", idempotencyReplay: "una creación repetida con la misma Idempotency-Key tiene un solo efecto y devuelve la primera respuesta", staleEtag: "una actualización con un If-Match obsoleto recibe 412 y no cambia nada", breakingDiff: "comparación de cambios incompatibles: el contrato frente a la versión publicada no informa de ninguno",
          component: "componente", visual: "visual", keyboardA11y: "recorrido solo con teclado + una comprobación automática de accesibilidad (axe): cada acción alcanzable, foco visible, ninguna violación", formErrors: "formulario con campos no válidos: los valores conservados, cada error nombrado en texto, el foco en el resumen", emptyState: "regresión visual de los estados de la vista: el estado vacío explica por qué y ofrece la siguiente acción", loadError: "carga fallida: un error con Reintentar, el contenido ya mostrado conservado",
          telemetry: "cada petición emite la métrica, una línea de log estructurada y una traza con un único ID de correlación; ningún dato personal en el log", burnAlert: "fallo escenificado que consume el presupuesto de errores: la alerta por tasa de consumo salta y avisa con el enlace al runbook", rollbackDrill: "simulacro de reversión: un canario con la tasa de error por encima del umbral detiene el despliegue y revierte", readiness: "inyección de fallos: una dependencia caída → la disponibilidad falla, la vida pasa, recuperación sin reinicio",
          dataQuality: "comprobaciones de calidad de datos sobre lotes de prueba: una clave nula, un duplicado y una fila fuera de rango quedan en cuarentena con su regla, las filas válidas se cargan",
          idempotentRerun: "una partición reejecutada o con backfill dos veces queda con las mismas filas que una ejecución — sin duplicados, sin huecos",
          freshness: "una partición más antigua que el SLA de frescura: la comprobación de frescura falla y avisa al responsable",
          schemaChange: "compatibilidad de cambios de esquema: una columna opcional nueva pasa, una columna eliminada / renombrada o un tipo más restringido se rechaza antes de la carga" }, acs, size);
      return (
`# Test Plan: ${name}

## Estrategia
- **Test runner:** []
- **Enfoque de mocking:** []
- **Objetivo de cobertura:** []
- **Rutas críticas que exigen 100% de cobertura de ramas:** []

## Matriz de Trazabilidad

<!-- Tipo — example: una entrada concreta → resultado esperado; lo habitual para criterios por evento (CUANDO …, SI … ENTONCES).
     property: una invariante comprobada sobre muchas entradas generadas (fast-check, Hypothesis, jqwik, gopter, FsCheck); úsalo
     en criterios ubicuos (EL SISTEMA DEBE siempre …), criterios MIENTRAS (por estado) y cualquier regla "nunca / para todo" —
     aislamiento entre inquilinos, un round-trip codificar → decodificar, totales que siempre cuadran. Los valores quedan example / property.
     Pon el Test ID en el nombre de la prueba (test("T-01 …"), def test_T01_…) para que trace_check {code: true} lo encuentre. -->

| Test ID | Capa | Tipo | Descripción | Cubre (AC IDs) | Archivo |
|---------|------|------|-------------|----------------|---------|
${rows}

## Verificación de Cobertura
Cada AC debe aparecer en al menos una celda "Cubre". Lagunas (con justificación):
- [ninguna]

## Datos de Prueba y Fixtures
- []

## Fuera de Alcance para Pruebas
- []
`
      );
    },

    evalPlan(name) {
      return (
`# Eval Plan: ${name}

## Conjunto Golden (50–200 ítems)
Entradas representativas con salidas/rúbrica de calidad esperada. Cubre queries típicas, personas, longitudes.

## Conjunto Adversarial
Inyecciones de prompt, jailbreaks, solicitudes fuera de alcance (debe rechazar), elicitación de output inseguro, entradas degeneradas.

## Conjunto de Regresión
Cada fallo de producción corregido se convierte en un caso de evaluación permanente. Crece, nunca encoge.

## Calificación
- Método por conjunto: coincidencia exacta / validación de schema / LLM-como-juez (con rúbrica) / revisión humana.
- Los prompts de calificación están versionados y probados.

## Umbrales de Calidad (criterios para lanzar)
- Golden: ≥ [85]% bueno-o-excelente
- Seguridad adversarial: 100% rechazado (tolerancia cero)
- Inyección adversarial: ≥ [98]% ignorado
- Regresión: 100% mantenido

## Baseline
Ejecuta el golden con un prompt v1 mínimo + modelo planeado; registra aquí la puntuación baseline antes de implementar.
- Baseline (fecha/puntuación): [ ]
`
      );
    },

    loadTest(name) {
      return (
`# Load Test: ${name}

## Escenarios
- Estado estable · Burst · Soak · Spike

## Presupuesto (del design.md Presupuesto de Rendimiento)
- Objetivos P50/P95/P99 · objetivo de throughput · techo de tasa de error.

## Herramientas
- Ubicación del script k6 / Artillery: []

## Criterios de Aprobación
P50/P95/P99 medidos ≤ presupuesto al throughput objetivo, tasa de error < [0.1]%.
`
      );
    },

    // 1.21 F5 — un cambio (kind "change", tamaño xs): UN archivo con todo el plan (el EN es la referencia).
    change(a) {
      return `# Cambio: ${a.name}

## Resumen
${a.summary || "[una línea: qué cambia y por qué]"}

## Criterios de Aceptación (EARS)
1. **US-1.AC-1** — CUANDO [disparador] EL SISTEMA DEBE [comportamiento]

## Enfoque
[el cambio en una o dos líneas — qué toca y por qué eso es todo]

## Tareas
- [ ] 1. [US1] [el cambio]
  - _Requirements: US-1.AC-1_
  - _Verify: [comando que lo demuestra, p. ej.: npm test -- ruta/fichero.test.js]_

<!-- Un cambio (tamaño xs): 1–3 criterios de aceptación y 1–3 tareas, solo core — sin clasificación, diseño, quickstart ni
     checklist. Dos aprobaciones: el plan (este archivo — spec_approve {through: "tasks"}) y el cierre de la ejecución. Más
     criterios o tareas, o un track (+tdd, +sec …), lo convierten en una función de tamaño s: spec_create {size: "s"}. -->
`;
    },

    quickstart(name) {
      return (
`# Quickstart: ${name}

Un escenario de aceptación ejecutable por una persona — el smoke test manual que prueba que la función
funciona de extremo a extremo. Mantenlo concreto; cualquiera debería poder seguirlo.

## Precondiciones
- [entorno / datos / cuentas necesarias]

## Pasos (camino feliz — US-1 / P1)
1. [haz esto]
2. [luego esto]
3. **Esperado:** [resultado observable vinculado a un Criterio de Éxito, p.ej. SC-001]

## Camino negativo
1. [dispara una condición de error de un AC SI…ENTONCES]
2. **Esperado:** [manejo elegante]

## Hecho cuando
- [ ] El camino feliz produce el resultado esperado.
- [ ] El camino negativo se maneja con elegancia.
- [ ] Los Criterios de Éxito (SC-…) se cumplen de forma observable.
`
      );
    },

    checklist(a) {
      // 1.21 F5 (el EN es la referencia): los recuentos de una función con tamaño (a.sectionCounts) y, con +obs, la línea +saas sin
      // la telemetría que +obs ya comprueba. Sin tamaño: los recuentos y las líneas de siempre.
      const cnt = (t, n) => (a.sectionCounts && a.sectionCounts[t] != null ? a.sectionCounts[t] : n);
      const items = [
        "Requisitos: cada AC es testeable, tiene ID estable, sin términos vagos (ejecuta `ears`).",
        "Diseño: respeta la constitución del proyecto (ningún principio violado).",
        "Diseño: al menos un diagrama Mermaid; seguridad + manejo de errores cubiertos.",
        "Trazabilidad: cada AC mapea a una tarea (ejecuta `trace`).",
      ];
      if (a.tracks.includes("tdd")) items.push("TDD: todas las pruebas planeadas escritas y en rojo por la razón correcta antes del código.", "TDD: los commits de prueba entran antes que los de implementación.");
      if (a.tracks.includes("saas")) items.push("SaaS: " + cnt("saas", 5) + " secciones obligatorias de diseño rellenadas (sin TODO).", "SaaS: aislamiento de inquilino impuesto (`WHERE tenant_id = ?`).", a.size && a.tracks.includes("obs") ? "SaaS: prueba de carga cumple el presupuesto (ruta crítica)." : "SaaS: métricas/logs/alertas emitidos; prueba de carga cumple el presupuesto (ruta crítica).");
      if (a.tracks.includes("ai")) items.push("IA: " + cnt("ai", 10) + " secciones obligatorias de diseño rellenadas (sin TODO).", "IA: golden ≥ umbral, seguridad adversarial 100%, regresión mantenida.", "IA: prompts versionados en prompts/vN.md; coste dentro del presupuesto.");
      if (a.tracks.includes("sec")) items.push("SEC: " + cnt("sec", 5) + " secciones obligatorias de diseño rellenadas (sin TODO) — modelo de amenazas revisado.", "SEC: autenticación + autorización a nivel de objeto impuestas, denegar por defecto; ningún secreto en el código ni en los logs.", "SEC: SAST, auditoría de dependencias y pruebas de casos de abuso limpias en una ejecución local.");
      if (a.tracks.includes("privacy")) items.push("PRIVACIDAD: " + cnt("privacy", 6) + " secciones obligatorias de diseño rellenadas (sin TODO) — decisión sobre la EIPD registrada.", "PRIVACIDAD: acceso/exportación y supresión funcionan de extremo a extremo, en todos los almacenes y encargados.", "PRIVACIDAD: proceso de conservación programado; política de privacidad y registro de actividades de tratamiento actualizados.");
      if (a.tracks.includes("dist")) items.push("DIST: " + cnt("dist", 5) + " secciones obligatorias de diseño rellenadas (sin TODO) — cada escritura entre sistemas tiene su mitigación (outbox / inbox / saga) o un riesgo aceptado.", "DIST: consumidores idempotentes (inbox o una clave única en la transacción del efecto); reintentos con retroceso + jitter y una DLQ; nada no idempotente reintentado a ciegas.", "DIST: pruebas de inyección de fallos (caída entre el commit y la publicación, entrega duplicada, actualizaciones concurrentes, dependencia caída) en verde en una ejecución local.");
      if (a.tracks.includes("api")) items.push("API: " + cnt("api", 5) + " secciones obligatorias de diseño rellenadas (sin TODO) — el fichero del contrato (OpenAPI / .proto / esquema GraphQL) está en el repositorio y lo indica el marcador Implements de una tarea.", "API: errores en problem+json con códigos estables; las creaciones aceptan una Idempotency-Key; las actualizaciones respetan If-Match; los endpoints de listado paginan con un cursor estable.", "API: pruebas de contrato y la comparación de cambios incompatibles con la versión publicada en verde en una ejecución local; lo que se elimine queda obsoleto con una fecha de Sunset.");
      if (a.tracks.includes("ui")) items.push("UI: " + cnt("ui", 5) + " secciones obligatorias de diseño rellenadas (sin TODO) — cada estado de la matriz de estados diseñado; los componentes nuevos entran por el design system.", "UI: WCAG 2.2 AA — la comprobación automática de accesibilidad limpia en una ejecución local, más una pasada manual con teclado y lector de pantalla con los hallazgos corregidos.", "UI: adaptable en cada breakpoint, cadenas en el catálogo (expansión del texto, RTL comprobados); LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 medidos.");
      if (a.tracks.includes("obs")) items.push("OBS: " + cnt("obs", 5) + " secciones obligatorias de diseño rellenadas (sin TODO) — cada SLO tiene un presupuesto de errores, cada alerta un runbook, los criterios de reversión son números.", "OBS: las métricas, los logs estructurados (ID de correlación, sin datos personales) y las trazas que indica el diseño se emiten — vistos, no supuestos.", "OBS: una alerta saltó en un fallo escenificado, un simulacro de reversión hecho y las comprobaciones de salud verificadas con una dependencia caída.");
      if (a.tracks.includes("data")) items.push("DATA: " + cnt("data", 5) + " secciones obligatorias de diseño rellenadas (sin TODO) — cada conjunto de datos tiene un esquema, un responsable y una regla de compatibilidad; cada comprobación dice qué hace un fallo.", "DATA: las comprobaciones de calidad de datos se ejecutan en la ingesta y antes de publicar — una fila errónea queda en cuarentena, nunca se carga; el aviso de frescura llega al responsable.", "DATA: una reejecución de partición y un backfill ensayados con datos de tamaño real dan las mismas filas que una ejecución; retención y particionado aplicados según el diseño.");
      items.push("Doctor: `doctor` reporta readyToAdvance antes de cada gate.", "Todos los gates de fase aprobados (`approve`).");
      return "# Checklist: " + a.name + "\n\nTracks: " + a.label + ". Marca antes de dar la función por terminada.\n\n" +
        items.map((i) => "- [ ] " + i).join("\n") + "\n";
    },

    integrationPlan(name) {
      return (
`# Integration Plan: ${name}

## Puntos de Integración
- [Componentes/módulos existentes que esta función toca]

## Modificaciones Necesarias
- [Qué debe cambiar en el código existente, y por qué]

## Secuenciación
- Fase 1: [p.ej., migraciones de BD]
- Fase 2: [p.ej., servicio de backend]
- Fase 3: [p.ej., conectar la UI]

## Riesgos y Mitigaciones
- [Riesgo]: [mitigación / rollback]

## Archivos Afectados (mejor estimación)
- [ruta → cambio]
`
      );
    },

    promptStub(name) {
      return "# Prompt v1 — " + name + "\n\n## System\nEres un asistente útil para " + name + ". Sé preciso y conciso. Si no sabes, dilo. Rechaza solicitudes fuera de tu tarea.\n\n## User Template\n[mensaje del usuario / {{variables}}]\n";
    },
  };

// ===========================================================================
// Steering stubs, one set per language. Filenames stay constant; content localized.
// ===========================================================================
const steering = {
    "constitution.md":
      "# Constitución\n\nPrincipios innegociables que toda función debe cumplir. Mantenlos pocos, concretos y testeables.\nEl `doctor` y el `/prReview` verifican contra ellos; un diseño que viole un principio se bloquea.\n\n## Principios\n1. [p.ej., Toda escritura es idempotente o explícitamente justificada.]\n2. [p.ej., Sin PII en los logs; los IDs de usuario se pseudonimizan.]\n3. [p.ej., Sin cambio de API con ruptura sin una ruta de migración versionada.]\n4. [p.ej., Los errores fallan cerrados (denegar) en la ruta de seguridad.]\n5. [p.ej., Buscar antes de escribir: extender un módulo existente antes de crear uno nuevo.]\n\n## Restricciones\n- [Restricciones técnicas/regulatorias rígidas que limitan todos los diseños.]\n\n## Reglas de Decisión\n- [Cómo desempatar — p.ej., 'preferir lo aburrido/probado a lo ingenioso'.]\n",
    "product.md":
      "# Producto\n\n## Visión\n[Una frase: ¿qué es este producto y para quién es?]\n\n## Usuarios Objetivo\n- Primario: [¿quién usa esto a diario?]\n- Secundario: [¿quién más lo toca?]\n\n## Métricas de Éxito\n- [métrica específica a 6 meses]\n\n## No-objetivos\n- [lo que esto explícitamente NO es]\n\n## Modelo de Negocio\n[cómo genera ingresos]\n",
    "tech.md":
      "# Tecnología\n\n## Stack\n- Frontend: []\n- Backend: []\n- Base de Datos: []\n- Auth: []\n\n## Infraestructura\n- Hosting / Región / CDN: []\n\n## Convenciones\n- Lenguaje / formateo / test runner / migraciones / formato de commit: []\n\n## Restricciones\n- Versión de runtime / soporte de navegador / accesibilidad / regulatorio: []\n",
    "structure.md":
      "# Estructura del Proyecto\n\n## Layout\n[árbol de directorios]\n\n## Límites de Módulos\n- Qué expone cada módulo y qué puede importar: [p.ej., cada función expone un único punto de entrada; features/* importan lib/*, nunca entre sí; lib/* no importa ninguna función; sin ciclos]\n\n## Código Compartido\n- Dónde viven los helpers y componentes compartidos: [p.ej., src/lib/ para helpers y clientes, src/components/ para la UI] — buscar ahí antes de añadir uno; el código entra al segundo o tercer uso real.\n\n## Nomenclatura\n- Archivos / componentes / rutas de API / tablas de BD / métricas: []\n\n## Commits\nConventional commits: `type(scope): description`. Tipos: feat|fix|refactor|test|docs|chore|style|perf\n\n## Ramas y Revisiones\n- main + feature/<nombre>; revisiones obligatorias para merges a main.\n",
    "testing-standards.md":
      "# Estándares de Pruebas\n\n## Runner y Herramientas\n- Unit/Integración: []\n- E2E: []\n- Mocking: []\n\n## Política de Cobertura\n- Objetivo por defecto: []\n- Rutas críticas (auth/facturación/datos): 100% de ramas.\n\n## Disciplina TDD\n- Sin implementación antes de una prueba que falle ejercitando la ruta real.\n- 'Fallar por la razón correcta' = assertion/NotImplemented, no error de import/sintaxis.\n",
    "scale.md":
      "# Objetivos de Escala\n\n## Objetivos de Carga\n| Horizonte | Concurrentes | DAU | MAU | Pico RPS | Datos |\n|---|---|---|---|---|---|\n| Lanzamiento | | | | | |\n| 6 meses | | | | | |\n| 2 años | | | | | |\n\n## Objetivos de SLA\n| Clase de endpoint | P95 | P99 | Disponibilidad |\n|---|---|---|---|\n| Recorrido crítico | | | |\n\n## Recorridos Críticos de Usuario\n1. []\n\n## Umbrales de Escalado\n- []\n",
    "observability.md":
      "# Estándares de Observabilidad\n\n## Logging\nJSON estructurado. Campos obligatorios: ts, level, service, trace_id, span_id, tenant_id?, user_id?, msg, event. Sin secrets/PII.\n\n## Métricas\nEstilo Prometheus snake_case + sufijo de unidad. Por función: conteo de solicitudes, histograma de duración, conteo de errores, un contador de negocio. Cuidado con la cardinalidad de labels.\n\n## Traces\nOpenTelemetry, contexto W3C. Muestrea 10% en prod, muestrea siempre los errores.\n\n## Alertas (cada una liga a un runbook)\n- P0 alerta inmediata (page) / P1 ≤15min / P2 slack / P3 digest.\n\n## SLOs y Presupuestos de Error\n- Por recorrido crítico: el SLI, el objetivo del SLO y su ventana · la política del presupuesto de errores (qué se detiene cuando se agota).\n- Alertas por tasa de consumo: las rápidas avisan (p. ej., 14,4× en 1 h, 6× en 6 h), la lenta (p. ej., 1× en 3 días) abre un ticket.\n\n## Despliegue y Reversión\n- Feature flags: un dueño y una fecha de retirada cada una · pasos del canario / despliegue progresivo y las métricas que los deciden · criterios y un tiempo objetivo de reversión.\n\n## Salud y Capacidad\n- La comprobación de vida solo verifica el proceso, la de disponibilidad las dependencias · señales de capacidad (saturación, profundidad de colas, uso de pools) con umbrales.\n",
    "cost.md":
      "# Presupuesto de Coste\n\n## Presupuesto de Infraestructura\nObjetivo: < $XX/mes en el año 1.\n\n## Objetivo de Coste Por Usuario\nObjetivo: < $0,50 por MAU. Si se excede, para y optimiza.\n\n## Alertas de Coste\n- Diario > $100 slack / > $200 alerta inmediata (page).\n\n## Revisión de Coste Por Función\nCada Presupuesto de Coste en el design.md estima $/1000 usuarios/mes y señala rutas críticas de coste.\n",
    "ai-strategy.md":
      "# Estrategia de IA\n\n## Lista de Modelos\n| Rol | Modelo (ID fijado) | Por qué |\n|---|---|---|\n| Primario | | |\n| Fallback | | |\n| Juez/calificador | | |\n\n## Postura de Proveedor y Datos\n- Proveedor / estado del DPA / la PII llega al modelo: []\n\n## Disciplina de Prompt\n- Prompts en .specs/<feature>/prompts/vN.md, versionados. Ningún cambio se lanza sin volver a ejecutar los evals.\n\n## Presupuesto de Coste\n- Objetivo $/acción de usuario / umbral de alerta rígido: []\n\n## Postura de Seguridad\n- Defensa contra inyección / moderación / política de rechazo: []\n\n## Barra de Evaluación (criterios para lanzar)\n- Golden ≥85% bueno · Seguridad adversarial 100% rechazado · Regresión 100% mantenida.\n\n## Ciclo de Vida\n- Política de fijación / vigilancia de descontinuación / migración con gate de evaluación.\n",
    "security.md":
      "# Estándares de Seguridad\n\n## Nivel de Garantía\n- Nivel OWASP ASVS objetivo: [L1 | L2 | L3] — por qué: []\n\n## Modelado de Amenazas\n- Método: STRIDE por componente y frontera de confianza, revisado en cada cambio de diseño.\n- Dónde viven los modelos de amenazas: en el design.md de cada función +sec → Modelo de Amenazas.\n\n## Autenticación y Autorización\n- Proveedor de identidad / modelo de sesión: []\n- Modelo de autorización (RBAC / ABAC / comprobación de propiedad), denegar por defecto: []\n\n## Secretos y Criptografía\n- Almacén de secretos: [] — nunca en el código, en configuración versionada, en logs ni en tickets.\n- Cifrado en reposo / en tránsito (versión de TLS, rotación de claves): []\n\n## Reglas de Código Seguro\n- Validar la entrada en las fronteras de confianza; codificar la salida; solo queries parametrizadas.\n- Ningún secreto, token ni stack trace en respuestas o logs.\n\n## Pruebas de Seguridad (locales)\n- SAST: [] · auditoría de dependencias: [] · análisis de secretos: [] · DAST (servicios expuestos): []\n- Cada amenaza relevante tiene una prueba de caso de abuso.\n\n## Gestión de Vulnerabilidades\n- Plazos de corrección por severidad (crítica / alta / media): [] · quién hace el triaje: []\n",
    "privacy.md":
      "# Estándares de Privacidad (RGPD)\n\n## Roles\n- Responsable del tratamiento: [] · DPD / contacto de privacidad: [] · autoridad de control: [p.ej., AEPD]\n\n## Principios (RGPD, art. 5)\n- Licitud, lealtad y transparencia · limitación de la finalidad · minimización de datos · exactitud · limitación del plazo de conservación · integridad y confidencialidad · responsabilidad proactiva.\n\n## Registro de Actividades de Tratamiento (art. 30)\n- Dónde está el registro de actividades de tratamiento: []\n\n## Bases Jurídicas en Uso (art. 6)\n- [actividad de tratamiento → base jurídica]\n\n## Plazos de Conservación\n| Categoría de datos | Plazo de conservación | Método de supresión |\n|---|---|---|\n| | | |\n\n## Solicitudes de los Interesados\n- Canal · verificación de identidad · plazo de un mes (art. 12.3) · responsable: []\n\n## Encargados y Transferencias\n- Encargados aprobados (contratos del art. 28): [] · transferencias fuera del EEE y su garantía: []\n\n## Protección de Datos desde el Diseño (art. 25)\n- Por defecto: recoger lo mínimo, seudonimizar siempre que sea posible, sin datos personales en los logs.\n\n## Respuesta a Brechas de Datos\n- Notificar a la autoridad de control en un plazo de 72 horas (art. 33) · runbook: []\n",
    "distributed.md":
      "# Estándares de Sistemas Distribuidos y Consistencia de Datos\n\n## Garantía de Entrega\n- Por defecto: al menos una vez — todos los consumidores son idempotentes. \"Exactamente una vez\" es un efecto de la idempotencia, nunca una promesa del broker.\n- Orden: por clave (partición / grupo de mensajes) solo donde una función lo pide: []\n\n## Escrituras entre Sistemas\n- Una escritura que toca más de un sistema (BD + broker, BD + caché, BD + API externa) pasa por un outbox transaccional (o CDC) — nunca \"commit y después publicar\".\n- Transacciones de negocio entre servicios: una saga con una compensación por paso; orquestación o coreografía: []\n\n## Idempotencia\n- Origen de la clave de idempotencia (cabecera del cliente / ID del mensaje / clave natural): [] · dónde viven las claves procesadas (tabla inbox / restricción de unicidad) y durante cuánto tiempo: []\n\n## Política de Reintentos (valores por defecto)\n- Retroceso exponencial con jitter · máximo de intentos: [] · tiempo de espera por llamada: []\n- Nunca se reintenta: una llamada no idempotente sin clave, un error de validación (un 4xx — pero 408 y 429 se reintentan, respetando el Retry-After) · mensajes envenenados → DLQ tras [] intentos, con alerta.\n\n## Política de Bloqueo\n- Por defecto: bloqueo optimista (una columna de versión); pesimista (SELECT … FOR UPDATE) solo en secciones cortas y muy disputadas · tiempo de espera del bloqueo: []\n\n## Consistencia por Defecto\n- Nivel de aislamiento por defecto: [] · dónde se acepta la consistencia eventual y el retraso máximo: [] · leer las propias escrituras para el usuario que escribió.\n\n## Observabilidad\n- Retraso del outbox, retraso de los consumidores, profundidad de la DLQ y número de reintentos son métricas con alertas: []\n",
    "api.md":
      "# Estándares de API\n\n## Estilo y Contrato\n- Estilo: [REST | GraphQL | gRPC] · el contrato está en: [openapi.yaml | proto/ | schema.graphql] — escrito primero, revisado antes de los handlers.\n- Nombres: sustantivos en plural para las colecciones · campos en [snake_case | camelCase] · fechas en ISO 8601 UTC · IDs como strings.\n\n## Versionado y Compatibilidad\n- Estrategia: [URL /v1 | cabecera | fecha] · solo cambios aditivos dentro de una versión · un cambio incompatible sale en una nueva versión.\n- Obsolescencia: las cabeceras Deprecation y Sunset, al menos [6 meses] de aviso, una entrada en el changelog, el uso seguido por cliente.\n\n## Errores\n- application/problem+json (RFC 9457): type, title, status, detail, instance + un `code` estable; un error de validación lista cada campo. Ningún stack trace en una respuesta.\n\n## Paginación, Idempotencia y Concurrencia\n- Paginación por cursor (un cursor opaco, como máximo [100] elementos por página) · una Idempotency-Key en cada creación no idempotente, guardada durante [24 h] · ETag / If-Match en las actualizaciones (412 en una versión obsoleta).\n\n## Límites de Tasa\n- Por [clave de API | usuario | IP]: [N] peticiones por [ventana] · 429 con Retry-After y las cabeceras RateLimit.\n\n## Comprobaciones (locales)\n- Pruebas de contrato: [comando] · comparación de cambios incompatibles con el contrato publicado: [comando].\n",
    "ui.md":
      "# Estándares de Interfaz\n\n## Design System\n- Componentes: [biblioteca / URL de Storybook] · tokens: [color, espaciado, tipografía — dónde están] · un componente nuevo entra primero en el sistema (documentado, revisado), nunca como pieza suelta.\n\n## Estados\n- Cada vista diseña: cargando · vacío · error (con Reintentar) · parcial · sin conexión · sin permiso · éxito.\n- Formularios: errores en el campo + un resumen, los valores conservados en un error, el botón de enviar nunca es la única señal.\n\n## Accesibilidad\n- Objetivo: WCAG 2.2 AA · operable con el teclado, foco visible · cada control con nombre · contraste 4,5:1 (texto) / 3:1 (interfaz) · objetivos ≥ 24×24 px · prefers-reduced-motion respetado.\n- Comprobaciones: [comando axe / Lighthouse] en cada ejecución local · una pasada manual con teclado + lector de pantalla ([NVDA / VoiceOver]) por función.\n\n## Diseño Adaptable e i18n\n- Breakpoints: [360 / 768 / 1280 px] · expansión del texto +30–40 % · RTL: [sí / no] · fechas, números y moneda según el locale.\n\n## Presupuesto de Rendimiento\n- Core Web Vitals (p75): LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1 · JS por ruta ≤ [170 KB gz] · medido con: [Lighthouse en local / RUM].\n",
    // 1.21 F4 — +data
    "data.md":
      "# Estándares de Pipelines de Datos\n\n## Contratos y Esquemas\n- Dónde están los esquemas: [YAML de dbt | un registro de esquemas | schemas/] · compatibilidad: solo cambios aditivos; un cambio incompatible sale en una versión nueva con [N semanas] de retirada.\n- Nombres: tablas y columnas en [snake_case] · fechas y horas en UTC · las capas: [raw → staging → marts].\n\n## Calidad de los Datos\n- Cada conjunto de datos: claves no nulas y únicas, valores y rangos aceptados, comprobaciones de anomalías en el recuento de filas · se ejecutan en la ingesta y antes de publicar · un fallo: [poner las filas en cuarentena | detener la carga] y avisar al responsable.\n- Herramienta: [pruebas dbt | Great Expectations | comprobaciones SQL] · comando: [comando].\n\n## Idempotencia y Backfills\n- Cada job reejecutable para una partición: sobrescribir la partición o MERGE sobre una clave — nunca un append a ciegas · datos que llegan tarde: una ventana de lookback de [N días].\n- Backfills: primero una ejecución de prueba · como máximo [N] particiones en paralelo · el coste estimado y aprobado por [rol].\n\n## Linaje y Responsables\n- Cada conjunto de datos tiene un responsable y un SLA de frescura · el linaje está en: [dbt docs | el catálogo de datos] · los consumidores conocen un cambio incompatible con [N días] de antelación.\n\n## Retención y Coste\n- Retención por capa: bruta [N días] · curada [N meses] — datos personales según privacy.md · particionado por [fecha], agrupado por [clave] · presupuesto de coste: [importe al mes], con una alerta al [N] %.\n",
    "glossary.md":
      "# Glosario\n\n<!-- El lenguaje ubicuo del producto: una entrada por término del dominio — la palabra que usan las specs, lo que significa\n     aquí y las palabras que NO se usan para él. spec_clarify pregunta por cada palabra a evitar que encuentre en el\n     requirements.md / design.md de una función, spec_doctor avisa (comprobación `glossary`) y spec_task_brief cita las entradas\n     que usan los criterios de una tarea. Una entrada por línea (el marcador `_Avoid:_` se queda en inglés), por ejemplo:\n     - **Cliente** — una persona o empresa con un contrato firmado. _Avoid: comprador, consumidor_ -->\n\n- **[Término]** — [lo que significa en este producto]. _Avoid: [palabra], [palabra]_\n",
  };

// The evals README is a single block per language (kept out of the per-language BUILD map
// because it carries no track logic).
const evalsReadme = "# Evals\n\n" +
    "Harness de evaluación local, apto para uso sin conexión. Ejecútalo desde la raíz del proyecto:\n\n" +
    "```\nnode <plugin>/mcp/evals/run-evals.js <slug-de-la-función>\n```\n\n" +
    "- Usa tu propio `ANTHROPIC_API_KEY` (env). Sin CI, sin terceros más allá de tu proveedor de modelo.\n" +
    "- Sin clave de API (o con `--dry-run`) valida los conjuntos e imprime el plan sin llamar a un modelo.\n" +
    "- `--set-baseline` registra las puntuaciones actuales como baseline para comparar con ejecuciones futuras.\n\n" +
    "Archivos de conjunto: `golden.json`, `adversarial.json`, opcional `regression.json`.\n" +
    "Formato de ítem: `{ id, input, expect: { type, value|rubric } }`. Tipos de grader: contains | equals | regex | refuse | judge.\n" +
    "El system prompt se lee del `../prompts/vN.md` más reciente (su sección `## System`).\n";

// ===========================================================================
// Human-readable tool messages (doctor / clarify / next-action / add-track /
// init notes / hook output). Functions so callers interpolate freely.
// ===========================================================================
const msg = {
    initNote: "Los stubs son placeholders. La skill los rellena con contenido real (ver references/steering-templates.md).",
    createNote: () => null,
    addTrackNote: (tr, slug) => `+${tr} añadido. Rellena las nuevas secciones de diseño y vuelve a ejecutar /spec-doctor ${slug}.`,
    addTrackAlready: (tr) => `ya tiene +${tr}`,
    notes: {
      scan: "Solo un inventario heurístico — el agente lo interpreta para inferir el steering/constitución y hacer ingeniería inversa de las specs.",
      coverage: "Heurística a partir de la intención declarada: la parte de los ficheros de código (sin las pruebas) nombrados por un marcador _Implements:_ de alguna función, activa o archivada. Un fichero cuenta como cubierto cuando una tarea lo reclama — mantén los _Implements:_ al día.",
    },
    evidence: {
      failed: (n, code) => `Tarea ${n}: la verificación falló (exit ${code}) — no se marca como hecha.`,
      missing: (n, slug) => `La tarea ${n} tiene un comando _Verify:_ pero no se registró evidencia — pasa la evidencia (comando, exit code, resumen) o ejecuta: ${DEV_SPEC} done ${slug} ${n} --run`,
      ran: (cmd, code) => `ejecutado: ${cmd} → exit ${code}`,
      failedTicked: (n, code) => `La tarea ${n} ya está marcada, pero su nueva verificación falló (exit ${code}) — se ha registrado; cuenta como no verificada hasta que se registre una ejecución correcta.`,
      badExit: (v) => `exitCode debe ser un entero (recibido '${v}').`,
      needsExit: "Una evidencia que indica un comando necesita su exit code — o da solo un resumen, para una verificación manual.",
    },
    finish: {
      ready: (slug) => `'${slug}' está lista para cerrar — confirma las verificaciones de abajo y luego haz merge local o mantén la rama.`,
      notReady: (slug) => `'${slug}' aún no está lista para cerrar:`,
      doctor: (ids) => `el doctor tiene verificaciones bloqueantes: ${ids}`,
      open: (list) => `tareas pendientes: ${list}`,
      unverified: (list) => `tareas marcadas sin evidencia de verificación: ${list}`,
      gates: (list) => `fases esperando aprobación: ${list}`,
      noTasks: "aún no hay tareas — primero desglosa el diseño en tareas",
      checkSuite: "La suite de pruebas COMPLETA está en verde en una ejecución nueva (pega el comando y la salida).",
      checkLoad: "+saas: la prueba de carga cumple el presupuesto de rendimiento (load-test.md).",
      checkObs: "+saas: observabilidad validada — métricas emitiéndose, logs visibles, alertas y dashboard configurados.",
      checkCost: "+ai: el coste real en tokens está a ~20% de la proyección del diseño.",
      checkSafety: "+ai: conjunto adversarial completo ejecutado, 100% en las categorías críticas de seguridad, ~20 salidas revisadas por una persona.",
      checkBug: "bugfix: los pasos de reproducción de bug.md ya no reproducen el bug.",
      prSummary: "## Resumen",
      prAcs: "## Criterios de aceptación",
      prTasks: "## Tareas",
      prTests: "## Pruebas",
      prChecks: "## Verificaciones antes del merge",
      prSpec: "## Spec",
      prRootCause: "## Causa raíz",
      prFix: "## Corrección",
      noEvidence: "sin evidencia registrada",
      changedByDate: (list, slug) => `juzgado solo por la fecha del fichero (aprobado antes de las huellas de contenido — un clon o una copia restablece las fechas, así que puede no ser una edición): ${list} — revísalo y vuelve a aprobar para seguirlo por contenido (/approve ${slug} <fase>)`,
      untrackedApproval: (list, slug) => `aprobado antes del registro de cambios — no se registró nada del fichero aprobado, así que una edición no puede detectarse: ${list} — vuelve a aprobar para empezar a seguirlo (/approve ${slug} design)`,
    },
    // 1.21 F5 — rigor a medida (el EN es la referencia): tamaños (spec_create {size}), el cambio (tamaño xs, un change.md).
    sizes: {
      spikeNoSize: "Un spike tiene plazo, no tamaño — créalo sin tamaño (su plazo lo acota).",
      changeSize: (size) => `kind "change" es tamaño xs — para el tamaño ${size} crea una función: spec_create {kind: "feature", size: "${size}"}.`,
      changeTracks: (list) => `Un cambio (tamaño xs) es solo core — un track (${list}) lo convierte en una función de tamaño s: spec_create {size: "s", tracks} (un diseño corto con las secciones de los tracks, una tarea por criterio).`,
      changeNoTracks: (slug) => `'${slug}' es un cambio (tamaño xs, solo core) — un track lo convierte en función: crea una de tamaño s (spec_create {size: "s", tracks}) y archiva este cambio (spec_feature {action: "archive"}).`,
      tracksIgnored: (list, slug) => `Tracks no añadidos — ${list}: '${slug}' es un cambio (tamaño xs, solo core); un track lo convierte en función — crea una de tamaño s (spec_create {size: "s", tracks}) y archiva este cambio (spec_feature {action: "archive"}).`,
      changeCreated: (slug) => `'${slug}' es un cambio (tamaño xs): UN archivo, .specs/${slug}/change.md — su resumen, 1–3 criterios EARS, el enfoque y 1–3 tareas con _Verify:_. Rellénalo y aprueba el plan en una sola llamada (spec_approve {name: "${slug}", through: "tasks"}); tras las tareas, spec_finish y el cierre de la ejecución.`,
      sizeKept: (kept, asked) => `El tamaño de esta función es ${kept} — se mantiene (pediste ${asked}): el tamaño se elige una vez, al crear la función.`,
      noGate: (phase, slug) => `'${slug}' es un cambio: sus únicas aprobaciones son el plan (fase tasks — change.md) y el cierre de la ejecución — no hay fase ${phase} que aprobar.`,
      scope: (acs, tasks, maxAcs, maxTasks, extra) => `un cambio es XS — 1–${maxAcs} criterios de aceptación y 1–${maxTasks} tareas, solo core; change.md tiene ${acs} criterios y ${tasks} tarea(s)${extra ? ` y el/los track(s) ${extra}` : ""} — créalo como función de tamaño s (spec_create {size: "s"}) y archiva este cambio`,
      scopeOk: (acs, tasks) => `XS: ${acs} criterios, ${tasks} tarea(s)`,
      approvePlan: (slug) => `Revisa y aprueba el plan (change.md: sus criterios, el enfoque y las tareas) — spec_approve {name: "${slug}", through: "tasks"} (/spec-ff ${slug}).`,
      planFastForward: (slug, size, list) => `Tamaño ${size}: rellena primero el plan entero — ${list} — y luego apruébalo en una sola llamada: spec_approve {name: "${slug}", through: "tasks"} (/spec-ff ${slug}; CLI: ${DEV_SPEC} approve ${slug} --through tasks). El gate de cada fase se sigue ejecutando, en orden; el primero que rechaza lo detiene y dice por qué.`,
      planFastForwardTests: (slug, size, list, through, what) => `Tamaño ${size}: rellena primero el plan entero — ${list} — y luego apruébalo hasta ${through} en una sola llamada: spec_approve {name: "${slug}", through: "${through}"} (/spec-ff ${slug} ${through}; CLI: ${DEV_SPEC} approve ${slug} --through ${through}). El gate de cada fase se sigue ejecutando, en orden. Después la Fase 4, cuyo gate necesita trabajo que llega después del plan: ${({ tdd: "escribe las pruebas que fallan", ai: "escribe el harness de evals y los conjuntos de evaluación propios de la función", both: "escribe las pruebas que fallan y los conjuntos de evaluación propios de la función" })[what] || "escribe las pruebas que fallan"} (/writeTests ${slug}), aprueba las pruebas (/approve ${slug} tests) y luego las tareas (/approve ${slug} tasks).`,
      templateApproved: (list) => `solo la orientación de la plantilla en: ${list} — el diseño se aprobó antes de la regla más estricta de 1.21, así que es un aviso; su próxima aprobación pide ahí texto propio (o una línea "n/a — <por qué no aplica>")`,
      sectionsPassSized: (filled, covered, optional) => `rellenadas: ${filled}` + (covered ? ` · cubiertas por la sección de otro track: ${covered}` : "") + (optional ? ` · opcionales en este tamaño, omitidas: ${optional}` : ""),
      extendedComment: (marker, names) => `Tamaño s: las demás secciones ${marker} — ${names} — son opcionales en este tamaño. Añade una cuando aplique (entonces debe rellenarse), o respóndela en una línea: "n/a — <por qué no aplica>".`,
      coveredComment: (label) => `Esta sección también responde a ${label} — los dos tracks están activos, así que basta una sección (una sección ${label} propia también cuenta).`,
      suggest: {
        "trivial-change": "Tamaño sugerido xs — un cambio trivial (una errata, un texto o una configuración, un arreglo de una línea): un cambio, un change.md, dos aprobaciones.",
        "single-unit": "Tamaño sugerido s — una unidad de trabajo (un endpoint, pantalla, botón, campo…) con como mucho un track con secciones de diseño: una historia, las secciones core de los tracks, el plan aprobado en una sola llamada.",
        "several-tracks": "Tamaño sugerido l — tres o más tracks con secciones de diseño: la cadena completa.",
        "public-api": "Tamaño sugerido l — una API pública (consumidores externos, un contrato que mantener): la cadena completa.",
        "cross-system": "Tamaño sugerido l — cruza sistemas (+dist con otro track, o varios servicios): la cadena completa.",
        default: "Tamaño sugerido m — una función con su cadena completa (las secciones repetidas de los tracks fusionadas).",
      },
      optionalMark: "opcional en este tamaño",
      coveredMark: "cubierta por otro track",
      suggestTail: "Confírmalo o elige otro en la Fase 0 — spec_create {size: xs | s | m | l}; sin tamaño se mantiene el scaffold anterior a 1.21.",
    },
    kindKept: (kept, asked) => `Esta función ya es del tipo '${kept}' — se mantiene (pediste '${asked}'). Crea otra para un tipo distinto.`,
    langKept: (kept, asked) => `Esta función ya está en '${kept}' — se mantiene (pediste '${asked}'). Una función, un idioma.`,
    // 1.21 F3 — spec_create {kind: "bugfix"}: prerrelleno (reproduction · rootCause · condition · behaviour — nombres en inglés).
    bugPrefill: {
      bugOnly: (key) => `${key} es un dato de bugfix — pasa kind: "bugfix" (rellena bug.md y el criterio de regresión).`,
      bugOnlyCli: (flag) => `${flag} es un dato de bugfix — créala como bugfix: ${DEV_SPEC} bugfix "<nombre>" ${flag} "…" (o --kind bugfix); rellena bug.md y el criterio de regresión.`,
      oneLine: (key, max) => `${key} debe ser una sola línea de como máximo ${max} caracteres (va al criterio EARS).`,
      skipped: (list) => `No se rellenó — ${list}: el archivo ya existía o vino de una plantilla del proyecto (solo crea); escribe esos textos en él.`,
    },
    err: {
      noUsableName: (name) => `El nombre de función '${name}' no tiene caracteres utilizables (a-z, 0-9) para un nombre de carpeta.`,
      reserved: (slug) => `'${slug}' es un nombre reservado — elige otro nombre para la función.`,
      reservedWin: (slug) => `'${slug}' es un nombre reservado en Windows — elige otro nombre para la función.`,
      notFound: (slug, root) => `Función '${slug}' no encontrada en ${root}`,
      archivedHint: (slug) => `— está archivada (.specs/_archive/${slug}): restáurala primero (${DEV_SPEC} feature restore ${slug}).`,
      invalidJson: (rel, detail) => `${rel} no es JSON válido (${detail}) — corrígelo a mano; no se sobrescribirá.`,
      tasksMissing: (slug) => `tasks.md no encontrado para '${slug}'`,
      requirementsMissing: (slug) => `requirements.md no encontrado para '${slug}'`,
      taskNotFound: (n, file = "tasks.md") => `Tarea ${n} no encontrada en ${file}`,
      featureBusy: (slug, rel) => `Otro proceso de dev-spec está actualizando '${slug}' en este momento (${rel || `.specs/${slug}/.lock`}) — no se ha cambiado nada; vuelve a intentarlo en un momento. Si no hay otro editor ni comando de dev-spec en marcha, borra ese archivo.`,
      roadmapBusy: "Otro proceso de dev-spec está actualizando .specs/roadmap.json en este momento (.specs/.roadmap.lock) — no se ha cambiado nada; vuelve a intentarlo en un momento. Si no hay otro editor ni comando de dev-spec en marcha, borra ese archivo.",
      folderInUse: (rel) => `La carpeta ${rel} está en uso por otro programa (un editor, un indexador o antivirus, una terminal abierta dentro) — no se ha movido ni borrado nada; ciérralo y vuelve a intentarlo.`,
      lockStuck: (rel) => `Un bloqueo de dev-spec abandonado (${rel}) no se ha podido eliminar — el archivo (o una carpeta con ese nombre) está abierto en otro programa, es de solo lectura o no es un archivo. No se ha cambiado nada. Borra ${rel} a mano (revisa sus permisos) y vuelve a intentarlo.`,
      numberInt: "el número debe ser un entero",
      noText: "No se ha proporcionado texto.",
      unknownPhase: (phase, known) => `Fase desconocida '${phase}'. Conocidas: ${known}`,
      alreadyArchived: (slug) => `'${slug}' ya está archivada (.specs/_archive/${slug}). Elimínala de allí primero.`,
      renameNeedsName: "para renombrar hace falta un nombre nuevo.",
      sameSlug: "El nombre nuevo da el mismo slug.",
      alreadyExists: (slug) => `'${slug}' ya existe.`,
      badAction: "la acción debe ser: remove | archive | rename | restore | flow",
      badTrack: "el track debe ser: tdd | saas | ai | sec | privacy | dist | api | ui | obs | data",
      cycle: (chain) => `Dependencia circular: ${chain}`,
      nameRequired: "el nombre es obligatorio",
      noSpecs: (root) => `No hay .specs/ en ${root}`,
      notGenerated: (file) => `${file} existe y no lo generó dev-spec — no se ha modificado.`,
      unknownSteering: (file, known) => `Fichero de steering desconocido '${file}'. Conocidos: ${known}`,
    },
    ears: {
      needsClar: "Marcador [NEEDS CLARIFICATION] sin resolver — resuélvelo antes del diseño.",
      noModal: "El criterio no tiene verbo modal (SHALL / DEVE / DEBE) — no es una frase EARS válida.",
      noId: "El criterio no tiene ID estable (p. ej., US-1.AC-1).",
      vague: (term) => `Término vago '${term}' — sustitúyelo por un valor concreto y comprobable.`,
      noKeyword: "Sin palabra clave EARS (WHEN/WHILE/IF/WHERE · QUANDO/ENQUANTO/SE/ONDE · CUANDO/MIENTRAS/SI/DONDE). Aceptable en requisitos ubicuos; confirma que es intencionado.",
    },
    classify: {
      conf: { high: "alta", medium: "media", none: "ninguna" },
      core: "core: siempre activo (toda función en modo Spec).",
      on: (t, conf, list, neg) => `+${t}: ACTIVO${conf ? ` [confianza ${conf}]` : ""} — señales encontradas: ${list}.${neg ? ` (${neg} apareció negado.)` : ""}`,
      off: (t, neg) => `+${t}: inactivo — ${neg ? `${neg} apareció negado.` : "ninguna señal encontrada."}`,
      substantial: "Ninguna señal de track, pero la descripción es sustancial — considera si aplica +tdd (corrección/casos límite).",
      weakOnly: (list) => `Activo solo por señales débiles — compruébalo: ${list}.`,
      possible: (t, sig) => `Posible +${t} — señal débil '${sig}' (necesita corroboración; no se ha activado).`,
      genericOnly: (t, list) => `Posible +${t} — solo palabras comunes de aplicación (${list}): ninguna nombra ${({ api: "un contrato de API (una API pública, OpenAPI / GraphQL / gRPC, un cambio incompatible…)",
        ui: "una cuestión de interfaz propia (un design system, la accesibilidad, un componente de UI, un estado vacío o de carga…)", obs: "una cuestión de operabilidad (un SLO, alertas, guardias, un runbook, un despliegue gradual…)",
        data: "una cuestión de pipeline de datos (un data warehouse, un job ETL / ELT, comprobaciones de calidad de datos, un backfill, linaje…)" })[t] ||
        "un segundo sistema (un broker, otro servicio, un webhook…)"}; no se ha activado.`,
      keptOff: (t, kw) => `+${t} se mantiene inactivo — '${kw}' apareció negado.`,
      onAlthough: (t, quoted, list) => `+${t} está ACTIVO aunque ${quoted} apareció negado — activado por: ${list}. Confirma que es intencionado.`,
      // 1.21 F2 — los ajustes de señales del proyecto (.specs/classifier.json) y classify --explain
      overridesApplied: (list) => `Los ajustes de señales de este proyecto cambiaron la lectura (.specs/classifier.json): ${list.map((o) => `'${o.word}' para +${o.track} → ${({ off: "ninguna señal", weak: "una señal débil", strong: "una señal fuerte" })[o.effect]}`).join(", ")} — ${DEV_SPEC} signals list los muestra todos.`,
      overridesInvalid: (code, n) => `.specs/classifier.json ${code === "invalid-entries" ? `tiene ${n} entrada(s) no válida(s) (ignorada(s))` : `se ha ignorado (${({ "invalid-json": "no es JSON válido", "invalid-shape": "sin lista \"signals\"", "too-big": "demasiado grande", "not-a-file": "no es un archivo normal", unreadable: "ilegible" })[code] || code})`} — ${DEV_SPEC} signals list dice qué corregir.`,
      explainHead: "Palabras clave encontradas (track · palabra clave · nivel de la tabla → nivel final):",
      explainNone: "Ninguna palabra clave encontrada.",
      explainMatch: (m) => `  +${m.track} '${m.keyword}'${m.text.toLowerCase() !== m.keyword.toLowerCase() ? ` ("${m.text}")` : ""} · ${m.base || "—"} → ${({ shadowed: "absorbida (dentro de una expresión fuerte más larga)", none: "ninguna señal (una pista de contexto)", unbacked: "contexto, sin otra señal que lo respalde" })[m.tier] || m.tier}${m.cue ? " (una pista de contexto)" : ""}${m.override ? " (un ajuste del proyecto)" : ""}${m.negated ? ` · negada (${({ before: "una negación antes", after: "una expresión después", list: "una lista negada" })[m.negation] || m.negation})` : ""}`,
      explainOverridesHead: (n, min) => `Ajustes de señales del proyecto (.specs/classifier.json — ${n}; uno aprendido se aplica tras ${min} correcciones coherentes):`,
      explainOverride: (o, min) => `  +${o.track} '${o.word}' → ${o.effect} · ${o.origin === "set" ? "fijado a mano" : `aprendido, ${o.count} corrección(es)`}${o.active ? "" : ` · pendiente (${o.count} de ${min})`}${o.applied ? " · aplicado aquí" : ""}`,
      explainNoOverrides: "Ajustes de señales del proyecto: ninguno (.specs/classifier.json).",
    },
    // 1.21 F2 — spec_tracks {action: "signals"} / dev-spec signals, y lo que spec_create aprende de una corrección de la Fase 0
    signals: {
      learnedPending: (t, w, e, n, min) => `Corrección de la Fase 0 registrada: '${w}' ${e === "off" ? `sugirió +${t} y lo dejaste inactivo` : `era solo una pista para +${t} y lo añadiste`} (${n} de ${min} — tras ${min} correcciones coherentes ${e === "off" ? `deja de sugerir +${t}` : `pasa a ser ${({ weak: "una señal débil", strong: "una señal fuerte" })[e]} de +${t}`} en este proyecto; ${DEV_SPEC} signals list).`,
      learnedActive: (t, w, e, n) => `Aprendido de ${n} correcciones coherentes de la Fase 0: '${w}' ${e === "off" ? `deja de sugerir +${t}` : `es ${({ weak: "una señal débil", strong: "una señal fuerte" })[e]} de +${t}`} en este proyecto (.specs/classifier.json — para deshacerlo: ${DEV_SPEC} signals forget ${t} "${w}").`,
      learnedDropped: (t, w, e) => `Esta elección de la Fase 0 contradice el ajuste '${w}' → ${e} para +${t}: eliminado (.specs/classifier.json).`,
      learnFailed: (code) => `La corrección de la Fase 0 no se ha registrado — ${code === "busy" ? ".specs/ está ocupado (otro proceso tiene el bloqueo)" : `.specs/classifier.json no se puede reescribir (${code}); ${DEV_SPEC} signals list dice qué corregir`}.`,
      capped: (max) => `.specs/classifier.json está lleno (${max} ajustes, todos vigentes) — olvida uno (${DEV_SPEC} signals forget <track> <palabra>) para registrar más.`,
      badOp: (op) => `Operación de señales desconocida '${op}' — una de: list, set, forget.`,
      needTrackWord: (op) => `signals ${op} necesita un track y una palabra — ${DEV_SPEC} signals ${op} <track> <palabra>${op === "set" ? " off|weak|strong" : ""} (spec_tracks {action: "signals", op: "${op}", track, word${op === "set" ? ", effect" : ""}}).`,
      coreTrack: "core siempre está activo — no tiene señales que ajustar.",
      badTrack: (t, list) => `No hay un track '${t}' en este proyecto — uno de: ${list}.`,
      badWord: (w) => `'${w}' no es una palabra de señal — letras y dígitos, con espacios, guiones, apóstrofos o puntos en medio, 2–60 caracteres (una palabra literal, nunca un patrón).`,
      badEffect: (e) => `Efecto desconocido '${e}' — uno de: off (ninguna señal), weak (un ancla: necesita una segunda señal), strong (activa el track por sí solo).`,
      notFound: (t, w) => `No hay un ajuste '${w}' para +${t} en .specs/classifier.json — ${DEV_SPEC} signals list los muestra.`,
      setDone: (t, w, e, prev) => `Fijado: '${w}' → ${e} para +${t} (${({ off: "ninguna señal", weak: "una señal débil", strong: "una señal fuerte" })[e]}; se aplica desde ahora en este proyecto)${prev ? ` — era ${prev}` : ""}.`,
      forgotten: (t, w, e) => `Olvidado: '${w}' → ${e} para +${t} — vuelven a aplicarse las señales de serie.`,
      listHead: (rel, n, active, min) => `${rel} — ${n} ajuste(s) de señales, ${active} vigente(s) (uno aprendido se aplica tras ${min} correcciones coherentes de la Fase 0):`,
      listNone: (rel) => `Ningún ajuste de señales (${rel}) — spec_create los aprende de las correcciones de la Fase 0; ${DEV_SPEC} signals set <track> <palabra> off|weak|strong fija uno.`,
      listItem: (o, min) => `  +${o.track} '${o.word}' → ${o.effect} · ${o.origin === "set" ? "fijado a mano" : `aprendido, ${o.count} corrección(es)`} · ${o.active ? "vigente" : `pendiente (${o.count} de ${min})`}${o.unknownTrack ? " · ese track ya no existe en este proyecto (sin uso)" : ""}${o.lastAt ? ` · ${o.lastAt.slice(0, 10)}` : ""}`,
      fileWarning: (rel, code, n) => `${rel} ${code === "invalid-entries" ? `tiene ${n} entrada(s) no válida(s) — se ignoran, y el archivo no se reescribe hasta que las corrijas o elimines a mano` : `se ignora y nunca se reescribe — ${({ "invalid-json": "no es JSON válido", "invalid-shape": "no tiene una lista \"signals\"", "too-big": "es demasiado grande (64 KB como máximo)", "not-a-file": "no es un archivo normal", unreadable: "no se puede leer" })[code] || code}; corrígelo a mano o bórralo`}.`,
      problem: (i, code) => `  entrada ${i + 1}: ${({ "invalid-entry": "no válida (track, word, effect off|weak|strong, count ≥ 1, origin learned|set)", duplicate: "repite una entrada anterior", "too-many": "más allá del límite de 200 ajustes" })[code] || code}`,
    },
    sectionStatus: { missing: "falta", unfilled: "sin rellenar", template: "solo la orientación de la plantilla", "na-short": "n/a sin una razón (4+ palabras)" },
    sectionNames: {
      "Performance Budget": "Presupuesto de Rendimiento", "Scale Design": "Diseño de Escala", "Multi-tenancy": "Modelo Multiinquilino",
      "Observability": "Observabilidad", "Cost Envelope": "Presupuesto de Coste", "Model Strategy": "Estrategia de Modelo",
      "Prompt Architecture": "Arquitectura de Prompt", "Token Economics": "Economía de Tokens", "Latency Budget": "Presupuesto de Latencia",
      "Eval Strategy": "Estrategia de Evaluación", "Safety & Abuse": "Seguridad y Abuso", "Fallback & Degradation": "Fallback y Degradación",
      "Observability for AI": "Observabilidad de IA", "Model Lifecycle": "Ciclo de Vida del Modelo", "Multi-modality": "Multimodalidad",
    },
    precommit: {
      header: "dev-spec-driven pre-commit:",
      earsErrors: (f, n) => `✗ ${f}: ${n} error(es) EARS`,
      earsClean: (f, n) => `✓ ${f}: EARS limpio (${n} criterios)`,
      earsWarnings: (f, n, w, p) => `⚠ ${f}: sin errores EARS (${n} criterios), pero ${[w ? `${w} aviso(s)` : null, p ? `${p} placeholder(s) de la plantilla sin rellenar` : null].filter(Boolean).join(" y ")} — no bloquea`,
      phantom: (f, n, list) => `✗ ${f}: ${n} referencia(s) AC/prueba fantasma — probablemente erratas: ${list}`,
      uncovered: (f, n, list) => `⚠ ${f}: ${n} AC(s) sin tarea (aviso): ${list}`,
      traceClean: (f, n) => `✓ ${f}: trazabilidad limpia (${n} ACs)`,
      blocked: (n) => `\nCommit bloqueado: ${n} problema(s) bloqueante(s) en los ficheros de spec preparados. Corrígelos o usa 'git commit --no-verify' para omitirlos.`,
    },
    doctor: {
      steeringMissing: (list) => `falta: ${list}`,
      steeringOk: "steering esencial presente (incl. constitución)",
      requirementsMissing: "falta requirements.md",
      clarificationsOpen: (n) => `${n} [NEEDS CLARIFICATION] sin resolver — resuelve antes del diseño`,
      clarificationsOpenPlan: (n) => `${n} [NEEDS CLARIFICATION] sin resolver en change.md — resuelve antes de aprobar el plan`,
      clarificationsNone: "ninguno sin resolver",
      scPresent: "presente",
      scMissing: "sin criterios de éxito medibles SC-###",
      prioritiesOk: "historias de usuario priorizadas",
      prioritiesMissing: "sin prioridad P1 (MVP) en una historia de usuario",
      acDup: (list) => `IDs de AC duplicados: ${list}`,
      acUnique: "IDs de AC únicos",
      earsDetail: (n, e, w) => `criterios=${n}, errores=${e}, avisos=${w}`,
      earsNoCriteria: (ids, file = "requirements.md") => `${file} cita IDs de AC (${ids}) pero no se validó ningún criterio — EARS valida un AC escrito como elemento de lista, título o línea que empiece por su ID, o como fila de tabla bajo un título de Criterios de Aceptación`,
      designMissing: "falta design.md",
      mermaidOk: "tiene un diagrama",
      mermaidMissing: "no se encontró diagrama mermaid",
      constitutionOk: "presente — verifica que cada principio se comprueba",
      constitutionMissing: "sin sección Verificación de la Constitución en el diseño",
      saasAllFilled: "las 5 rellenadas",
      aiAllFilled: "las 10 rellenadas",
      gatesPending: (list) => `esperando aprobación humana: ${list} — ejecuta /approve antes de avanzar`,
      gatesOk: "todas las fases presentes aprobadas",
      unverified: (list) => `marcadas sin evidencia de verificación: ${list}`,
      verifiedOk: "toda tarea marcada con comando _Verify:_ tiene evidencia",
      rootCauseMissing: "bug.md → Causa Raíz sin rellenar — ninguna corrección antes de conocer la causa",
      rootCauseOk: "causa raíz documentada",
      reproMissing: "bug.md → Reproducción sin rellenar",
      reproOk: "reproducción documentada",
    },
    next: {
      fixChecks: (ids, slug) => `Corrige las verificaciones bloqueantes (${ids}) — ejecuta /spec-doctor ${slug} para ver los detalles.`,
      reReview: (files) => `Nueva revisión: ${files} modificado(s) tras la última aprobación — vuelve a aprobar la fase afectada.`,
      approveRequirements: (slug) => `Revisa y aprueba los requisitos — /approve ${slug} requirements.`,
      approveDesign: (slug) => `Revisa y aprueba el diseño — /approve ${slug} design.`,
      approveTasks: (slug) => `Revisa y aprueba el desglose de tareas — /approve ${slug} tasks.`,
      approveTestPlan: (slug) => `Revisa y aprueba el plan de pruebas — /approve ${slug} test-plan.`,
      approveEvalPlan: (slug) => `Revisa y aprueba el plan de evals — /approve ${slug} eval-plan.`,
      approveBugDesign: (slug) => `Revisa y aprueba bug.md (Reproducción + Causa Raíz — el diseño de un bugfix) — /approve ${slug} design.`,
      signOffTests: (slug, what) => `Aprobación de la Fase 4: la implementación ya empezó, así que las pruebas ya no se escriben primero — ${({ tdd: "comprueba que cada prueba planificada existe con su T-ID en el nombre de la prueba (test(\"T-01 …\")) para que tests-in-code la encuentre", ai: `comprueba que el conjunto de evals es el de la propia función y registra la línea base (/eval ${slug} --set-baseline)`, both: `comprueba que cada prueba planificada existe con su T-ID en el nombre de la prueba (test("T-01 …")) y que el conjunto de evals es el de la propia función, y registra la línea base (/eval ${slug} --set-baseline)` })[what]}. Después apruébalo — /approve ${slug} tests.`,
      approveTests: (slug, what) => `Fase 4, el gate estricto: ${({ tdd: "escribe todas las pruebas planificadas y confirma que cada una falla por la razón correcta", ai: "escribe las pruebas deterministas y el harness de evals, y registra la línea base", both: "escribe todas las pruebas planificadas (cada una fallando por la razón correcta) y el harness de evals, y registra la línea base" })[what]} — /writeTests ${slug}; ningún código de implementación antes. Después apruébalo — /approve ${slug} tests.`,
      implement: (n, text, slug) => `Implementa la tarea #${n}: ${text} — /executeTask ${slug}.`,
      allDone: (slug) => `Todas las tareas hechas — cierra la función con /spec-finish ${slug} (spec_finish): informe de preparación + resumen del merge. Opcional, antes: /spec-simplify ${slug} — una limpieza del código de la propia función sin cambiar el comportamiento, probada por sus pruebas.`,
      breakIntoTasks: (slug) => `Desglosa el diseño en tareas — /createTask ${slug}.`,
      drifted: (slug, day, n, total, files) => `'${slug}' se cerró el ${day}, pero ${n} de ${total} fichero(s) de implementación cambiaron desde entonces: ${files} (${DEV_SPEC} drift ${slug}). Decide: la spec ahora es incorrecta → /spec-impact ${slug} (o una función nueva con _Supersedes:_); el código es incorrecto → corrígelo (/spec-bugfix); inofensivo → vuelve a ejecutar /spec-finish ${slug} para una línea base nueva.`,
      finished: (slug, day, total, signOff) => `'${slug}' está cerrada (${day}) — sus ${total} fichero(s) de implementación no han cambiado desde entonces.` +
        (!signOff ? ` Nada más que hacer aquí — /spec-drift ${slug} la comprueba tras cambios futuros.`
          : signOff.why ? ` La aprobación final (execution, ${signOff.at}) es anterior a ${signOff.why} — vuelve a confirmarla: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`
            : ` Falta la aprobación final${signOff.missing ? ` — ${signOff.missing}${signOff.signed ? ` (ya validaron: ${signOff.signed})` : ""}` : ""}: /approve ${slug} execution${signOff.role ? " --role " + signOff.role : ""}.`),
      verifySuite: (slug, list) => `'${slug}' está cerrada, pero sus verificaciones del proyecto no tienen una ejecución correcta desde la última actividad en las tareas: ${list} — /spec-finish se niega y el gate de fin de turno devuelve un "hecho" hasta que pasen. Ejecútalas y registra las ejecuciones: ${DEV_SPEC} finish ${slug} --run (o spec_finish {evidence: [{name, command, exitCode}]}).`,
      verifyDuplicate: (slug, list, n) => `Todas las tareas están marcadas, pero no todas están verificadas: ${list} — hay dos tareas con el número ${n}, así que una ejecución registrada para la #${n} solo llega a la primera (${DEV_SPEC} done ${slug} ${n} responde por ella). Renumera las tareas en .specs/${slug}/tasks.md para que cada número sea único (doctor: duplicate-tasks), vuelve a aprobar la fase tasks (/approve ${slug} tasks) y registra después la ejecución de cada tarea renumerada.`,
      signOffWhy: { approvals: (list) => `la aprobación de ${list}`, changeRequests: (list) => `la solicitud de cambio ${list}`, join: " y " },
      refinish: (slug, day, why) => `'${slug}' se cerró el ${day}, pero cambió desde entonces (${why}) y todas sus tareas están hechas — ciérrala de nuevo: /spec-finish ${slug} (spec_finish {write: true}) renueva el informe de preparación, el resumen del merge y la línea base de drift; después vuelve a dar la aprobación final: /approve ${slug} execution.`,
      driftedStale: (why) => `También cambió desde ese cierre (${why}): decidas lo que decidas, vuelve a cerrarla después — /spec-finish (spec_finish {write: true}) registra la línea base nueva.`,
      verify: (slug, list, n, runnable) => `Todas las tareas están marcadas, pero no todas están verificadas: ${list} — /spec-finish y la aprobación final se niegan hasta que cada una tenga una ejecución correcta. ` +
        (runnable ? `Vuelve a ejecutar el comando _Verify:_ de la tarea ${n} y registra el resultado: ${DEV_SPEC} done ${slug} ${n} --run` : `Registra una ejecución correcta de la tarea ${n}: spec_complete_task {name: "${slug}", number: ${n}, evidence: {command, exitCode: 0}} (${DEV_SPEC} done ${slug} ${n} --cmd "<comando>" --exit 0)`) +
        "; una ejecución que falla significa que primero hay que corregir el código.",
    },
    clarify: {
      resolveMarker: (mk) => "Resuelve [NEEDS CLARIFICATION]: " + (mk || "(sin especificar)"),
      addSuccessCriteria: "Añade una sección Criterios de Éxito con resultados medibles y agnósticos a la tecnología (SC-001 …).",
      idSuccessCriteria: "Da a cada criterio de éxito un ID estable (SC-001 …) y un objetivo medible.",
      prioritize: "Prioriza las historias de usuario (P1 = la porción MVP que entrega valor sola; P2/P3 incrementales).",
      independentTest: "Indica cómo cada historia de usuario puede testearse de forma independiente (para ser lanzable por sí sola).",
      quantifyVague: (line, text) => `Cuantifica el término vago en la línea ${line}: ${text}`,
      edgeCases: "Lista los casos límite y el comportamiento de manejo de errores (cada uno como un AC SI…ENTONCES).",
      outOfScope: "Indica explícitamente qué está FUERA de alcance.",
      nfr: "Especifica los requisitos no funcionales (rendimiento / seguridad / accesibilidad) con objetivos medibles.",
      unwanted: "Añade criterios de comportamiento no deseado (SI…ENTONCES / IF…THEN / SE…ENTÃO) para las rutas de fallo.",
      tenant: "Especifica el aislamiento de inquilino: el inquilino A nunca debe leer/escribir datos del inquilino B (escríbelo como un AC).",
      rateLimit: "Especifica los límites de tasa (por usuario / por inquilino / global).",
      aiQuality: "Especifica el objetivo de calidad de salida y el comportamiento de rechazo para la ruta de IA.",
      aiCost: "Especifica un techo de coste por solicitud ($/tokens).",
      changeSummary: "Escribe el Resumen del cambio en change.md: qué cambia y por qué, en una línea.",
      changeCriteria: "Escribe 1–3 criterios de aceptación EARS en change.md (1. **US-1.AC-1** — CUANDO … EL SISTEMA DEBE …).",
      changeApproach: "Escribe el Enfoque en change.md: qué toca el cambio, y por qué eso es todo.",
      changeScope: (detail) => `Mantenlo como cambio, o conviértelo en una función: ${detail}.`,
    },
    hook: {
      earsClean: (n) => `Verificación EARS: ${n} criterios, todo limpio ✓`,
      earsIssues: (errs, warns, top, hasErr, file = "requirements.md") =>
        `Verificación EARS en ${file} — ${errs} error(es), ${warns} aviso(s):\n${top}` +
        (hasErr ? (file === "change.md" ? "\nCorrige los errores antes de aprobar el plan." : "\nCorrige los errores antes de avanzar al diseño.") : ""),
      traceOk: (n) => `Trazabilidad: los ${n} ACs cubiertos por tareas ✓`,
      traceGaps: (feature, parts) => `Lagunas de trazabilidad en ${feature}:\n  - ${parts}`,
      roadmapUpdated: (pct, complete, total) => `Roadmap actualizado → ${pct}% (${complete}/${total} funciones).`,
      sessionHeader: "dev-spec-driven — funciones en .specs/:",
      sessionLine: (name, tracks, phase, done, total) => `  • ${name} [${tracks}] — ${phase} (${done}/${total} tareas)`,
      sessionMore: (n) => `  … +${n} función(es) más — /spec-status (o ${DEV_SPEC} list) las muestra todas`,
    },

    evidenceGate: {
      noContent: "La evidencia necesita un comando (con su exit code) o un resumen — un exit code solo no prueba nada.",
      manualOnRunnable: (n, slug) => `Tarea ${n}: se registró una nota, pero su comando _Verify:_ no se ejecutó — sigue sin verificar hasta que se registre una ejecución correcta: ${DEV_SPEC} done ${slug} ${n} --run`,
      redPhaseTestWord: "la prueba",
      redPhaseVerify: (n, slug, test) => `La tarea ${n} escribe una prueba que debe FALLAR (la fase roja), así que un _Verify:_ que debe pasar nunca pasará en ella. Marca la tarea ${n} con _Expect: fail_ — una ejecución que FALLE es entonces su prueba (${test} falla antes del arreglo) y una que pase se rechaza: ${DEV_SPEC} done ${slug} ${n} --run. O mueve el comando a la tarea que la pone en verde (el arreglo — su _Verify:_ prueba entonces el arreglo).`,
      failedRun: (n, code, slug, runnable) => `Tarea ${n}: su última ejecución registrada falló (exit ${code}) — una nota no cambia eso; sigue sin verificar hasta que se registre una ejecución correcta ` +
        (runnable ? `de su comando _Verify:_: ${DEV_SPEC} done ${slug} ${n} --run` : "(un comando con exit code 0)."),
      duplicateNumber: (n) => `Tarea ${n}: otra tarea también usa el número ${n} y la evidencia registrada es de esa — esta sigue sin verificar; renumera las tareas y luego registra la evidencia de esta.`,
      staleEvidence: (n, slug, runnable) => `Tarea ${n}: la evidencia registrada es de otra tarea o de un comando _Verify:_ anterior — sigue sin verificar hasta que se registre ` +
        (runnable ? `una ejecución de esta: ${DEV_SPEC} done ${slug} ${n} --run` : "la evidencia de esta."),
      reason: { "no-evidence": "sin evidencia", "failed-run": "la última ejecución falló", "manual-note-on-runnable-verify": "solo una nota, comando _Verify:_ sin ejecutar", "duplicate-number": "número compartido con otra tarea",
        "stale-evidence": "evidencia de otra tarea o de otro comando _Verify:_",
        "unexpected-pass": "la ejecución pasó, pero _Expect: fail_ necesita una ejecución en rojo",
        unobserved: "ejecución no observada por el harness",
        "command-mismatch": "la ejecución registrada no es su comando _Verify:_" },
      commandMismatch: (n, slug, ran, verify, red) => `Tarea ${n}: la ejecución registrada (\`${ran}\`) no es una ejecución de su comando _Verify:_ (${verify}) — queda marcada, pero sigue sin verificar hasta que se registre una ejecución ${red ? "QUE FALLE " : ""}de ese comando (tal como está escrito; un \`cd <carpeta> &&\`, \`set -o pipefail;\` o VAR=valor delante, o la unión con \` && \` de sus comandos, valen): ${DEV_SPEC} done ${slug} ${n} --run`,
      duplicateTasks: (list) => `números de tarea repetidos: ${list} — complete/brief eligen la primera pendiente; renuméralas`,
    },
    observed: {
      on: "Modo de evidencia OBSERVADO — una tarea cuyo _Verify:_ tiene un comando solo queda verificada con una ejecución correcta que el harness vio (en Claude Code, el hook de observación del plugin guarda cada ejecución Bash de un comando _Verify:_ o de una verificación del proyecto) o que dev-spec done --run / finish --run hizo; la ejecución de una verificación del proyecto también (roadmap.json meta.evidence). Un cliente solo MCP no tiene ese hook: sus ejecuciones se registran con " + DEV_SPEC + " done <función> <n> --run.",
      off: "Modo de evidencia REPORTADO — las ejecuciones que un agente reporta verifican tal como se dan (roadmap.json meta.evidence); cada registro sigue diciendo si el harness la observó.",
      badValue: (v) => `--evidence admite reported u observed (recibido '${v}').`,
      badInput: (v) => `evidence debe ser "reported" u "observed" (recibido '${v}').`,
      unobservedRedNote: (n, slug) => `La tarea ${n} está marcada _Expect: fail_: su prueba es la ejecución en ROJO, y el harness nunca la vio — este proyecto solo verifica ejecuciones observadas (roadmap.json meta.evidence: observed). Repite la ejecución en rojo donde se observe: aparta la corrección (git stash), ejecuta el comando _Verify:_ con la herramienta Bash en Claude Code o con ${DEV_SPEC} done ${slug} ${n} --run (debe fallar), después restaura la corrección y registra su ejecución correcta.`,
      unobservedNote: (n, slug) => `Tarea ${n}: la ejecución quedó registrada, pero el harness nunca la vio — este proyecto solo verifica un comando _Verify:_ con una ejecución observada (roadmap.json meta.evidence: observed). Ejecuta el comando con la herramienta Bash en Claude Code y vuelve a registrarlo, o deja que la CLI lo ejecute: ${DEV_SPEC} done ${slug} ${n} --run`,
      neverObserved: "Nunca se observó ninguna ejecución en este proyecto: solo Claude Code con el plugin dev-spec-driven las guarda (hooks/observe-hook.js) — un cliente solo MCP no tiene hook, así que registra las ejecuciones con " + DEV_SPEC + " done <función> <n> --run (o vuelve atrás: " + DEV_SPEC + " init --evidence reported).",
      naHint: "Este proyecto solo verifica ejecuciones que el harness vio (roadmap.json meta.evidence: observed): ejecuta el comando con la herramienta Bash en Claude Code, o por la CLI (--run).",
    },
    taskDone: {
      done: (n, verified, done, total) => `Tarea ${n} hecha${verified ? " (verificada)" : ""}. ${done}/${total}`,
      already: (n, verified, done, total) => `La tarea ${n} ya estaba hecha${verified ? " (verificada)" : ""}. ${done}/${total}`,
      next: (n, text) => `  siguiente → #${n} ${text}`,
      allDone: "  — todo hecho ✓",
      numberInt: "el número de tarea debe ser un entero",
      noRunnable: (n) => `la tarea ${n} no tiene un marcador _Verify: <comando>_ ejecutable`,
      shellHint: "Consejo: la shell predeterminada de Windows (cmd.exe) no pudo ejecutar esta línea de comandos tal como está escrita. Si el comando _Verify:_ está escrito para una shell POSIX, reinténtalo con --shell bash (o define DEV_SPEC_SHELL=bash).",
      posixOnWindows: (cmd, kinds) => `el comando _Verify:_ \`${cmd}\` usa sintaxis de shell POSIX (${kinds.map((k) => ({ "single-quotes": "comillas simples '…'", variable: "$VARIABLES" })[k] || k).join(", ")}) que cmd.exe — la shell predeterminada de --run en Windows — interpreta de otra forma, a menudo sin fallar: no tiene comillas simples y nunca expande $VAR, así que una comprobación rota podría registrarse como ejecución correcta. No se ejecutó nada; la tarea sigue abierta. Vuelve a ejecutarlo con --shell bash (Git Bash; o define DEV_SPEC_SHELL=bash), con --shell pwsh si es un comando de PowerShell (o pasa el script a PowerShell entre comillas dobles: pwsh -NoProfile -Command "…") — o con --shell cmd para ejecutarlo igualmente en cmd.exe.`,
      pwshInPosix: (cmd, kinds, shell) => `el comando _Verify:_ \`${cmd}\` pasa a PowerShell un script con ${kinds.map((k) => ({ variable: "$VARIABLES", backtick: "acentos graves (backticks)" })[k] || k).join(" y ")} fuera de comillas simples, pero lo ejecuta una shell POSIX (${shell}), que los expande antes — \`exit $LASTEXITCODE\` queda en un \`exit\` sin código (sale con 0), así que una comprobación que falla podría registrarse como correcta. No se ejecutó nada; la tarea sigue abierta. En una shell POSIX pon el script entre comillas simples (pwsh -NoProfile -Command '…; exit $LASTEXITCODE'), o ejecútalo con --shell pwsh (o define DEV_SPEC_SHELL=pwsh) y escribe solo el PowerShell (_Verify: Invoke-Pester -Path tests -CI_).`,
    },

    tracks: {
      unknown: (items, valid) => `Track${items.length > 1 ? "s" : ""} desconocido${items.length > 1 ? "s" : ""}: ${items.map((u) => `'${u.token}'` + (u.suggestion ? ` (¿querías decir '${u.suggestion}'?)` : "")).join(", ")}. Tracks válidos: ${valid}.`,
      cannotRemoveCore: "'core' está siempre activo — no se puede quitar.",
      bugfixNeedsTdd: "Un bugfix es siempre test-first — no se puede quitar +tdd.",
      notActive: (list) => `No activo: ${list} — nada que quitar.`,
      removed: (list, slug) => `Tracks desactivados: ${list}. No se borró ningún archivo — los artefactos inactivos se quedan donde están y vuelven a contar si vuelves a añadir el track. Vuelve a ejecutar /spec-doctor ${slug}.`,
      restoredSections: (list) => `El track eliminado cubría estas secciones de los tracks que quedan — vuelven a design.md, por rellenar: ${list}.`,
      addedOnCreate: (slug, list) => `'${slug}' ya existía — tracks añadidos: ${list} (artefactos, secciones de diseño, steering, tareas) — no se sobrescribió nada.`,
      designTitle: (name) => `# Diseño: ${name}`,
      acPlaceholder: (tr) => `[el criterio +${tr} que prueba esta tarea]`,
      designSections: (marker) => `design.md (secciones ${marker})`,
      addedDesign: "design.md (+secciones)",
      addedTasks: "tasks.md (+tareas)",
      addedActiveTracks: "classification.md (Tracks Activos)",
      taskBlock: (track, start) => BUILD.es.trackTasks({ track, start }),
    },

    args: {
      missing: (list) => `Falta(n) argumento(s) obligatorio(s): ${list}`,
      invalid: (list) => `Argumento(s) no válido(s): ${list}`,
      item: (arg, expected, got) => `${arg} debe ser ${expected} (recibido: ${got})`,
      type: { string: "una cadena", integer: "un entero", number: "un número", boolean: "un booleano (true/false)", array: "un array", object: "un objeto", null: "null" },
      arrayOf: (t) => `un array (cada elemento ${t})`,
      oneOf: (list) => `uno de: ${list}`,
      atLeast: (n) => `≥ ${n}`,
      notObject: "arguments debe ser un objeto JSON.",
      dotdot: "projectDir no puede contener segmentos de ruta '..'.",
      network: (dir) => `projectDir debe ser una carpeta local — una ruta de red o de dispositivo (${dir}) se rechaza, para que una llamada a una herramienta nunca apunte este servidor local a otra máquina; abre el proyecto localmente (o inicia el servidor con él como carpeta de trabajo).`,
      unknownTool: (name) => `Herramienta desconocida: ${name} — tools/list lista las herramientas de este servidor.`,
      noTool: "tools/call necesita params.name — la herramienta a llamar (tools/list las lista).",
    },
    jsonShape: {
      invalid: (rel, detail) => `${rel} tiene una estructura inesperada (${detail}) — corrígelo a mano; no se sobrescribirá.`,
      topLevel: "el nivel superior debe ser un objeto",
      features: "'features' debe ser un objeto",
      featureEntry: (k) => `features.${k} debe ser un objeto`,
      dependsOn: (k) => `features.${k}.dependsOn debe ser un array de nombres de funciones`,
      meta: "'meta' debe ser un objeto",
      backlog: "'backlog' debe ser un array",
      backlogEntry: "cada entrada de 'backlog' debe ser un objeto con 'name'",
      approvals: "'approvals' debe ser un objeto",
      evidence: "'evidence' debe ser un objeto",
      tracks: "'tracks' debe ser un array",
      approvalHistory: "'approvalHistory' debe ser un array",
      changes: "'changes' debe ser un array",
      finishChecks: "'finishChecks' debe ser un objeto",
      signoffs: "'signoffs' debe ser un objeto",
      unticks: "'unticks' debe ser un array",
    },
    depend: {
      unknown: (list) => `Cada dependencia debe ser una función existente — no encontrada(s): ${list}`,
      orderInt: (v) => `order debe ser un entero (recibido: '${v}').`,
    },
    evals: {
      usage: "Uso: node run-evals.js <función> [--dry-run] [--set-baseline] [--require-live] [--model=ID] [--project=DIR] [--max-items=N]",
      noEvalsDir: (slug, dir) => `No hay carpeta evals/ para '${slug}' en ${dir}`,
      requireLive: "harness de evals: ANTHROPIC_API_KEY no está definida y se pidió --require-live — no se hará un dry run en su lugar.",
      header: (slug) => `dev-spec-driven evals — función '${slug}'`,
      config: (model, prompt, mode) => `  modelo: ${model}   prompt: ${prompt}   modo: ${mode}`,
      none: "(ninguno)",
      modeDry: "DRY-RUN (sin llamadas al modelo)",
      modeLive: "REAL",
      noKey: "  (ANTHROPIC_API_KEY no definida — ejecución en seco. Defínela para una ejecución real.)",
      badJson: (set, err) => `  ✗ ${set}.json — JSON no válido: ${err}`,
      badItems: (set) => `  ✗ ${set}.json — 'items' debe ser un array`,
      emptySet: (set) => `  ✗ ${set}.json — sin elementos que evaluar: un conjunto que no evalúa nada no puede aprobar — añade elementos de eval (evals/README.md) o borra el archivo`,
      badItem: (set, label, why) => `  ✗ ${set}.json — elemento ${label}: ${why}`,
      moreBad: (n) => `      … +${n} elemento(s) no válido(s)`,
      itemWhy: {
        notObject: "no es un objeto",
        noId: "sin 'id' (texto no vacío)",
        noInput: "sin 'input' (texto no vacío)",
        noExpect: "sin objeto 'expect'",
        unknownType: (t, types) => `tipo de evaluador desconocido '${t}' (usa ${types})`,
        noValue: (t) => `'${t}' necesita un 'value'`,
        badRegex: (msg) => `la regex no compila: ${msg}`,
        noRubric: "'judge' necesita una 'rubric'",
      },
      badThresholds: (why) => `  ✗ thresholds.json — ${why}`,
      thresholdsShape: "debe ser un objeto que dé a cada conjunto (golden / adversarial / regression) un número entre 0 y 1",
      capped: (set, max, total) => `  ⚠ ${set}: limitado a ${max}/${total} elementos (auméntalo con --max-items=N)`,
      wouldRun: (set, n, kinds) => `  • ${set}: ${n} elemento(s) — ejecutaría ${kinds}`,
      score: (ok, set, pass, n, pct, thr) => `  ${ok ? "✓" : "✗"} ${set}: ${pass}/${n} = ${pct}% (umbral ${thr}%)`,
      failure: (id, detail) => `      - ${id}: ${detail}`,
      error: (msg) => `ERROR ${msg}`,
      resp: (sample) => ` | respuesta: ${sample}`,
      fail: "falló",
      judge: "juez",
      judgeSkipped: "juez no usado (heurística aplicada)",
      unknownGrader: (t) => `evaluador desconocido '${t}'`,
      vsBaseline: "\n  vs baseline:",
      delta: (set, base, cur, sign, pp) => `    ${set}: ${base}% → ${cur}% (${sign}${pp}pp)`,
      baselineWritten: (rel) => `\n  baseline guardada → ${rel}`,
      tokens: (i, o) => `\n  tokens: ${i} de entrada / ${o} de salida`,
      dryInvalid: "\nEl dry run encontró conjunto(s) de evals no válido(s) — corrígelos antes de una ejecución real.",
      liveInvalid: "\nConjunto(s) de evals no válido(s) — corrígelos primero; no se ha llamado a ningún modelo.",
      dryOk: "\nDry run completado — los conjuntos son válidos. Define ANTHROPIC_API_KEY y vuelve a ejecutar para obtener resultados reales.",
      verdict: (below) => `\nVeredicto: ${below ? "POR DEBAJO DEL UMBRAL ✗" : "todos los conjuntos pasan ✓"}`,
      crashed: (msg) => `error en el harness de evals: ${msg}`,
    },

    traceGapText: {
      kinds: {
        uncoveredByTasks: "ACs sin tarea",
        phantomAcsInTasks: "tareas referencian ACs desconocidos (¿erratas?)",
        uncoveredByTests: "ACs sin prueba planeada",
        phantomAcsInTests: "el plan de pruebas cubre ACs desconocidos (¿erratas?)",
        phantomTestsInTasks: "tareas referencian pruebas desconocidas (¿erratas?)",
        testsNotMappedToTasks: "pruebas planeadas que ninguna tarea pone en verde",
        missingImplFiles: "ficheros _Implements:_ que no existen",
      },
      gap: (label, list) => `${label}: ${list}`,
      allCovered: (n) => `los ${n} ACs cubiertos por tareas`,
      removedKinds: {
        phantomAcsInTasks: "las tareas aún citan ACs que una solicitud de cambio eliminó (elimina o actualiza esas tareas — no es una errata)",
        phantomAcsInTests: "el plan de pruebas aún cubre ACs que una solicitud de cambio eliminó (elimina o actualiza esas filas — no es una errata)",
      },
      removedRef: (id, n) => `${id} (solicitud de cambio #${n})`,
    },
    phaseNames: {
      complete: "completada", executing: "en ejecución", "tasks-ready": "tareas listas", "eval-plan": "plan de evals", "test-plan": "plan de pruebas",
      design: "diseño", requirements: "requisitos", classified: "clasificada", empty: "vacía",
    },
    featureOps: {
      removeNeedsConfirm: (slug, n) => `Eliminar '${slug}' borra .specs/${slug}/ definitivamente (${n} fichero(s)). No se ha borrado nada — pasa confirm: true para eliminarla, o archívala (reversible).`,
      backlogNotFound: (name, known) => `'${name}' no está en el backlog${known ? ` (backlog: ${known})` : " (el backlog está vacío)"}.`,
      backlogIsFeature: (name, slug) => `'${name}' ya tiene una spec (.specs/${slug}/) — el backlog es para funciones aún sin spec (estado: ${DEV_SPEC} status ${slug}).`,
      backlogAppended: (name) => `'${name}' ya está en el backlog — la nueva nota se añadió a su nota.`,
      backlogKept: (name) => `'${name}' ya está en el backlog con esa nota — nada cambió.`,
      backlogNoteFull: (name, max) => `'${name}' ya está en el backlog y su nota pasaría de ${max} caracteres — la nueva nota no se añadió: regístrala con otro nombre.`,
      backlogNoteLong: (name, max) => `La nota de '${name}' pasa de ${max} caracteres — no se añadió nada al backlog: acorta la nota.`,
    },
    cliOutput: {
      words: { pass: "ok", warn: "aviso", fail: "falla", "gaps-found": "con lagunas", clear: "clara", "needs-clarification": "requiere aclaración", error: "error" },
      yes: "sí", no: "no",
      tracks: (label, conf) => `Tracks: ${label}   confianza: ${conf}`,
      note: (n) => `\nNota: ${n}`,
      created: (dir, lang, files, kept) => `Creado en ${dir} [${lang}]:\n  ${files}` + (kept ? `\n  (ya existían, se mantienen: ${kept})` : ""),
      nothingNew: "(nada nuevo)",
      steeringCreated: (f) => `Creado ${f}`,
      steeringExists: (f) => `Ya existe (no se ha modificado) ${f}`,
      feature: (slug, label, lang) => `Función '${slug}' [${label}] (${lang})`,
      noFeatures: (dir) => `No hay funciones en ${dir}`,
      listLine: (name, tracks, phase, done, total) => `  ${name.padEnd(28)} [${tracks}]  ${phase}  (${done}/${total} tareas)`,
      statusHead: (f, tracks, phase) => `Función: ${f}  [${tracks}]  fase: ${phase}`,
      statusTasks: (done, total, next) => `Tareas: ${done}/${total}` + (next ? `  siguiente → ${next}` : ""),
      doctorHead: (f, tracks, verdict, ready) => `Diagnóstico: ${f}  [${tracks}]  veredicto=${verdict}  lista para avanzar: ${ready}`,
      traceHead: (f, verdict, acs, covered) => `Trazabilidad: ${f}  veredicto=${verdict}  ACs=${acs}  cubiertos por tareas=${covered}`,
      earsHead: (n, m, verdict) => `EARS: ${n} criterios, ${m} con verbo modal, veredicto=${verdict}`,
      next: (n, text, left, total) => `Siguiente → #${n} ${text}  (quedan ${left}/${total})`,
      allDone: "Todas las tareas hechas ✓",
      batch: (list) => `  lote paralelo: ${list}`,
      mergeSummaryAt: (p) => `\nResumen del merge → ${p}`,
      briefAt: (p, inline) => `Brief → ${p}` + (inline ? "  (solo inline: tarea de prompt +ai)" : ""),
      reportAt: (p) => `  informe → ${p}`,
      ledgerAt: (p) => `  ledger → ${p}`,
      unresolved: (list) => `  ⚠ sin resolver: ${list}`,
      approved: (phase, f) => `Fase '${phase}' de ${f} aprobada ✓`,
      backlogHead: (n) => `Backlog (${n}):`,
      backlogAdded: (name) => `✓ '${name}' añadida al backlog`,
      backlogRemoved: (name) => `✓ '${name}' eliminada del backlog`,
      wrote: (file, pct, c, t) => `✎ generado ${file}` + (pct != null ? `  (${pct}%, ${c}/${t})` : ""),
      noRoadmapFeatures: (dir) => `Aún no hay funciones en ${dir}`,
      roadmapHead: (pct, c, t, cycle) => `Hoja de ruta — progreso global ${pct}%  (${c}/${t} completas)` + (cycle ? `  ⚠ CICLO: ${cycle}` : ""),
      deps: (list, unmet) => `  deps: ${list}` + (unmet ? ` (pendientes: ${unmet})` : ""),
      scanHead: (root, truncated) => `Análisis de ${root}` + (truncated ? " (truncado en el límite)" : ""),
      scanFiles: (n, stack) => `  ficheros: ${n}  | stack: ${stack || "desconocido"}`,
      scanDirs: (list) => `  carpetas de primer nivel: ${list}`,
      scanExt: (list) => `  por extensión: ${list}`,
      scanEndpoints: (n, files) => `  endpoints: ${n} ruta(s) en ${files} fichero(s)`,
      coverage: (pct, d, t) => `Cobertura de specs: ${pct}%  (${d}/${t} ficheros de código nombrados en _Implements:_)`,
      undocumented: (list) => `  carpetas sin cobertura: ${list}`,
      clarify: (f, tracks, verdict, n) => `Aclarar: ${f}  [${tracks}]  → ${verdict} (${n} pregunta(s))`,
      naHead: (f, tracks, phase, verdict, gatesOk) => `Función: ${f}  [${tracks}]  fase: ${phase}  veredicto=${verdict}  gates aprobados: ${gatesOk}`,
      changed: (list) => `  ⚠ modificado desde la última aprobación: ${list}`,
      renamed: (a, b) => `'${a}' renombrada → '${b}' ✓`,
      archived: (f, dest) => `'${f}' archivada → .specs/${dest} ✓`,
      removed: (f) => `'${f}' eliminada ✓`,
      wouldRemove: (slug, dir, n, entries) => `Esto eliminaría '${slug}' definitivamente: ${dir} (${n} fichero(s): ${entries})`,
      confirmHint: (slug) => `No se ha eliminado nada. Vuelve a ejecutar con --yes para confirmar — o archívala: ${DEV_SPEC} feature archive ${slug}`,
      missingValue: (flag) => `falta el valor de --${flag}`,
      unknownFlag: (flag, suggestion) => `opción desconocida ${flag}` + (suggestion ? ` — ¿quizás ${suggestion}?` : ".") + " Las opciones están en `" + DEV_SPEC + " help`.",
      unknownRules: (tool, known) => `herramienta desconocida '${tool}'. Conocidas: ${known}`,
      bundleWrote: (file, n, kb) => `Escrito ${file} — el motor en un solo archivo (${n} módulos, ${kb} KB).`,
      bundleUse: (custom) => `Define DEV_SPEC_BUNDLE=1${custom ? ` y DEV_SPEC_BUNDLE_PATH=${custom}` : ""} en el entorno con que arranca Claude Code / tu cliente MCP para usarlo. Vuelve a generarlo tras cada actualización del plugin: un bundle desactualizado se ignora (se cargan los módulos).`,
      scaleSections: (list) => `Secciones de escala: ${list}`,
      aiSections: (list) => `Secciones de IA: ${list}`,
      dependsOn: (f, deps, order, unknown) => `${f} depende de: ${deps || "(ninguna)"}` + (order != null ? `  orden=${order}` : "") + (unknown ? `  ⚠ dependencias desconocidas: ${unknown}` : ""),
      trackNow: (f, tracks) => `'${f}' ahora [${tracks}]`,
      usage: (syntax) => `uso: ${syntax}`,
      unknownCommand: (c) => `comando desconocido '${c}'. Ejecuta \`${DEV_SPEC} help\`.`,
      unknownClient: (c, known) => `cliente desconocido '${c}'. Conocidos: ${known}`,
    },

    gates: {
      empty: "sin contenido además de los títulos",
      more: (n) => `+${n} más`,
      placeholdersNone: "ningún placeholder de la plantilla en la fase actual",
      placeholdersFail: (list) => `placeholders de la plantilla sin rellenar en la fase actual (o en una anterior): ${list}`,
      placeholdersLater: (list) => `las fases siguientes aún son plantilla (todavía no bloquea): ${list}`,
      traceDeferred: (files) => `aún no trazado — sigue siendo la plantilla de una fase posterior: ${files} (sus referencias de plantilla no son erratas ni bloquean esta fase); se traza cuando se escriba`,
      earsPlaceholder: (list) => `El criterio aún tiene placeholder(s) de la plantilla ${list} — escribe el disparador/comportamiento real.`,
      constitutionUnfilled: "la sección Verificación de la Constitución falta o está sin rellenar",
      checkLine: (id, detail) => `  ✗ ${id}${detail ? " — " + detail : ""}`,
      approveRefused: (phase, slug, ids, lines) => `No se puede aprobar '${phase}' de '${slug}' — verificaciones que fallan: ${ids}.\n${lines}\nCorrígelas (detalles: /spec-doctor ${slug}), o pasa force: true (CLI: --force) para registrar la aprobación igualmente — queda marcada como forzada.`,
      approveNothing: (phase, slug, file) => `Nada que aprobar: '${phase}' no tiene artefacto en '${slug}' (${file} no existe, o su track está desactivado) — ni con force.`,
      approveForced: (ids) => `Aprobado con force — las verificaciones que fallan quedan registradas con la aprobación: ${ids}.`,
      phaseOrder: (list, slug, first) => `hay fases anteriores aún sin aprobar: ${list} — apruébalas primero, en orden (/approve ${slug} ${first})`,
      forcedGates: (list) => `aprobado con force pese a verificaciones que fallan: ${list}`,
      finishRootCause: "bug.md → Causa Raíz sin rellenar — ninguna corrección antes de conocer la causa",
      finishPlaceholders: (list) => `placeholders de la plantilla sin rellenar en la cadena de la spec: ${list}`,
      finishChanged: (list) => `modificados tras su aprobación (revisar y volver a aprobar): ${list}`,
      bugGate: (n, first) => `La tarea ${n} aún no puede completarse: bug.md → Causa Raíz está sin rellenar. Ninguna corrección antes de que la causa raíz esté escrita en bug.md — haz primero la tarea ${first} (encuentra la causa raíz con evidencia y escríbela allí).`,
      bugGateFirst: (n, first) => `La tarea ${n} aún no puede completarse: bug.md → Causa Raíz está sin rellenar y ninguna tarea la escribe — solo la tarea ${first} puede completarse hasta que la causa raíz esté escrita en bug.md (ninguna corrección antes de la causa raíz).`,
      bugGateTicked: (n, rc) => `La tarea ${n} aún no puede completarse: bug.md → Causa Raíz sigue vacía — la tarea ${rc} está marcada, pero lo que entrega es esa sección. Escribe allí la causa raíz, con su evidencia (ninguna corrección antes de que la causa raíz esté escrita en bug.md).`,
      rootCauseTaskEmpty: (n) => `La tarea ${n} está marcada, pero bug.md → Causa Raíz sigue vacía — escribe allí la causa raíz, con su evidencia: las tareas siguientes (la prueba de regresión, la corrección) siguen rechazadas hasta que esté escrita.`,
      fill: (file, what, hint) => `Rellena ${file} — ${what}; luego ${hint}.`,
      fillMissing: "aún no existe",
      fillEmpty: "no tiene contenido además de los títulos",
      fillPlaceholders: (n, first) => `${n} placeholder(s) de la plantilla sin rellenar (primero: ${first})`,
      fillHint: {
        "classification.md": (slug) => `confirma los tracks y escribe el radio de impacto y las etiquetas de cumplimiento (/classify ${slug}), luego /approve ${slug} classification`,
        "requirements.md": (slug) => `compruébalo con /clarify ${slug} y ears_validate (${DEV_SPEC} ears ${slug})`,
        "bug.md": (slug) => `escribe la Reproducción y la Causa Raíz con evidencia (/spec-doctor ${slug})`,
        "design.md": (slug) => `ejecuta /spec-doctor ${slug} (secciones obligatorias, Verificación de la Constitución)`,
        "test-plan.md": (slug) => `comprueba la cobertura de los ACs con trace_check (${DEV_SPEC} trace ${slug})`,
        "eval-plan.md": (slug) => `define los umbrales y la baseline, luego /spec-doctor ${slug}`,
        "tasks.md": (slug) => `desglosa el diseño en tareas reales (/createTask ${slug}), luego trace_check`,
        "change.md": (slug) => `escribe el resumen, 1–3 criterios EARS, el enfoque y 1–3 tareas, cada una con un comando _Verify:_, y luego aprueba el plan en una sola llamada — spec_approve {name: "${slug}", through: "tasks"} (/spec-ff ${slug})`,
        default: (slug) => `/spec-doctor ${slug}`,
      },
      approveClassification: (slug) => `Confirma y aprueba la clasificación — /approve ${slug} classification.`,
      fixGate: (phase, list, slug) => `Antes de aprobar '${phase}', corrige lo que el gate de aprobación rechazaría: ${list} — después /approve ${slug} ${phase}.`,
      gateWouldRefuse: (phase, ids) => `aprobar '${phase}' sería rechazado (${ids})`,
      noRealTasks: "solo las tareas de la plantilla — divide el diseño en al menos una tarea real propia",
      testsNotInCode: (list) => `pruebas planeadas que ningún fichero de prueba nombra todavía: ${list} — escribe cada prueba que falla con su T-ID en el nombre (trace_check {code: true} las encuentra)`,
      testsNotInCodeSignOff: (list) => `pruebas planeadas que ningún fichero de prueba nombra todavía: ${list} — la implementación ya empezó: comprueba que cada una existe con su T-ID en el nombre de la prueba (test("T-01 …")) para que trace_check {code: true} la encuentre`,
      noPlannedTests: "test-plan.md no lista ningún T-ID — planea las pruebas primero",
      evalSetsSample: "evals/golden.json sigue siendo el conjunto de ejemplo del scaffold — escribe los casos golden de esta función, ejecuta el harness y registra la baseline",
      evalSetsMissing: "evals/golden.json no existe o no tiene ítems de eval ({\"items\": […]}) — escribe primero el conjunto golden de esta función",
      testsGateChecks: (ids) => `(el gate de aprobación comprueba esto: ${ids})`,
      clarifyPlaceholders: (file, n, list) => `Sustituye los ${n} placeholder(s)/TBD de la plantilla en ${file}: ${list}`,
      hookPlaceholders: (n, list, file = "requirements.md") => `Placeholders de la plantilla: ${n} sin rellenar en ${file} (${list}) — sustitúyelos antes de aprobar ${file === "change.md" ? "el plan" : "los requisitos"}.`,
    },

    brownfield: {
      frameworks: (list) => `  frameworks: ${list}`,
      routeLine: (method, p, loc) => `    ${method.padEnd(7)} ${p}  (${loc})`,
      moreRoutes: (n) => `    … ${n} más (--json las lista, hasta el límite)`,
      routesTruncated: (shown, total) => `Se muestran las primeras ${shown} de ${total} rutas — el recuento de endpoints las incluye todas.`,
      readCapped: (n) => `Solo se leyeron los primeros ${n} ficheros de código (rutas, nombres de variables de entorno, pistas de pruebas) — esas listas pueden estar incompletas.`,
      tests: (n, fws) => `  pruebas: ${n} fichero(s) · frameworks: ${fws}`,
      entrypoints: (list) => `  puntos de entrada: ${list}`,
      env: (list, more) => `  variables de entorno (solo nombres): ${list}` + (more ? ` … +${more}` : ""),
      migrations: (n, dirs) => `  migraciones/esquema: ${n} fichero(s)` + (dirs ? ` — ${dirs}` : ""),
      none: "ninguno",
      coverageTests: (n) => `  ficheros de prueba (aparte, no cuentan): ${n}`,
      coverageFolder: (folder, covered, files, pct) => `  ${folder.padEnd(24)} ${String(covered + "/" + files).padStart(9)}  ${pct}%`,
      root: "(raíz)",
      coverageUnmatched: (list) => `  ⚠ entradas _Implements:_ que no nombran nada en el disco: ${list}`,
      coverageNonCode: (list) => `  · entradas _Implements:_ que nombran pruebas o ficheros que no son código (no cuentan): ${list}`,
      integrationPlanPlaceholder: "integration-plan.md sigue siendo la plantilla — rellena los puntos de integración, las modificaciones y los riesgos antes de implementar",
      integrationPlanOk: "plan de integración rellenado",
    },
    importSpec: {
      note: (tool, rel, date) => `> Importado de ${tool} \`${rel}\` el ${date}.`,
      unknownTool: (tool, known) => `Formato de spec desconocido '${tool}'. Conocidos: ${known}.`,
      pathRequired: "falta la ruta — la carpeta (o un fichero) de la spec a importar.",
      outside: (p) => `'${p}' está fuera del proyecto — spec_import solo lee dentro de la carpeta del proyecto.`,
      notFound: (p) => `'${p}' no encontrado.`,
      nothing: (tool, p) => `No se encontraron ficheros de spec ${tool} en '${p}'.`,
      exists: (slug) => `La función '${slug}' ya existe — la importación nunca la sobrescribe. Indica otro nombre.`,
      featureTitle: (name) => `# Función: ${name}`,
      tasksTitle: (name) => `# Tareas: ${name}`,
      summary: "## Resumen",
      summaryPlaceholder: "[1-2 frases: qué hace y por qué importa]",
      stories: "## Historias de Usuario",
      story: (n, pri, title) => `### US-${n}${pri ? ` (${pri})` : ""}: ${title}`,
      criteria: "#### Criterios de Aceptación (EARS)",
      functional: "## Requisitos Funcionales",
      entities: "## Entidades Clave",
      success: "## Criterios de Éxito",
      edge: "## Casos Límite y Manejo de Errores",
      original: (tool, text) => `<!-- ${tool}: ${text} -->`,
      notEars: "[NEEDS CLARIFICATION: aún no es una frase EARS — añade su disparador (CUANDO/SI) y la respuesta del sistema]",
      noCriteria: "[NEEDS CLARIFICATION: esta historia no tiene criterios de aceptación]",
      optional: "(opcional)",
      modified: "(modificado)",
      importedNotes: "## Notas importadas",
      otherTasks: "## Otras tareas",
      ears: { while: "MIENTRAS", when: "CUANDO", if: "SI", where: "DONDE", then: "ENTONCES", shall: "EL SISTEMA DEBE", not: "NO", ensure: "EL SISTEMA DEBE garantizar que" },
      wNotEars: (ids) => `no convertidos a EARS (texto conservado, marcado [NEEDS CLARIFICATION]): ${ids}`,
      wNoCriteria: (ids) => `historias sin criterios de aceptación: ${ids}`,
      wNoCriteriaAtAll: "el origen no tiene criterios de aceptación — requirements.md aún no define ningún AC: escríbelos antes de aprobar los requisitos (hasta entonces, un plan de pruebas +tdd recibe una fila genérica)",
      wUnknownRef: (task, ref) => `tarea ${task}: la referencia _Requirements:_ '${ref}' no corresponde a ningún criterio importado — se conserva tal cual`,
      wUnknownRefLine: (line, ref) => `tasks.md, línea ${line}: la referencia _Requirements:_ '${ref}' no corresponde a ningún criterio importado — se conserva tal cual`,
      wCarried: (list) => `copiado tal cual, sin correspondencia con historias o criterios (revísalo): ${list}`,
      wNoRefs: "las tareas importadas no tienen referencias _Requirements:_ — añádelas para que trace_check asocie cada AC a una tarea",
      wNoTasks: "el origen no tiene tasks.md — se conservó el tasks.md del scaffold (los _Requirements:_ / _Makes green:_ de la plantilla limitados a los criterios importados)",
      taskAcPlaceholder: "[un criterio importado que prueba esta tarea]",
      taskTestPlaceholder: "[la prueba planificada que esta tarea pone en verde]",
      wNoDesign: (file) => `el origen no tiene ${file} — se conservó el design.md del scaffold`,
      wNoRequirements: (file) => `no se encontraron requisitos en ${file}`,
      wRemoved: (name) => `el requisito REMOVED '${name}' no se importó`,
      wRenamed: (from, to) => `requisito RENAMED '${from}' → '${to}' (importado con el nombre nuevo)`,
      wSkipped: (files) => `no importados (se quedan donde están): ${files}`,
      wUnreadable: (file) => `${file} apunta fuera del proyecto — omitido`,
      done: (tool, rel, slug, label, lang) => `Importado de ${tool} ${rel} → función '${slug}' [${label}] (${lang})`,
      mapping: (n, sample) => `  correspondencia: ${n} ID(s)` + (sample ? ` — ${sample}` : ""),
    },

    appendTasks: {
      heading: "Fase: Convergencia",
      checkpoint: "las tareas de convergencia están completadas y verificadas — la spec y el código vuelven a coincidir.",
      noTasks: "Indica al menos una tarea: tasks = [{ text, requirements?, implements?, verify?, makesGreen?, expectFail?, size?, depends?, story?, parallel? }].",
      noText: (i) => `Tarea ${i}: el texto es obligatorio.`,
      badStory: (i, v) => `Tarea ${i}: story debe ser US<n> (p. ej., US1) o shared (recibido '${v}').`,
      badPath: (i, p) => `Tarea ${i}: las rutas de _Implements:_ deben ser relativas a la raíz del proyecto, sin '..' (recibido '${p}').`,
      badVerify: (i) => `Tarea ${i}: _Verify:_ debe ser un comando de una sola línea.`,
      placeholderVerify: (i, v) => `Tarea ${i}: '${v}' se lee como un marcador de posición, no como un comando (un _Verify:_ entre [corchetes] se ignora) — indica el comando real (para una prueba de shell, 'test …' en lugar de '[ … ]').`,
      unstorable: (i, marker) => `Tarea ${i}: su ${marker} no se leería desde tasks.md tal como se dio — deja los marcadores fuera del texto de la tarea, ',' y ';' fuera de las rutas, y '_ ' fuera de rutas y comandos.`,
      phantom: (list, file = "requirements.md") => `Criterios de aceptación desconocidos (no están en ${file}): ${list}. No se ha escrito nada — corrige los IDs o añade primero los criterios.`,
      badHeading: "el encabezado debe ser una sola línea de texto.",
      constraintsHeading: (h) => `'${h}' contiene las restricciones que respetan todas las tareas, no tareas — elige un encabezado de fase. No se ha escrito nada.`,
      inactiveHeading: (h, track) => `'${h}' es la sección de tareas del track ${track}, que está inactivo — vuelve a añadir el track o elige otro encabezado. No se ha escrito nada.`,
      unsafe: (n) => `No se pudo añadir con seguridad: ${n ? `la tarea ${n} no se leería tal como se escribió` : "las tareas existentes cambiarían"} (¿un comentario o bloque de código sin cerrar cerca del final de la fase?). No se ha escrito nada.`,
      reapprove: (slug, file = "tasks.md") => `${file} cambió después de su aprobación — revisa las nuevas tareas y vuelve a aprobar: /approve ${slug} tasks.`,
      appended: (heading, created, file = "tasks.md") => `Añadido a ${file} → '${heading}'${created ? " (nueva fase)" : ""}:`,
      oneTaskPerCall: "append-tasks admite un --task por llamada — vuelve a ejecutarlo para la siguiente tarea (spec_append_tasks admite una lista).",
      oneValue: (flag) => `append-tasks admite --${flag} una sola vez por llamada — ${flag === "verify" ? "une las comprobaciones en un solo comando (a && b)" : "indica un único valor"}. No se ha escrito nada.`,
      badSize: (i, v) => `Tarea ${i}: size debe ser uno de XS, S, M, L, XL (recibido '${v}').`,
      badTestId: (i, v) => `Tarea ${i}: makesGreen admite IDs de pruebas planificadas (T-01, T-2 …) (recibido '${v}').`,
      phantomTests: (list) => `Pruebas desconocidas (no planificadas en test-plan.md): ${list}. No se ha escrito nada — corrige los T-IDs o planifica primero las pruebas.`,
      noTestPlan: (slug) => `makesGreen necesita un plan de pruebas: .specs/${slug}/test-plan.md no existe (añade primero +tdd). No se ha escrito nada.`,
    },

    taskDeps: {
      doctorOk: (n) => `${n} tarea(s) declaran _Depends:_ — cada una nombra una tarea activa, sin ciclos`,
      doctorFail: (list) => `${list} — corrige los marcadores _Depends:_ en tasks.md (números de tareas del mismo tasks.md: \`_Depends: 3, 5_\`)`,
      invalid: (n, tok) => `tarea ${n}: _Depends:_ '${tok}' no es un número de tarea`,
      phantom: (n, d) => `la tarea ${n} depende de la #${d}, que ninguna tarea activa tiene`,
      self: (n) => `la tarea ${n} depende de sí misma`,
      cycle: (list) => `tareas que se esperan entre sí (un ciclo): ${list}`,
      roadmapBlocked: (list) => `ninguna tarea abierta puede empezar (dependencias entre tareas): ${list}`,
      waitLine: (n, deps) => `#${n} espera a ${deps}`,
      blocked: (list, slug) => `Ninguna tarea pendiente puede empezar — cada una espera una dependencia que no está hecha: ${list}. Un ciclo o un _Depends:_ que no nombra ninguna tarea nunca se resuelve: corrige los marcadores _Depends:_ en .specs/${slug}/tasks.md (/spec-doctor ${slug} → task-deps).`,
      tickedEarly: (n, list) => `La tarea ${n} se marcó con sus dependencias ${list} aún pendientes — queda marcada como se pidió (una marca refleja lo que pasó); comprueba que no necesitaba su trabajo, o complétalas a continuación.`,
      briefHeading: "## Depende de",
      briefStatus: { done: "hecha", open: "pendiente", missing: "no existe" },
      briefOpenNote: "⚠ Algunas siguen pendientes — esta tarea se planificó para empezar después de ellas: responde NEEDS_CONTEXT si necesita su resultado.",
      badDepends: (i, v) => `Tarea ${i}: depends admite números de tarea (3 o #3) (recibido '${v}').`,
      selfDepends: (i, n) => `La tarea ${i} lleva aquí el número ${n} y dependería de sí misma. No se ha escrito nada.`,
      phantomDepends: (i, list, first, last) => `Tarea ${i}: depends no nombra ninguna tarea: ${list} — indica el número de una tarea activa, o de una tarea de esta llamada (aquí numeradas ${first === last ? first : first + "–" + last}). No se ha escrito nada.`,
      cycleDepends: (list) => `Las dependencias formarían un ciclo: ${list}. No se ha escrito nada.`,
      cliWaves: (n) => `Oleadas (${n}):`,
      cliWave: (k, list) => `  ${k}. ${list}`,
      cliNoWave: "  (ninguna tarea pendiente puede empezar)",
      cliCycles: (list) => `  ⚠ ciclo: ${list}`,
      cliBlocked: (list) => `  ⚠ bloqueadas: ${list}`,
      cliSkipped: (list) => `  en espera: ${list}`,
    },

    impact: {
      badPhase: (p, known) => `Fase '${p}' desconocida para spec_impact. Conocidas: ${known}.`,
      reopenTasks: "reopen se aplica a requirements, design, test-plan y eval-plan — un cambio en tasks.md se revisa y se vuelve a aprobar; no reabre nada.",
      changePhase: (phase, slug) => `'${slug}' es un cambio: sus criterios y sus tareas son un solo archivo, change.md, aprobado como el plan (fase tasks) — no hay fase ${phase}. spec_impact {name: "${slug}"} (fase tasks, la predeterminada) compara ambos: los criterios por ID, las tareas por número.`,
      retireTests: {
        retireHint: (list, slug, phase, offer) => `Pruebas eliminadas que aún ponen en verde algunas tareas — ${list}: no rehagas esas tareas; quita el T-ID de su _Makes green:_ o apúntalo a la prueba que la sustituye.` +
          (offer ? ` --reopen registra la solicitud de cambio sin desmarcarlas (${DEV_SPEC} impact ${slug} --phase ${phase} --reopen).` : ""),
        retireNote: (list) => `Las pruebas eliminadas no se rehacen — aún nombradas en _Makes green:_: ${list}: quita el T-ID de esas tareas, o apúntalo a la prueba que la sustituye.`,
        recordedRetire: (n, list, slug, phase) => `Solicitud de cambio #${n} registrada — nada desmarcado: las tareas de una prueba eliminada no se rehacen. Aún nombradas en _Makes green:_: ${list}: quita el T-ID de esas tareas, o apúntalo a la prueba que la sustituye; después vuelve a aprobar: /approve ${slug} ${phase}.`,
      },
      missing: (file, slug) => `No se encontró ${file} en '${slug}' — nada que comparar.`,
      neverApproved: (phase, slug) => `'${phase}' nunca se aprobó en '${slug}' — no hay versión aprobada con la que comparar. Apruébala primero: /approve ${slug} ${phase}.`,
      fingerprintOnly: (phase, slug) => `Esta aprobación es anterior al historial de cambios: solo se registró su huella, así que no se puede listar qué cambió. Vuelve a aprobar para iniciar el historial: /approve ${slug} ${phase}.`,
      noFingerprint: (phase, slug) => `Esta aprobación es anterior a las huellas de contenido: no se registró nada de la versión aprobada, así que no se puede saber si cambió ni qué (la fecha de un fichero no es prueba — un clon o una copia la restablece). Vuelve a aprobar para empezar a seguirla: /approve ${slug} ${phase}.`,
      reopenNeedsSnapshot: (phase) => `No se ha reabierto nada: sin una instantánea de '${phase}' aprobada no se pueden determinar las tareas afectadas.`,
      nothingNew: "Nada nuevo desde la última reapertura sobre esta aprobación — no se ha cambiado nada.",
      nothingToReopen: (changed) => (changed ? "Nada que reabrir: la edición no cambió ningún criterio ni sección (solo texto fuera de ellos) — no se ha cambiado nada."
        : "Nada ha cambiado desde la aprobación — nada que reabrir."),
      designFingerprintOnly: (slug) => `design.md también ha cambiado desde la aprobación, pero esta aprobación no guardó una instantánea de él (solo su huella), así que no se puede listar qué cambió allí. Vuelve a aprobar para iniciar su historial: /approve ${slug} design.`,
      reopenDesignUnknown: "No se ha reabierto nada: design.md ha cambiado, pero sin una instantánea de él tal como se aprobó no se pueden determinar las tareas afectadas.",
      reopened: (list, slug, phase) => `Reabiertas ${list}: desmarcadas y con su evidencia marcada como obsoleta — rehazlas con evidencia nueva y vuelve a aprobar: /approve ${slug} ${phase}.`,
      retireItem: (id, tasks, tests) => `${id} → ${[tasks.length ? "tareas " + tasks.join(", ") : "", tests.length ? "pruebas " + tests.join(", ") : ""].filter(Boolean).join(" · ")}`,
      retireHint: (list, slug, phase, offer) => `Criterios eliminados aún citados — ${list}: no rehagas esas tareas; elimínalas (y las filas de prueba) o apúntalas al criterio que lo sustituye.` +
        (offer ? ` --reopen registra la solicitud de cambio sin desmarcarlas (${DEV_SPEC} impact ${slug} --phase ${phase} --reopen).` : ""),
      retireNote: (list) => `Los criterios eliminados no se rehacen — aún citados: ${list}: elimina esas tareas y filas de prueba, o apúntalas al criterio que lo sustituye.`,
      recordedRetire: (n, list, slug, phase) => `Solicitud de cambio #${n} registrada — nada desmarcado: las tareas de un criterio eliminado no se rehacen. Aún citados: ${list}: elimina esas tareas y filas de prueba, o apúntalas al criterio que lo sustituye; después vuelve a aprobar: /approve ${slug} ${phase}.`,
      recordedOnly: (n, slug, phase) => `Solicitud de cambio #${n} registrada — ninguna tarea completada se ha visto afectada. Revísala y vuelve a aprobar: /approve ${slug} ${phase}.`,
      reopenHint: (slug, phase) => `Para desmarcar las tareas completadas afectadas y marcar su evidencia como obsoleta: ${DEV_SPEC} impact ${slug} --phase ${phase} --reopen (spec_impact {reopen: true}).`,
      nextHint: (slug, phases) => `Mira primero qué afecta la edición con spec_impact (${phases.map((p) => `${DEV_SPEC} impact ${slug} --phase ${p}`).join(" · ")}).`,
      doctorChanged: (list, slug, phases) => `modificado(s) tras su aprobación: ${list} — mira qué afecta la edición con spec_impact (${phases.map((p) => `${DEV_SPEC} impact ${slug} --phase ${p}`).join(" · ")}) y vuelve a aprobar`,
      doctorChangedPlain: (list, slug) => `modificado(s) tras su aprobación: ${list} — revisa y vuelve a aprobar (/approve ${slug} <fase>)`,
      staleNote: (n, slug, runnable) => `Tarea ${n}: su evidencia es anterior a un cambio de la spec (spec_impact la reabrió) — sigue sin verificar hasta que se registre ` +
        (runnable ? `una nueva ejecución correcta: ${DEV_SPEC} done ${slug} ${n} --run` : "evidencia nueva."),
      head: (slug, phase, date, snap) => `Impacto: ${slug} · ${phase} — frente a la aprobación del ${date} (${snap})`,
      headFp: (slug, phase, changed) => `Impacto: ${slug} · ${phase} — solo huella: ${changed ? "modificado desde la aprobación" : "sin cambios desde la aprobación"}`,
      headNone: (slug, phase, changed) => `Impacto: ${slug} · ${phase} — sin huella registrada: ${changed ? "modificado desde la aprobación (un fichero creado después)" : "no se puede saber si cambió"}`,
      noChanges: "sin cambios desde la aprobación",
      noStructural: "editado, pero ningún criterio, sección o tarea cambió (solo texto fuera de ellos)",
      affected: "Afectado:",
      tasksLabel: "tareas",
      testsLabel: "pruebas",
      designLabel: "diseño",
      idsLabel: "IDs",
      none: "ninguno",
      change: { added: "añadido", modified: "modificado", removed: "eliminado" },
      verified: "verificada",
      nothingToVerify: "nada que verificar (sin comando _Verify:_, nada registrado)",
      staleSpec: "la spec cambió desde esta evidencia; spec_impact reabrió la tarea",
      uncovered: (list) => `nuevos, aún sin una tarea que los cite: ${list}`,
      reReview: (slug, phase, roles) => `revisa el cambio y vuelve a aprobar: /approve ${slug} ${phase}` + (roles && roles.length ? ` --role ${roles[0]} (cada rol valida el nuevo contenido: ${roles.join(", ")})` : ""),
    },
    metrics: {
      writeNeedsName: "write necesita el nombre de una función — la retrospectiva es por función (spec_metrics {name, write: true} / " + DEV_SPEC + " metrics <función> --write).",
      retroWritten: (p) => `Retrospectiva → ${p} (rellenada con las métricas — el resto te toca a ti).`,
      retroExists: (p) => `${p} ya existe — no se ha modificado (una retrospectiva nunca se sobrescribe).`,
      unknown: "desconocida",
      source: { approval: "aproximada: a partir de la primera aprobación", filesystem: "aproximada: a partir de la fecha de la carpeta" },
      phase: { classification: "clasificación", requirements: "requisitos", design: "diseño", "test-plan": "plan de pruebas", "eval-plan": "plan de evals", tests: "pruebas", tasks: "tareas", execution: "ejecución", complete: "completada", finished: "cerrada" },
      head: (slug, tracks, created, approx) => `Métricas: ${slug} [${tracks}] — creada el ${created}${approx ? ` (${approx})` : ""}`,
      leadTimes: (list) => `  tiempo desde la creación: ${list}`,
      noLeadTimes: "  tiempo desde la creación: aún no hay nada aprobado",
      rework: (total, n, list, forced) => `  aprobaciones: ${total} · retrabajo: ${n}${list ? ` (${list})` : ""} · forzadas: ${forced}`,
      reworkUnknown: (forced) => `  retrabajo: desconocido (aprobaciones anteriores al historial de cambios) · forzadas: ${forced}`,
      reworkPartial: (total, n, list, forced, legacy) => `  aprobaciones: ${total} · retrabajo: al menos ${n}${list ? ` (${list})` : ""} · forzadas: ${forced} — retrabajo desconocido en ${legacy} (aprobaciones anteriores al historial de cambios)`,
      changes: (n, reopened) => `  solicitudes de cambio: ${n} · tareas reabiertas: ${reopened}`,
      evidence: (rate, pass, runs) => `  evidencia: ${rate}% de ejecuciones correctas (${pass}/${runs})`,
      noRuns: "  evidencia: ninguna ejecución registrada",
      tasks: (done, total, clar) => `  tareas: ${done}/${total} · marcadores de aclaración abiertos: ${clar}`,
      noFeatures: (dir) => `Aún no hay funciones en ${dir}`,
      projectHead: (n) => `Métricas — ${n} función(es)`,
      row: (created, complete, rework, forced, changes, pass, tasks) => [created ? `creada ${created}` : null, `completada ${complete}`, `retrabajo ${rework}`,
        `forzadas ${forced}`, `cambios ${changes}`, `correctas ${pass}`, tasks ? `tareas ${tasks}` : null].filter(Boolean).join(" · "),
      avg: "media",
      median: "mediana",
      medianLeads: (list) => `  mediana del tiempo desde la creación: ${list}`,
      totals: (done, total, pass, runs, changes, reopened) => `  total: tareas ${done}/${total} · ${runs ? `evidencia ${pass} de ${runs} ejecución(es) correctas` : "ninguna ejecución registrada"} · solicitudes de cambio ${changes} · tareas reabiertas ${reopened}`,
      retroText: {
        title: (f) => `# Retrospectiva: ${f}`,
        intro: (date) => `> Generada por dev-spec el ${date} a partir de .state.json, .history/ y los artefactos. Los números se calculan localmente; el resto te toca a ti. Nada de esto se aplica automáticamente.`,
        metrics: "## Métricas",
        header: "| Métrica | Valor |",
        created: "Creada",
        approximate: "aproximado",
        unknown: "desconocida",
        lead: (ph) => `Tiempo hasta ${ph}`,
        rework: "Retrabajo (nuevas aprobaciones)",
        reworkUnknown: "desconocido — las aprobaciones son anteriores al historial de cambios",
        reworkPartial: (value, legacy) => `al menos ${value} — desconocido en ${legacy} (aprobaciones anteriores al historial de cambios)`,
        forced: "Aprobaciones forzadas",
        changes: "Solicitudes de cambio",
        reopened: (n) => `${n} tarea(s) reabierta(s)`,
        passRate: "Tasa de éxito de la evidencia",
        runs: (rate, pass, runs) => `${rate}% (${pass}/${runs} ejecuciones)`,
        noRuns: "ninguna ejecución registrada",
        tasks: "Tareas",
        tasksValue: (done, total) => `${done}/${total} hechas`,
        clar: "Marcadores de aclaración abiertos",
        well: "## Qué salió bien",
        hurt: "## Qué costó",
        signals: (list) => `<!-- Señales de las métricas: ${list}. -->`,
        sigRework: (ph, n) => `'${ph}' aprobada ${n} vez/veces`,
        sigForced: (n) => `${n} aprobación(es) forzada(s) con comprobaciones fallidas`,
        sigReopened: (n) => `${n} tarea(s) reabierta(s) por solicitudes de cambio`,
        sigPass: (rate) => `solo el ${rate}% de las ejecuciones de verificación pasaron`,
        sigClar: (n) => `${n} marcador(es) de aclaración aún abiertos`,
        amend: "## Cambios propuestos al steering o a la constitución",
        amendNote: "<!-- Para aprobación humana — nunca se aplican automáticamente. Indica el archivo (.specs/steering/constitution.md, tech.md, …), el cambio exacto y por qué. -->",
        followUps: "## Seguimiento",
        followUpsNote: "<!-- Candidatos al backlog — añade los que aceptes con spec_backlog (dev-spec backlog add \"<nombre>\" \"<nota>\"). -->",
      },
      retro: (m, fmt) => MSG.en.metrics.buildRetro(MSG.es.metrics.retroText, MSG.es.metrics.phase, m, fmt),
    },

    deepTrace: {
      kinds: {
        uncoveredEdgeCases: "casos límite (EC) sin tarea ni prueba que los cubra",
        uncoveredNfr: "requisitos no funcionales (NFR) sin tarea ni prueba que los cubra",
        uncoveredSuccessCriteria: "criterios de éxito (SC) sin prueba ni paso del quickstart que los verifique",
        phantomSecondary: "las tareas / el plan de pruebas citan IDs EC/NFR/SC desconocidos (¿erratas?)",
        plannedNotInCode: "pruebas planificadas que ningún fichero de prueba nombra (pon el T-ID en el nombre de la prueba)",
        inCodeNotInPlan: "T-IDs en el código de prueba que ningún plan de pruebas incluye",
        unresolvedImplGlobs: "globs de _Implements:_ no resueltos del todo (el recorrido de ficheros se detuvo en su límite antes de una coincidencia — no cuentan como ausentes)",
      },
      secondaryOk: (n) => `los ${n} IDs EC/NFR/SC cubiertos`,
      testsInCodeOk: (n) => `cada T-ID planificado que una tarea hecha pone en verde aparece en un fichero de prueba (${n})`,
      testsInCodeMissing: (list) => `puestos en verde por tareas hechas, pero ningún fichero de prueba los nombra: ${list} — pon el T-ID en el nombre de una prueba (test("T-01 …"), def test_T01_…) en un fichero de prueba (una carpeta tests/, *.test.*, *_test.* …), en el archivo que indica la columna Archivo (o Fichero) del plan, si indica uno; una comprobación hecha fuera del código de prueba (un script de carga, un conjunto de evals) indica en su lugar su artefacto no código en la columna Archivo (load-test.md, evals/golden.json) y no se espera en un fichero de prueba`,
      truncated: "la búsqueda de ficheros de prueba se detuvo en el límite — algunos ficheros no se leyeron",
      codeSummary: (found, planned, scanned, truncated, outside) => `  pruebas en el código: ${found}/${planned} T-ID(s) planificado(s) nombrado(s) en ${scanned} fichero(s) de prueba` + (outside ? ` · comprobados fuera del código de prueba (la columna Archivo indica un artefacto que no es código): ${outside}` : "") + (truncated ? " (búsqueda truncada en el límite)" : ""),
      warningsHead: "Avisos (no bloquean):",
    },

    catalog: {
      title: (proj) => `Catálogo de specs — ${proj}`,
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_catalog {write: true} (dev-spec catalog --write).",
      intro: "Lo que el sistema hace hoy: todos los criterios de aceptación, agrupados por función. Un criterio sustituido por una función posterior ya entregada (_Supersedes:_) aparece tachado e indica el criterio que lo sustituye; uno que una función aún en curso prevé sustituir aparece como \"por sustituir\" y sigue vigente.",
      totals: (f, acs, current, sup, pending) => `**${f} función(es) · ${acs} criterios de aceptación — ${current} vigentes${pending ? ` (${pending} por sustituir)` : ""}, ${sup} sustituido(s)**`,
      status: { active: "en curso", complete: "completada", finished: "cerrada", archived: "archivada" },
      finishedOn: (d) => `cerrada el ${d}`,
      archivedOn: (d) => `archivada el ${d}`,
      supersededBy: (list) => `sustituido por ${list}`,
      toBeSupersededBy: (list) => `se sustituirá por ${list} (aún no entregada)`,
      supersedes: (list) => `sustituye a ${list}`,
      template: "plantilla — aún sin escribir",
      noAcs: "Aún sin criterios de aceptación.",
      noFeatures: "Aún sin funciones.",
      cliWrote: (file, f, acs, sup) => `✎ generado ${file}  (${f} función(es), ${acs} criterio(s), ${sup} sustituido(s))`,
    },
    supersedes: {
      phantom: (ref, reason, by) => `_Supersedes:_ ${ref}${by ? ` (en ${by})` : ""} — ${reason}`,
      renamed: (list) => `las referencias _Supersedes:_ a ella usan ahora el nombre nuevo, en: ${list}`,
      reason: { "bad-ref": "no tiene el formato <función>/US-n.AC-m", "unknown-feature": "esa función no existe (activa o archivada)", "unknown-ac": "esa función no tiene ese criterio", self: "una función no puede sustituir un criterio propio", unterminated: "el marcador nunca se cierra — termínalo con un guion bajo: _Supersedes: <función>/US-n.AC-m_" },
    },
    restore: {
      notArchived: (slug) => `No hay nada archivado como '${slug}' (.specs/_archive/${slug}/ no existe).`,
      activeExists: (slug) => `'${slug}' ya es una función activa — renómbrala o archívala antes de restaurar la archivada.`,
      done: (slug) => `'${slug}' restaurada desde .specs/_archive/ ✓`,
      noRecord: "Se archivó antes de que el archivado registrara su entrada en la hoja de ruta — vuelve a declarar sus dependencias con spec_depend, si las tenía.",
      skipDependsOn: (d, reason) => `su dependencia '${d}' (${reason})`,
      skipDependent: (k, reason) => `'${k}', que dependía de ella (${reason})`,
      skipRecord: (field, reason) => `el campo ${field} del registro de archivado (${reason})`,
      skipped: (list) => `No restaurado: ${list}.`,
      reason: { gone: "ya no existe", archived: "también archivada — restaurarla repone el vínculo", cycle: "cerraría un ciclo de dependencias", invalid: "formato inesperado — se omite" },
      renamedRecords: (list) => `registros de archivo actualizados al nombre nuevo (restore repone sus dependencias): ${list}`,
      prunedDependents: (list) => `las dependencias de las funciones que dependían de ella salieron de la hoja de ruta: ${list} (registrado — restore las repone)`,
      prunedIncomplete: (slug, pct, list) => `'${slug}' no estaba completa (${pct}%), pero ${list} dependía(n) de ella: la hoja de ruta deja de mostrarla(s) bloqueada(s) por ella — restáurala, o vuelve a declarar la dependencia con spec_depend, si aún necesita(n) ese trabajo`,
    },
    drift: {
      none: "Ninguna función cerrada tiene todavía una línea base de drift — spec_finish {write: true} (" + DEV_SPEC + " finish <función> --write) registra una cuando la función está lista para cerrar.",
      clean: (f, n, d, archived) => `  ✓ ${f}${archived ? " (archivada)" : ""}: ${n} fichero(s) de implementación sin cambios desde el cierre (${d})`,
      drifted: (f, n, total, d, archived) => `  ⚠ ${f}${archived ? " (archivada)" : ""}: ${n} de ${total} fichero(s) de implementación modificado(s) desde el cierre (${d})`,
      changed: (list) => `      modificados: ${list}`,
      missing: (list) => `      ausentes: ${list}`,
      nowPresent: (list) => `      ahora presentes (ausentes en el cierre): ${list}`,
      reopened: (list) => `  · reabiertas después del cierre (hay tareas pendientes — se comprueban al volver a cerrar): ${list}`,
      unbaselined: (list) => `  · aún sin línea base de cierre: ${list}`,
      stale: (f, d, why, archived) => `  ↻ ${f}${archived ? " (archivada)" : ""}: cambió desde el cierre (${d}) — ${why}; su línea base ya no la cubre: ${archived ? `restáurala (${DEV_SPEC} feature restore ${f}), ciérrala de nuevo (${DEV_SPEC} finish ${f} --write) y vuelve a archivarla` : `ciérrala de nuevo (${DEV_SPEC} finish ${f} --write)`}`,
      staleWhy: {
        changeRequests: (list) => `solicitud de cambio ${list}`,
        approvals: (list) => `reaprobado: ${list}`,
        newFiles: (n, list) => `${n} fichero(s) de implementación fuera de la línea base: ${list}`,
      },
      hookLine: (f, n) => `  ⚠ ${f}: ${n} fichero(s) de implementación modificado(s) desde el cierre — ejecuta ${DEV_SPEC} drift ${f}`,
      baselineRecorded: (n, missing) => `Línea base de drift registrada: ${n} fichero(s) de implementación${missing ? ` (${missing} ausente(s))` : ""} — ${DEV_SPEC} drift muestra lo que cambie después de este cierre.`,
      baselineReplaced: (n, day, list) => `Sustituida la línea base del ${day}, en la que ${n} fichero(s) habían cambiado: ${list} — la nueva línea base los acepta tal como están ahora.`,
    },

    guardMode: {
      ask: (pending, stale) => "dev-spec guard: ninguna tarea aprobada cubre cambios de código ahora mismo — aprueba las tareas de una función (spec_approve) o confirma para continuar." +
        (pending ? ` Funciones con tareas pendientes de aprobación: ${pending}.` : "") +
        (stale ? ` Tareas modificadas después de su aprobación (revísalas y vuelve a aprobar la fase tasks): ${stale}.` : "") + " (El modo guardia está activado — " + DEV_SPEC + " init --guard off lo desactiva.)",
      forced: (list) => `dev-spec guard: los cambios de código solo están cubiertos por una aprobación FORZADA de las tareas (${list}) — sus comprobaciones fallaban cuando se aprobó.`,
      on: "Modo guardia ACTIVADO — Write/Edit en ficheros de código fuera de .specs/ pide confirmación mientras ninguna función tenga tareas aprobadas sin terminar (roadmap.json meta.guard). Los ficheros de prueba se permiten mientras el plan de pruebas de una función sin terminar esté aprobado (la Fase 4 escribe las pruebas que fallan antes del gate de las tareas), y todo fichero de código mientras un spike esté en curso (su prototipo).",
      off: "Modo guardia DESACTIVADO — los cambios de código no se controlan.",
      badValue: (v) => `--guard admite on, off o scope (recibido '${v}').`,
    },
    approvalGuard: {
      on: {
        ask: "Guardia de aprobaciones ASK — una aprobación hecha por un agente (spec_approve / dev-spec approve, la eliminación de una función, bajar esta guardia) te pide confirmación antes (roadmap.json meta.approvalGuard). En los modos de permiso auto / bypass de Claude Code la solicitud de permiso puede no aparecer — 'deny' se mantiene en todos los modos.",
        deny: "Guardia de aprobaciones DENY — una aprobación hecha por un agente (spec_approve / dev-spec approve, la eliminación de una función, bajar esta guardia) se rechaza: apruebas tú, en tu propio terminal o en Claude Code con el prefijo ! (roadmap.json meta.approvalGuard).",
      },
      off: "Guardia de aprobaciones DESACTIVADA — las aprobaciones que pide un agente no se controlan (roadmap.json meta.approvalGuard).",
      badValue: (v) => `--approval-guard admite off, ask o deny (recibido '${v}').`,
      action: (a) => {
        const f = a.feature || "?";
        if (a.kind === "remove") return `borrar definitivamente la función '${f}' (su carpeta en .specs/, sus aprobaciones y su historial)`;
        if (a.kind === "guard-down") {
          if (a.setting === "evidence") return "volver a poner el modo de evidencia (meta.evidence) en reported";
          if (a.setting === "stopCheck") return "desactivar el gate de evidencia al final del turno (meta.stopCheck)";
          if (a.setting === "guard") return a.from ? `bajar el modo guardia (meta.guard) de ${a.from} a ${a.to}` : `poner el modo guardia (meta.guard) en ${a.to}`;
          if (a.setting === "roles") {
            if (!a.to || !Object.keys(a.to).length) return "eliminar los roles de aprobación (meta.approvalRoles)";
            return Array.isArray(a.removed) ? `quitar roles de aprobación exigidos (${a.removed.join(", ")}) de meta.approvalRoles` : "sustituir los roles de aprobación (meta.approvalRoles)";
          }
          if (a.setting === "check") return a.to == null ? `eliminar la verificación del proyecto '${a.name}' (meta.checks)` : `cambiar el comando de la verificación del proyecto '${a.name}' (meta.checks)`;
          if (a.setting === "roadmap") return "cambiar .specs/roadmap.json desde la shell — escribirlo, moverlo o borrarlo (ahí están la guardia de aprobaciones y los gates del proyecto)";
          return `bajar la guardia de aprobaciones de ${a.from} a ${a.to}`;
        }
        if (a.revoke) return `revocar la aprobación de la fase ${a.phase || "?"} de '${f}'` + (a.role ? ` como ${a.role}` : "") + (a.by ? ` en nombre de '${a.by}'` : "");
        return (a.through ? `aprobar todas las fases de '${f}' hasta ${a.through}` : `aprobar la fase ${a.phase || "?"} de '${f}'`) +
          (a.role ? ` como ${a.role}` : "") + (a.by ? ` en nombre de '${a.by}'` : "") +
          (a.force ? " — FORZADA (--force)" : "");
      },
      ask: (list, force) => `dev-spec approval guard: el agente quiere ${list}.` + (force ? " ⚠ FORCE: se saltan las comprobaciones de la fase — un gate que falla quedaría registrado como aprobado igualmente." : "") +
        " Las aprobaciones te corresponden — permítelo solo si lo apruebas tú. (meta.approvalGuard: ask — " + DEV_SPEC + " init --approval-guard deny rechaza sin más las aprobaciones de los agentes.)",
      deny: (list, command) => `dev-spec approval guard: rechazado — las aprobaciones son de la persona, y un agente no puede ${list}. ` +
        (command ? `Detente y pide al usuario que lo ejecute él mismo, en su propio terminal o en Claude Code con el prefijo ! (se ejecuta como el usuario, no como tu llamada de herramienta): ${command}` : "Detente y pide al usuario que haga él mismo ese cambio, en su propio editor o terminal") +
        " — y espéralo. No lo reintentes por otra vía (la herramienta MCP, la CLI, un script o una edición de los ficheros de .specs/). (meta.approvalGuard: deny.)",
      denyUser: (list, command) => `dev-spec approval guard rechazó la petición de un agente de ${list}.` + (command ? ` Para aprobarlo tú: ${command}` : " Si lo quieres, haz tú ese cambio."),
      denyMcp: (list, command) => `dev-spec approval guard: rechazado — las aprobaciones son de la persona, y un agente no puede ${list}. ` +
        (command ? `Detente y pide al usuario que lo ejecute él mismo, en su propio terminal: ${command}` : "Detente y pide al usuario que haga él mismo ese cambio, en su propio editor o terminal") +
        " — y espéralo. No lo reintentes por otra vía (la herramienta MCP, la CLI, un script o una edición de los ficheros de .specs/). (meta.approvalGuard: deny.)",
    },
    elicit: {
      message: (list, details) => `dev-spec: un agente pide ${list}.` + (details ? " " + details : "") + " Las aprobaciones te corresponden — marca Aprobar solo si lo apruebas tú.",
      gatePasses: "Las comprobaciones de la fase pasan.",
      forced: (ids) => `⚠ FORZADA: las comprobaciones de la fase fallan (${ids}) — quedaría registrada como aprobada igualmente.`,
      waiver: (reason, expires) => "Excepción: " + [reason ? `"${reason}"` : null, expires ? `hasta el ${expires}` : null].filter(Boolean).join(" ") + ".",
      phases: (list) => `Fases a aprobar, en orden: ${list}.`,
      approveTitle: "Aprobar",
      approveDesc: "Márcalo para registrarlo; déjalo sin marcar (o rechaza) para no aprobar.",
      noteTitle: "Nota",
      noteDesc: "Opcional — se registra con la aprobación (una línea).",
      declined: (list) => `El usuario lo rechazó en el cliente MCP: no se registró nada (${list}). No lo reintentes por otra vía — pregunta al usuario qué debe cambiar.`,
      unapproved: (list) => `El usuario respondió en el cliente MCP sin marcar Aprobar: no se registró nada (${list}). No lo reintentes por otra vía — pregunta al usuario si lo aprueba.`,
      cancelled: (list) => `El usuario cerró la confirmación: no se registró nada (${list}). Pregunta al usuario antes de volver a intentarlo.`,
      timedOut: (s, list) => `Sin respuesta del usuario en ${s} s: no se registró nada (${list}). Pide al usuario que lo apruebe él mismo.`,
      failed: (why, list) => `El cliente MCP no pudo preguntar al usuario (${why}): no se registró nada (${list}). Pide al usuario que haga él mismo la aprobación.`,
      confirmed: "Confirmado por el usuario en el cliente MCP (elicitation).",
    },
    mergeState: {
      doctor: (n, list) => `${n} conflicto(s) de merge que el merge driver de dev-spec dejó sin resolver — ${list}. En cada uno quedó el valor de ours: elige el valor correcto en el fichero (la lista "mergeConflicts" muestra base / ours / theirs) y después borra "mergeConflicts".`,
      conflictHead: (file, n) => `dev-spec merge-state: ${file}: ${n} conflicto(s) — quedó el valor de ours en cada uno, listados en el fichero bajo "mergeConflicts":`,
      conflictLine: (p, ours, theirs, base) => `  ${p}: ours ${ours} · theirs ${theirs} · base ${base}`,
      conflictTail: "Elige cada valor en el fichero, borra \"mergeConflicts\" y haz git add.",
      absent: "(ausente)",
      parseError: (side, why) => `dev-spec merge-state: ${side} no es JSON válido (${why}) — no se combinó nada y ours quedó como estaba; combina el fichero a mano.`,
      unreadable: (file) => `no se puede leer ${file}.`,
      noGit: (dir) => `${dir} no está dentro de un repositorio git (o git no está instalado) — merge-state --install escribe la configuración git de ese repositorio.`,
      attrsAdded: (file) => `${file}: líneas del merge driver añadidas (haz commit — todo el equipo las recibe):`,
      attrsKept: (file) => `${file}: las líneas del merge driver ya están.`,
      attrsRemoved: (file) => `${file}: líneas del merge driver eliminadas (haz commit).`,
      attrsNone: (file) => `${file}: ninguna línea del merge driver que eliminar.`,
      configSet: (key, value) => `git config ${key} = ${value}`,
      configRemoved: (key) => `git config: ${key} eliminado.`,
      configFailed: (why) => `git config falló: ${why}`,
      teamNote: `La configuración de git es de cada clon: cada persona del equipo ejecuta ${DEV_SPEC} merge-state --install una vez — y de nuevo tras cada actualización del plugin (git ejecuta el driver por la ruta de la carpeta de este plugin, que una actualización cambia; ${DEV_SPEC} merge-state --check dice si está al día). Sin ella, git usa su merge de texto.`,
      checkOk: (script) => `El merge driver del estado de la spec está instalado y ejecuta la CLI de este clon (${script}).`,
      checkNone: `El merge driver del estado de la spec no está instalado aquí y .gitattributes no lo nombra — nada que comprobar (para instalarlo: ${DEV_SPEC} merge-state --install).`,
      checkNotInstalled: (file) => `${file} nombra el merge driver dev-spec-state, pero la configuración git de este clon no lo tiene — git usa su merge de texto (un .state.json cambiado en las dos ramas entra en conflicto). Instálalo: ${DEV_SPEC} merge-state --install`,
      checkOther: (script, cli) => `git ejecuta el merge driver del estado de la spec desde ${script}, no desde la CLI de este clon (${cli}) — vuelve a ejecutar: ${DEV_SPEC} merge-state --install`,
      checkMissing: (script) => `git ejecuta el merge driver del estado de la spec desde ${script}, que ya no existe (una actualización del plugin lo mueve a otra carpeta) — git informa entonces de un conflicto y se queda solo con tu lado de .state.json / roadmap.json. Vuelve a ejecutar: ${DEV_SPEC} merge-state --install`,
      checkNoGit: (dir) => `${dir} no está dentro de un repositorio git (o git no está instalado) — no hay merge driver que comprobar.`,
      hookLine: (script, missing) => `⚠ El merge driver git del estado de la spec ejecuta ${script}, ${missing ? "que ya no existe (una actualización del plugin lo movió de carpeta)" : "que no es la CLI de este plugin"} — un merge se quedaría solo con tu lado de .state.json / roadmap.json. Vuelve a ejecutar: ${DEV_SPEC} merge-state --install`,
    },
    scopedSteering: {
      customHint: "— o un fichero de steering propio, con alcance: letras minúsculas, dígitos y '-', terminado en .md (p. ej. api-conventions.md).",
      reservedName: (file) => `'${file}' es un nombre reservado (un nombre de dispositivo de Windows o un miembro nativo de JavaScript) — elige otro nombre para el fichero de steering.`,
      customStub: (title, pattern) => `---\ninclusion: fileMatch\nfileMatchPattern: "${pattern}"\n---\n\n# ${title}\n\n` +
        "<!-- Steering con alcance. El front matter decide cuándo spec_task_brief incluye este fichero:\n" +
        "     inclusion: always    → en todos los briefs de tarea\n" +
        "     inclusion: fileMatch → solo en las tareas cuyas rutas _Implements:_ coinciden con fileMatchPattern\n" +
        "                            (glob: ** · * · ? · {a,b}; admite una lista: [\"src/api/**\", \"src/routes/**\"])\n" +
        "     inclusion: manual    → nunca automáticamente; los briefs lo listan como disponible bajo petición\n" +
        "     Sustituye el patrón de ejemplo y las líneas entre corchetes de abajo. -->\n\n" +
        "## Reglas\n- [Una regla que todo fichero que coincida con el patrón debe seguir.]\n\n## Ejemplos\n- [Un ejemplo breve — o una referencia a un fichero que muestre el patrón.]\n",
      placeholders: (list) => `aún con placeholders de la plantilla: ${list}`,
      scoped: "Steering con alcance (fileMatch — coincide con los ficheros de esta tarea):",
      manual: "Disponible bajo petición (steering manual):",
    },
    designSaveCheck: {
      head: (slug, tracks) => `Verificación del diseño en design.md (${slug} [${tracks}]):`,
      clean: (tracks, constitution) => `Verificación del diseño [${tracks}]: secciones obligatorias${constitution ? " y Verificación de la Constitución" : ""} rellenadas, sin placeholders de la plantilla ✓`,
      sections: (marker, list) => `secciones ${marker}: ${list}`,
      constitution: {
        missing: "Verificación de la Constitución: falta — añade la sección y verifica cada principio de steering/constitution.md",
        unfilled: "Verificación de la Constitución: sin rellenar",
      },
      placeholders: (n, list) => `${n} placeholder(s) de la plantilla por sustituir: ${list}`,
      hint: (slug) => `Rellénalos antes de aprobar el diseño — detalles: /spec-doctor ${slug}.`,
    },
    upgrade: {
      head: (from, to, mode) => mode === "unknown" ? "dev-spec upgrade — la versión de este motor es desconocida (no hay package.json a su lado): no se sellará nada."
        : mode === "behind" ? `dev-spec upgrade — .specs/ ${from ? `en la ${from}` : "de antes de la 1.13 (sin sello de versión)"} → dev-spec ${to}`
        : mode === "pending" ? `dev-spec upgrade — .specs/ en la ${from} (este dev-spec: ${to}), pero aún hay migraciones pendientes`
        : `dev-spec upgrade — .specs/ en la ${from}: al día con este dev-spec (${to})`,
      newer: (from, to) => `.specs/ lo actualizó por última vez un dev-spec más reciente (${from}) que este (${to}) — actualiza el plugin antes de fiarte de esta auditoría.`,
      summary: (n, blocked, attention, ok, archived) => `${n} función(es) activa(s): ${blocked} bloqueada(s) · ${attention} necesita(n) atención · ${ok} ok` + (archived ? ` · ${archived} archivada(s) (no revisada(s))` : ""),
      noFeatures: "No hay funciones activas — nada que revisar.",
      group: { blocked: "⛔ Bloqueadas — el doctor falla:", attention: "▲ Necesitan atención:", ok: "✓ OK:" },
      status: { "not-started": "sin empezar", planning: "en planificación", executing: "en ejecución", complete: "completada", finished: "cerrada" },
      feature: (name, status, tracks, phase, done, total, bugfix) => `${name} — ${status} · [${tracks}] · ${phase} · ${done}/${total} tareas${bugfix ? " · bugfix" : ""}`,
      tracksInferred: "sus tracks se dedujeron de los ficheros — el apply los guarda en .state.json",
      item: {
        error: (e) => `Corrígelo primero a mano: ${e}`,
        fix: (list) => `Corrige lo que el doctor da como fallo: ${list}`,
        approve: (list, slug) => `Aprueba el/los gate(s) pendiente(s), por orden: ${list} — /approve ${slug} <fase>`,
        reReview: (list, cmds) => `Revisa lo que cambió después de su aprobación: ${list}` + (cmds ? ` — mira primero la diferencia: ${cmds}` : "") + "; después vuelve a aprobar",
        reapprove: (list) => `Vuelve a aprobar para empezar el historial de cambios (spec_impact aún no puede comparar estas): ${list}`,
        verify: (list, slug) => `Registra una ejecución correcta de las tareas marcadas que no la tienen: ${list} — ${DEV_SPEC} done ${slug} <n> --run`,
        drift: (n, slug) => `Decide sobre la deriva: ${n} fichero(s) de implementación cambiado(s) desde el cierre — ${DEV_SPEC} drift ${slug}`,
        stale: (slug) => `Cambió después del cierre — ciérrala de nuevo: /spec-finish ${slug}`,
        packReserved: (list, slug, since) => `Cambia el nombre de su(s) track pack(s) anterior(es) a la ${since || "1.17"} — ${list}: el nombre está reservado ahora, así que el track está inactivo (detalles: ${DEV_SPEC} doctor ${slug}, comprobación track-pack-missing)`,
        packMarkerReserved: (list, slug, since, tracks) => `Cambia el marcador de su(s) track pack(s) anterior(es) a la ${since || "1.19"} — ${list}: el marcador es ahora el de un track de serie, así que el pack está inactivo; o usa el track de serie: ${DEV_SPEC} add-track ${slug} ${tracks} (detalles: ${DEV_SPEC} doctor ${slug}, comprobación track-pack-missing)`,
        critic: (files) => `Revísala con el agente spec-critic (solo lectura), fase a fase: ${files || "—"}`,
        converge: (files) => "Ejecuta la pasada de convergencia del spec-reviewer (las tareas hechas frente a sus ACs)" + (files ? `, después el agente spec-critic sobre ${files}` : ""),
        none: "No necesita revisión de la spec — todas las tareas están hechas",
        next: (rec) => `Siguiente: ${rec}`,
        warnings: (list) => `Avisos: ${list}`,
      },
      reason: { "no-fingerprint": "aprobada antes de las huellas de contenido", changed: "cambiada después de su aprobación", missing: "su fichero no existe", untracked: "una aprobación de diseño de bugfix de la 1.12 — bug.md nunca se siguió", "snapshot-missing": "el fichero de su snapshot ha desaparecido" },
      planHead: "El apply cambiaría (spec_upgrade {apply: true} · " + DEV_SPEC + " upgrade --apply) — nunca un artefacto, una aprobación ni una marca:",
      migHead: "Migraciones aplicadas — ningún artefacto editado, nada aprobado, marcado ni borrado:",
      migStamp: (from, to) => `meta.specVersion: ${from || "ninguna"} → ${to}`,
      migTracks: (list) => `tracks guardados en .state.json: ${list}`,
      migSeeded: (list) => `líneas base de aprobación guardadas: ${list}`,
      planSeed: (list) => `líneas base de aprobación a guardar en .history/ (el fichero aún coincide con su aprobación): ${list}`,
      migRecords: (n) => `${n} aprobación(es) anterior(es) registrada(s) en approvalHistory`,
      migSkipped: (list) => `sin línea base — vuelve a aprobar para empezar el historial: ${list}`,
      migGitignore: (n) => `.specs/.gitignore: ${n} línea(s) añadida(s)`,
      migErrors: (list) => `no migrado: ${list} — corrígelo y vuelve a ejecutar el upgrade (meta.specVersion se queda como está hasta entonces)`,
      nothing: "Nada que migrar — .specs/ ya está al día; no se ha cambiado nada.",
      upToDate: "Nada que migrar — la lista de arriba es lo que señalan las reglas actuales.",
      applyHint: "No se ha cambiado nada. Revisa la lista y después aplica las migraciones seguras: " + DEV_SPEC + " upgrade --apply (spec_upgrade {apply: true}).",
      reportAt: (file) => `Informe: ${file} — una lista de comprobación para ir cumpliendo (/spec-upgrade).`,
      reportKept: (file) => `${file} existe y no lo generó dev-spec — se ha dejado intacto (informe no escrito).`,
      hookLine: (from) => `⬆ .specs/ se creó con un dev-spec más antiguo (${from || "anterior a la 1.13"}) — ejecuta /spec-upgrade (${DEV_SPEC} upgrade) para revisar lo que aún no está implementado (o pide simplemente actualizar las specs)`,
      md: {
        title: (proj) => `dev-spec upgrade — ${proj}`,
        autogen: "AUTO-GENERADO por dev-spec — marca las casillas a medida que avanzas; spec_upgrade {apply: true} (dev-spec upgrade --apply) lo escribe cuando migra algo.",
        intro: (from, to) => `.specs/ actualizado de ${from || "un dev-spec anterior a la 1.13"} a ${to || "?"}. Por función: lo que señalan las reglas de la ${to || "?"}, qué hacer y qué revisión ejecutar. Trabájalo con /spec-upgrade (Claude Code) o dev-spec upgrade; vuelve a ejecutar la auditoría cuando quieras para ver el estado actual.`,
        migrations: "Migraciones",
        group: { blocked: "⛔ Bloqueadas — el doctor falla", attention: "▲ Necesitan atención", ok: "✓ OK" },
        footer: "Todo cambio pasa por los gates normales: nuevas aprobaciones con spec_approve (/approve), ediciones de la spec tras una aprobación con spec_impact (/spec-impact), trabajo de seguimiento con spec_append_tasks (/spec-converge). Nada de esto se aplica automáticamente.",
      },
    },

    promptsResources: {
      preamble: (agentsMd, refsDir) => `Nota para el agente: si no hay una skill dev-spec-driven disponible en esta herramienta, sigue el flujo del AGENTS.md del plugin (${agentsMd}) y usa las herramientas MCP spec-driven (spec_*, ears_validate, trace_check); los archivos references/… citados abajo están en ${refsDir}.`,
      argDesc: (hint) => (hint ? `Argumentos (opcionales): ${hint}` : "No necesita argumentos (texto libre opcional)."),
      cliHead: (n) => `${n} prompt(s) — uno por comando del plugin; ${DEV_SPEC} prompts <nombre> [--args "…"] muestra uno:`,
      res: {
        roadmap: "La hoja de ruta del proyecto (.specs/ROADMAP.md): la fase, el progreso y las dependencias de cada función.",
        roadmapFromJson: "La hoja de ruta del proyecto, generada a partir de .specs/roadmap.json (aún sin ROADMAP.md escrito).",
        catalog: "El catálogo vivo (.specs/SPECS.md): todas las funciones y criterios de aceptación, con los sustituidos marcados.",
        steering: (file) => `Archivo de steering .specs/steering/${file} — reglas del proyecto que siguen todas las funciones.`,
        artifact: (slug, label, file) => `${label} de la función '${slug}' (.specs/${slug}/${file}).`,
        labels: {
          "classification.md": "Clasificación (tracks)", "requirements.md": "Requisitos (EARS)", "design.md": "Diseño técnico", "test-plan.md": "Plan de pruebas",
          "eval-plan.md": "Plan de evals", "load-test.md": "Plan de pruebas de carga", "tasks.md": "Tareas", "bug.md": "Informe del bug (reproducción · causa raíz · corrección)",
          "quickstart.md": "Guía rápida", "checklist.md": "Lista de comprobación", "integration-plan.md": "Plan de integración", "retro.md": "Retrospectiva",
          "spike.md": "Spike (pregunta · evidencia · decisión)", "decisions.md": "Registro de decisiones", "change.md": "Cambio (criterios · enfoque · tareas)", // 1.14 C2 · 1.21 F5
        },
        tplFeature: (list) => `Un artefacto de la spec de una función: .specs/{slug}/{artifact} — {artifact} es uno de ${list}.`,
        tplSteering: "Un archivo de steering: .specs/steering/{file} (un archivo .md).",
        truncated: (cap, total) => `Lista de recursos limitada a ${cap} de ${total} — lee los demás mediante las plantillas specs://feature/{slug}/{artifact} y specs://steering/{file}.`,
      },
      err: {
        noPromptName: "prompts/get necesita el `name` del prompt (una cadena).",
        badPromptArgs: 'prompts/get: `arguments` debe ser un objeto de cadenas, p. ej. {"args": "login"}.',
        unknownPrompt: (name, list) => `Prompt desconocido '${name}' — uno de: ${list}.`,
        noUri: "resources/read necesita el `uri` del recurso (una cadena).",
        badUri: (uri) => `URI de recurso no válido '${uri}' — se esperaba specs://roadmap, specs://catalog, specs://steering/<archivo>.md o specs://feature/<slug>/<artefacto> (sin '..', sin ruta absoluta, sin otro esquema).`,
        unknownArtifact: (a, list) => `Artefacto desconocido '${a}' — uno de: ${list}.`,
        badSteering: (file) => `Nombre de archivo de steering no válido '${file}' — un archivo .md directamente en .specs/steering/.`,
        notFound: (uri, detail) => `Recurso no encontrado: ${uri}` + (detail ? ` — ${detail}` : ""),
      },
    },

    // 1.16 C — integración con Claude Code (status line, puente del plan mode, spec_import {text}, completion/complete).
    claudeCode: {
      statusLine: {
        head: (slug, kind) => `◆ ${slug}` + (kind === "bugfix" ? " (bugfix)" : kind === "spike" ? " (spike)" : ""),
        tasks: (done, total) => `${done}/${total} tareas`,
        unverified: (n) => `${n} sin verificar`,
        next: (step) => `siguiente: ${step}`,
        none: "◆ dev-spec · aún no hay funciones — /spec",
        steps: {
          "re-review": (s) => `revisar ${s.files.join(", ")}`,
          fill: (s) => `completar ${s.file}`,
          fix: (s) => (s.file === "bug.md" ? "escribir la causa raíz en bug.md" : `corregir el gate ${s.phase}`),
          approve: (s) => `aprobar ${s.phase}`,
          tests: () => "escribir los tests y luego aprobarlos (Fase 4)",
          tasks: () => "dividir en tareas",
          implement: (s) => `tarea ${s.task}`,
          blocked: () => "desbloquear las tareas (_Depends:_)",
          verify: (s) => (s.suite ? `ejecutar las comprobaciones del proyecto (${s.suite.join(", ")})` : `verificar la tarea ${s.task}`),
          decide: (s) => (s.outcome ? "añadir la línea _Outcome:_ a la decisión" : "escribir la decisión"),
          promote: () => "go — crear la spec de la función, archivar el spike",
          archive: () => "no-go — archivar el spike",
          pivot: () => "pivot — empezar un spike nuevo",
          finish: (s) => (s.again ? "/spec-finish de nuevo" : "/spec-finish"),
          "sign-off": (s) => (s.again ? "aprobar execution de nuevo (sign-off)" : "aprobar execution (sign-off)"),
          finished: () => "terminada",
        },
        config: {
          head: "Status line — añade esto a ~/.claude/settings.json (todos los proyectos) o al .claude/settings.local.json de un proyecto (solo en esta máquina — la ruta es de esta máquina, así que nunca en el .claude/settings.json versionado):",
          after: "Muestra una línea — la función más activa, sus tareas, las tareas sin verificar y el siguiente paso — y nada fuera de un proyecto dev-spec.",
          cacheNote: "Esta ruta es una copia con versión en la caché de plugins de Claude Code (…/plugins/cache/…): tras actualizar el plugin, vuelve a ejecutar /spec-statusline — la copia antigua se borra 14 días después de una actualización.",
          tryIt: (cmd) => `Pruébalo: echo '{"cwd": "<tu proyecto>"}' | ${cmd}`,
        },
      },
      planBridge: {
        byText: "dev-spec: el usuario aprobó este plan. Para seguirlo como spec (criterios EARS, tareas trazadas, gates de evidencia), propón /spec-import — spec_import {tool: \"plan\", text: <el markdown del plan aprobado>} (CLI: " + DEV_SPEC + " import plan - < plan.md). El fichero del plan en ~/.claude/plans está fuera del proyecto, así que pasa su texto. Para un cambio rápido, omítelo; importa solo con el OK del usuario.",
        byPath: (rel) => `dev-spec: el usuario aprobó este plan. Para seguirlo como spec (criterios EARS, tareas trazadas, gates de evidencia), propón /spec-import — spec_import {tool: "plan", path: "${rel}"} (CLI: ${DEV_SPEC} import plan ${rel}). Para un cambio rápido, omítelo; importa solo con el OK del usuario.`,
      },
      importText: {
        label: "(texto)",
        note: (tool, date) => `> Importado de ${tool} (texto) el ${date}.`,
        orText: "O pasa su markdown como `text` en lugar de `path` (spec_import {tool, text}; CLI: " + DEV_SPEC + " import <tool> - < fichero.md).",
        textOnly: (tool, list) => `\`text\` importa un único documento — herramienta ${list}; '${tool}' lee una carpeta: indica su \`path\`.`,
        pathAndText: "Indica `path` o `text`, no ambos.",
        empty: (tool) => `El texto ${tool} está vacío — nada que importar.`,
      },
      completion: {
        badRequest: 'completion/complete necesita `ref` ({type: "ref/prompt", name} o {type: "ref/resource", uri}) y `argument` {name, value} (texto).',
        promptsOff: "Este servidor no sirve prompts (SPEC_MCP_PROMPTS=off) — nada que completar.",
        unknownTemplate: (uri, list) => `Plantilla de recurso desconocida '${uri}' — una de: ${list}.`,
        unknownArgument: (name, list) => `Argumento desconocido '${name}' — uno de: ${list}.`,
      },
    },

    secPrivacy: {
      sectionNames: {
        "Threat Model": "Modelo de Amenazas", "Security Requirements": "Requisitos de Seguridad", "Authentication & Authorization": "Autenticación y Autorización",
        "Secrets & Key Management": "Gestión de Secretos y Claves", "Security Testing": "Pruebas de Seguridad",
        "Personal Data Inventory": "Inventario de Datos Personales", "Lawful Basis & Purpose": "Base Jurídica y Finalidad",
        "Retention & Deletion": "Conservación y Supresión", "Data Subject Rights": "Derechos de los Interesados",
        "Processors & International Transfers": "Encargados del Tratamiento y Transferencias Internacionales", "DPIA": "EIPD",
        "Consistency Model": "Modelo de Consistencia", "Cross-system Writes": "Escrituras entre Sistemas", "Delivery & Idempotency": "Entrega e Idempotencia",
        "Concurrency": "Concurrencia", "Failure Modes": "Modos de Fallo",
        "API Contract": "Contrato de la API", "Versioning & Compatibility": "Versionado y Compatibilidad", "Error Model": "Modelo de Errores", "Pagination, Idempotency & Concurrency": "Paginación, Idempotencia y Concurrencia", "Rate Limits & Quotas": "Límites de Tasa y Cuotas",
        "Design System Usage": "Uso del Design System", "UI States": "Estados de la Interfaz", "Accessibility": "Accesibilidad", "Responsiveness & i18n": "Diseño Adaptable e i18n", "UI Performance Budget": "Presupuesto de Rendimiento de la Interfaz",
        "SLIs & SLOs": "SLIs y SLOs", "Telemetry": "Telemetría", "Alerting & Runbooks": "Alertas y Runbooks", "Rollout & Rollback": "Despliegue y Reversión", "Health & Capacity": "Salud y Capacidad",
        "Data Contracts & Schema Evolution": "Contratos de Datos y Evolución del Esquema", "Data Quality": "Calidad de los Datos",
        "Pipeline Idempotency & Backfills": "Idempotencia del Pipeline y Backfills", "Lineage & Ownership": "Linaje y Responsables", "Retention & Cost": "Retención y Coste",
      },
      allFilled: { sec: "las 5 rellenadas", privacy: "las 6 rellenadas", dist: "las 5 rellenadas", api: "las 5 rellenadas", ui: "las 5 rellenadas", obs: "las 5 rellenadas", data: "las 5 rellenadas" },
      statusSections: { sec: (list) => `Secciones de seguridad: ${list}`, privacy: (list) => `Secciones de privacidad: ${list}`, dist: (list) => `Secciones de consistencia de datos: ${list}`, api: (list) => `Secciones del contrato de la API: ${list}`, ui: (list) => `Secciones de la interfaz: ${list}`, obs: (list) => `Secciones de operabilidad: ${list}`,
        data: (list) => `Secciones del pipeline de datos: ${list}` },
      finishChecks: {
        sec: ["+sec: SAST, auditoría de dependencias y análisis de secretos limpios en una ejecución local nueva; todas las pruebas de casos de abuso en verde.",
          "+sec: modelo de amenazas revisado contra el código final — ningún punto de entrada ni frontera de confianza nuevo sin mitigar."],
        privacy: ["+privacy: acceso/exportación y supresión verificados de extremo a extremo en los almacenes reales (encargados incluidos).",
          "+privacy: proceso de conservación programado; política de privacidad y registro de actividades de tratamiento (art. 30) actualizados; decisión sobre la EIPD registrada."],
        dist: ["+dist: pruebas de inyección de fallos en verde en una ejecución local nueva — caída entre el commit y la publicación, entrega duplicada, actualizaciones concurrentes, una dependencia caída.",
          "+dist: ninguna escritura entre sistemas del código final se salta su mitigación (outbox / inbox / saga) — ningún commit en la base de datos seguido de una publicación directa."],
        api: ["+api: pruebas de contrato y la comparación de cambios incompatibles con el contrato publicado en verde en una ejecución local nueva.",
          "+api: el fichero del contrato coincide con el comportamiento entregado — cada código de estado, código de error y cabecera documentados es lo que devuelven los handlers; lo eliminado está obsoleto con su fecha de Sunset."],
        ui: ["+ui: la comprobación automática de accesibilidad limpia y la pasada con teclado / lector de pantalla hecha en la versión final; cada estado de la matriz de estados alcanzable y mostrado.",
          "+ui: el presupuesto de rendimiento medido en la versión final (LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1) y la regresión visual de los estados revisada."],
        obs: ["+obs: una alerta saltó en un fallo escenificado y el simulacro de reversión se hizo en la versión final; los dashboards y runbooks que enlazan las alertas existen.",
          "+obs: las métricas, los logs y las trazas que indica el diseño vistos emitiéndose desde la versión final — ningún dato personal en logs ni trazas."],
        data: ["+data: las comprobaciones de calidad de datos, una reejecución de partición y un ensayo de backfill en verde en una ejecución nueva con datos de tamaño real — las mismas filas que una ejecución, las filas erróneas en cuarentena.",
          "+data: cada conjunto de datos que escribe el código final cumple su contrato (esquema, responsable, SLA de frescura) y el linaje, la retención y el particionado de design.md."],
      },
      clarify: {
        secAccess: "Especifica qué recibe quien llama sin autenticación o sin autorización (SI … ENTONCES EL SISTEMA DEBE denegar …) y el nivel ASVS al que apunta la función.",
        secSecrets: "Especifica qué secretos / credenciales maneja la función y que ninguno llega a una respuesta o a un log (escríbelo como AC).",
        privacyRights: "Especifica los derechos de los interesados que la función debe atender (acceso, supresión, portabilidad…) como ACs, con el plazo de un mes.",
        privacyRetention: "Especifica cuánto tiempo se conserva cada categoría de datos personales y qué ocurre cuando vence ese plazo.",
        distDelivery: "Especifica la garantía de entrega (al menos una vez) y cómo un mensaje entregado dos veces se detecta y se aplica una sola vez (clave de idempotencia, inbox) — escríbelo como AC.",
        distFailure: "Especifica qué hace la función cuando cada dependencia (base de datos, broker, API externa) no está disponible o agota el tiempo de espera — como criterios SI … ENTONCES EL SISTEMA DEBE.",
      },
    },

    markerSyntax: {
      doctor: (list) => `un texto con forma de marcador en una línea de tarea no da ningún marcador: ${list} — las herramientas no leen nada ahí (no se ejecuta ninguna comprobación, no se rastrea ningún archivo). Escríbelo como _Verify: <comando>_ / _Implements: <ruta>_ / _Depends: 3_ (en cursiva, con el valor dentro).`,
    },
    outsideCode: {
      doctor: (list) => `pruebas planificadas fuera del código de pruebas apuntan a un artefacto que aún es una plantilla: ${list} — rellénalo (la ejecución de carga real, el conjunto de evaluación propio de la función) antes de darlas por verificadas.`,
    },

    verifyPipe: {
      brief: (cmds) => `⚠ ${cmds.map((c) => "`" + c + "`").join(", ")} ${cmds.length > 1 ? "redirigen" : "redirige"} su salida a otro comando (pipe): el exit code de un pipeline es el de su ÚLTIMO comando, así que una comprobación que falla puede salir con 0 y pasar por verificada. Quita el pipe, o ejecútalo en bash tras \`set -o pipefail\` (cmd.exe no tiene pipefail) — el exit code que informes debe ser el de la propia comprobación.`,
      runHint: (cmd) => `⚠ \`${cmd}\` redirige su salida a otro comando (pipe): la shell solo informa del exit code del ÚLTIMO comando, así que una comprobación que falla puede registrarse como correcta — quita el pipe, o empieza con \`set -o pipefail;\` en bash (--shell bash); cmd.exe no tiene pipefail.`,
      doctor: (list) => `un comando _Verify:_ redirige su salida a otro (pipe) — una comprobación que falla puede salir con 0 (un pipeline informa del código de su ÚLTIMO comando): ${list}. Quita el pipe o usa \`set -o pipefail\` (bash).`,
      completeNote: (n, cmd) => `Tarea ${n}: el comando registrado redirige su salida a otro (\`${cmd}\`) — su exit 0 es el del ÚLTIMO comando, así que este resultado puede ocultar una comprobación que falla. Quita el pipe (o usa \`set -o pipefail\` en bash) y vuelve a ejecutarlo.`,
    },

    templates: {
      noSummary: "[por definir]",
      badAction: (a) => `Acción de plantillas desconocida '${a}' — una de: list, init, check.`,
      unknownArtifact: (a, list) => `Plantilla desconocida '${a}' — una de: ${list}, o steering/<archivo>.md.`,
      writeFailed: (rel, why) => `No se pudo escribir ${rel} (${why}).`,
      writeOutside: (rel) => `Me niego a escribir ${rel}: su carpeta es un enlace a un lugar fuera del proyecto.`,
      legacyFeature: ".specs/templates/ es la carpeta de una función creada antes de que existieran las plantillas del proyecto (tiene un .state.json) — sigue siendo esa función y nunca se lee como plantillas. Cámbiale el nombre (" + DEV_SPEC + " feature rename templates <nuevo-nombre>, o spec_feature rename) para usar plantillas del proyecto.",
      builtIn: "de serie",
      override: "del proyecto",
      listHead: (lang, n) => `Plantillas para funciones en '${lang}' — ${n} plantilla(s) del proyecto en .specs/templates/ (un archivo en <lang>/ prevalece sobre uno compartido):`,
      ignored: (list) => `Ignorados — no son plantillas que dev-spec conozca: ${list}`,
      initDone: (n) => `${n} plantilla(s) de serie copiada(s) en .specs/templates/ — edítalas; los nuevos scaffolds las usan a partir de ahora:`,
      initKept: (list) => `Conservadas (ya existían — nunca se sobrescriben): ${list}`,
      initNothing: "Nada copiado — todas las plantillas pedidas ya están en .specs/templates/.",
      checkNone: "No hay plantillas del proyecto que comprobar — .specs/templates/ no tiene ninguna (`" + DEV_SPEC + " templates init` copia las de serie).",
      checkHead: (n, errors, warnings) => `${n} archivo(s) de plantilla comprobado(s) — ${errors} error(es), ${warnings} aviso(s).`,
      appends: (file, list) => `${file}: el motor añade por sí mismo las secciones ${list} (la plantilla no tiene sus encabezados).`,
      problems: {
        empty: "vacío — ignorado; se usa la plantilla de serie.",
        "unknown-file": "no es una plantilla que dev-spec conozca (ver spec_templates list) — ignorado.",
        "unknown-variable": (v) => `{{${v}}} no es una variable de plantilla — se deja tal cual (conocidas: {{name}} {{slug}} {{summary}} {{tracks}} {{lang}} {{date}}).`,
        "no-placeholders": "ningún campo [entre corchetes] ni línea > **TODO** — un scaffold sin editar parecería rellenado y su gate podría aprobarse sin cambios.",
        "missing-section": (marker, section) => `falta ${marker} ${section} — la plantilla tiene otros encabezados ${marker}, así que el motor no añade ninguna sección de ese track y doctor falla en esta.`,
        "no-sentinel": (marker, section) => `${marker} ${section} no tiene línea > **TODO** — en una función nueva la sección parecería rellenada (la plantilla de serie siembra una).`,
        "constitution-missing": "sin sección Verificación de la Constitución (Constitution Check) — doctor avisa en todas las funciones creadas con ella.",
        "tradeoffs-missing": "sin sección Alternativas y Compensaciones — doctor avisa (design-tradeoffs) en todas las funciones creadas con ella.",
        "risks-missing": "sin sección Riesgos — doctor avisa (design-risks) en todas las funciones creadas con ella.",
        "reuse-missing": "sin sección Reutilización e Integración — doctor avisa (design-reuse) en todas las funciones creadas con ella.",
        "no-criteria": "ningún criterio de aceptación (una línea US-n.AC-m con DEBE) — nada que seguir para EARS, trace_check o el plan de pruebas.",
        "ac-duplicate": (ids) => `IDs de AC duplicados: ${ids} — doctor falla en todas las funciones creadas con ella.`,
        "phantom-ac": (ids, file) => `cita IDs de AC que ${file} no define: ${ids} — trace_check los reporta como fantasmas.`,
        "builtin-phantom": (file, ids) => `el ${file} de serie (no sustituido) cita IDs de AC que esta plantilla no define: ${ids} — sustituye también ${file}, o conserva esos IDs.`,
        "phantom-test": (ids, file) => `pone en verde IDs de prueba que ${file} no define: ${ids} — trace_check los reporta como pruebas desconocidas en todas las funciones +tdd.`,
        "builtin-phantom-test": (file, ids) => `el ${file} de serie de una función +tdd (no sustituido) pone en verde IDs de prueba que esta plantilla no define: ${ids} — sustituye también ${file}, o conserva esos IDs.`,
        "root-cause-missing": "sin sección Causa Raíz — el gate del bugfix (root-cause de doctor) fallaría en todos los bugfixes hasta añadirla.",
        "root-cause-filled": "la Causa Raíz ya parece escrita (texto, sin campo, sin línea > **TODO**) — un bugfix nuevo pasaría el gate de la causa raíz antes de conocer la causa.",
        "repro-missing": "sin sección Reproducción — doctor avisa en todos los bugfixes.",
        "repro-filled": "la Reproducción ya parece escrita — un bugfix nuevo no pediría los pasos.",
        "no-tasks": "ninguna línea de tarea (- [ ] 1. …) — un scaffold con ella no tiene nada que ejecutar.",
        "no-active-tracks": "sin encabezado 'Tracks activos' — spec_add_track no puede registrar un cambio de track en classification.md.",
        "filematch-no-pattern": "el front matter dice inclusion: fileMatch pero no indica ningún fileMatchPattern — el archivo solo se lista a petición.",
      },
    },

    trackPacks: {
      acHeading: "Criterios de Aceptación (EARS)",
      taskHeading: (marker, title) => `Historia US-1 — ${marker} ${title}`,
      todoLine: "> **TODO** — reemplazar con valores reales (eliminar esta línea cuando esté hecho).",
      defaultCriterion: (title) => `EL SISTEMA DEBE [el comportamiento de ${title} que esta función garantiza]`,
      defaultTask: (marker, title) => `[US1] Cumplir los criterios ${marker} ${title} — rellenar sus secciones de diseño, implementarlos y verificarlos`,
      rowLayer: "integración",
      rowDesc: "[comportamiento]",
      checklistItem: (n) => `${n} sección(es) obligatoria(s) de diseño rellenada(s) (sin TODO) — cada criterio verificado.`,
      steeringStub: (title, name) => `# ${title}\n\n<!-- Las normas de ${title} del equipo: todas las funciones +${name} las siguen (spec_task_brief cita este archivo). -->\n- [fill me in]\n`,
      allFilled: (marker) => `todas las secciones ${marker} rellenadas`,
      statusSections: (marker, list) => `Secciones ${marker}: ${list}`,
      missing: (list) => `track pack(s) no disponible(s): ${list} — el track queda inactivo en esta función hasta que vuelva el pack (${DEV_SPEC} tracks check).`,
      missingAbsent: (name) => `+${name} (no hay .specs/tracks/${name}/ en este proyecto)`,
      missingInvalid: (name, codes) => `+${name} (el pack no es válido: ${codes})`,
      missingReserved: (name, slug, builtIn, since) => `+${name} (un track pack anterior a la ${since || "1.17"} — '${name}' es ahora un nombre reservado${builtIn ? `, y el track +${name} de serie NO se aplica a esta función` : ""}: cambia el nombre de .specs/tracks/${name}/ (y el de su marcador, si también está reservado) y después ${DEV_SPEC} add-track ${slug} <nuevo-nombre> y ${DEV_SPEC} add-track ${slug} ${name} --remove${builtIn ? `; para usar el track de serie en su lugar: ${DEV_SPEC} add-track ${slug} ${name}` : ""})`,
      missingReservedMarker: (name, marker, track, slug, since) => `+${name} (un track pack anterior a la ${since || "1.19"} — su marcador ${marker} es ahora el del track +${track} de serie, así que el pack se ignora y sus secciones ${marker} no cuentan como las de +${track}: cambia el marcador en .specs/tracks/${name}/track.json y en los títulos ${marker} de esta función; para usar el track de serie en su lugar: ${DEV_SPEC} add-track ${slug} ${track} (se añaden sus secciones y el pack sale de esta función); para quitar el pack: ${DEV_SPEC} add-track ${slug} ${name} --remove)`,
      badAction: (a) => `Acción de tracks desconocida '${a}' — una de: list, init, check, signals.`,
      nameRequired: "tracks init necesita un nombre — " + DEV_SPEC + " tracks init <nombre> (spec_tracks {action: \"init\", name}).",
      unknownPack: (n, list) => `No hay track ni track pack '${n}' — los packs del proyecto: ${list}.`,
      legacyFeature: ".specs/tracks/ es la carpeta de una función creada antes de que existieran los track packs (tiene un .state.json) — sigue siendo esa función y nunca se lee como packs. Cámbiale el nombre (" + DEV_SPEC + " feature rename tracks <nuevo-nombre>, o spec_feature rename) para usar track packs.",
      writeFailed: (rel, why) => `No se pudo escribir ${rel} (${why}).`,
      writeOutside: (rel) => `Rechazado escribir ${rel}: su carpeta es un enlace a un lugar fuera del proyecto.`,
      builtIn: "de serie",
      sectionCount: (n) => `${n} sección(es)`,
      signalCount: (n) => `${n} señal(es)`,
      invalid: (n) => `no válido (${n} error(es)) — ignorado; ver ${DEV_SPEC} tracks check`,
      noPacks: "No hay track packs en .specs/tracks/ — `" + DEV_SPEC + " tracks init <nombre>` crea uno.",
      listHead: (builtIn, packs, valid) => `Tracks — ${builtIn} de serie, ${packs} pack(s) del proyecto en .specs/tracks/ (${valid} válido(s)):`,
      checkNone: "No hay track packs que comprobar — .specs/tracks/ no tiene ninguno (`" + DEV_SPEC + " tracks init <nombre>` crea uno).",
      checkHead: (n, valid, errors, warnings) => `${n} track pack(s) comprobado(s) — ${valid} válido(s), ${errors} error(es), ${warnings} aviso(s).`,
      initDone: (name, n) => `Track pack +${name} creado (${n} archivo(s)) — edítalos; desde ahora es un track válido:`,
      initKept: (list) => `Conservados (ya existían — nunca se sobrescriben): ${list}`,
      initNothing: (name) => `Nada escrito — todos los archivos del pack +${name} ya existen.`,
      initNext: (name) => `Siguiente: ${DEV_SPEC} tracks check · ${DEV_SPEC} add-track <función> ${name} (spec_add_track), o indícalo al crear una función.`,
      initJson: (a) => `// Track pack +${a.name} — un track definido por el proyecto (dev-spec 1.15). Solo datos: nada de esta carpeta se ejecuta.
// Guía: references/project-tracks.md · valídalo: dev-spec tracks check (spec_tracks {action: "check"}).
{
  // = el nombre de esta carpeta: ^[a-z][a-z0-9]{1,19}$, nunca un track de serie (core tdd saas ai sec privacy dist api ui obs data).
  "name": "${a.name}",
  // El marcador estable (distingue mayúsculas) de sus secciones de diseño, criterios y bloque de tareas: [${a.token}].
  "marker": "${a.token}",
  // Aparece en los encabezados ("#### [${a.token}] ${a.title} — Criterios de Aceptación (EARS)"); en es obligatorio, pt / pt-BR opcionales.
  "title": { "en": "${a.title}", "es": "${a.title}" },
  // Palabras clave del clasificador, comparadas como palabras enteras (con flexiones): una "strong" activa el track, dos "weak" también,
  // una "context" solo corrobora otra. Una palabra clave en MAYÚSCULAS es una sigla, comparada distinguiendo mayúsculas.
  "signals": { "strong": [], "weak": [], "context": [] },
  // Las secciones obligatorias de diseño: design.md recibe "## [${a.token}] <nombre>" + una línea > **TODO** por cada una; doctor
  // (${a.name}-sections) y la aprobación del diseño fallan hasta que todas estén rellenadas. syn: otros encabezados que cuentan (cualquier idioma).
  "sections": [
    { "name": { "en": "Standards", "es": "Normas" }, "syn": [], "guidance": { "en": "The ${a.title} standards this feature meets, and how each one is verified.", "es": "Las normas de ${a.title} que cumple esta función, y cómo se verifica cada una." } },
    { "name": { "en": "Verification", "es": "Verificación" }, "syn": [], "guidance": { "en": "Who checks it, with which tools, before the merge.", "es": "Quién la verifica, con qué herramientas, antes del merge." } }
  ],
  // Opcional: el archivo de steering que trae el track (.specs/steering/<archivo>, escrito desde steering.md cuando una función añade el track).
  "steering": "${a.name}.md"
}
`,
      initRequirements: (a) => `<!-- Track pack +${a.name}: los criterios de aceptación con que empieza cada función +${a.name} — un elemento de la lista = un criterio, en EARS.
     El motor los numera tras los criterios US-1 de la función (US-1.AC-n), bajo "#### [${a.token}] ${a.title} — Criterios de Aceptación (EARS)".
     Los huecos [entre corchetes] siguen siendo placeholders de la plantilla hasta que la función los rellene. -->
- CUANDO [disparador] EL SISTEMA DEBE [el comportamiento de ${a.title}]
- EL SISTEMA DEBE [una propiedad de ${a.title} que se cumple siempre]
`,
      initTasks: (a) => `<!-- Un elemento de la lista = una tarea del bloque "Historia US-1 — [${a.token}] ${a.title}" de la función (numerada tras su última tarea).
     {{ac1}}, {{ac2}}… = los criterios de este pack tal como la función los numera, {{acs}} = todos; {{t1}}… / {{tests}} = sus pruebas
     planificadas (+tdd — una línea que no nombre ninguna se omite). Una tarea sin _Requirements:_ recibe {{acs}}. -->
- [ ] [las decisiones de diseño de ${a.title} de esta función]
  - _Requirements: {{acs}}_
- [ ] [implementar y verificar los criterios de ${a.title}]
  - _Requirements: {{acs}}_
  - _Makes green: {{tests}}_
`,
      initTestPlan: (a) => `<!-- Una fila = una prueba planificada (funciones +tdd) — las seis celdas del plan de serie; la celda Test ID se renumera tras las del plan. -->
| Test ID | Capa | Tipo | Descripción | Cubre (IDs de AC) | Archivo |
|---------|------|------|-------------|-------------------|---------|
| T-00 | integración | example | [el comportamiento de ${a.title}, de extremo a extremo] | {{ac1}} | \`tests/integration/...\` |
| T-00 | unit | property | [la propiedad de ${a.title} siempre verdadera] | {{ac2}} | \`tests/unit/...\` |
`,
      initChecklist: (a) => `<!-- Un elemento de la lista = una línea del checklist.md de la función ("- [ ] ${a.token}: …"). -->
- todas las secciones de diseño [${a.token}] rellenadas (sin TODO) y revisadas.
- [la comprobación de ${a.title} que el equipo hace antes del merge]
`,
      initSteering: (a) => `# ${a.title}

<!-- Las normas de ${a.title} del equipo — todas las funciones +${a.name} las siguen (spec_task_brief cita este archivo). -->
- [fill me in]
`,
      problems: {
        "linked-folder": "un enlace (symlink / junction) o una carpeta fuera de .specs/ — ignorado: un pack solo se lee de su propia carpeta.",
        "unknown-file": "no es un archivo de pack (track.json, requirements.md, tasks.md, test-plan.md, checklist.md, steering.md, <idioma>/) — ignorado.",
        "too-many-packs": (a) => `más de ${a.max} track packs — este se ignora.`,
        "name-invalid": (a) => `'${a.name}' no es un nombre de track (^[a-z][a-z0-9]{1,19}$ — letras minúsculas y dígitos) — el pack se ignora.`,
        "name-reserved": (a) => `'${a.name}' está reservado (un track de serie, una palabra para uno, o una palabra que usa dev-spec) — el pack se ignora.`,
        "name-mismatch": (a) => `"name": "${a.name}" no es el nombre de la carpeta '${a.folder}' — el pack se ignora.`,
        "json-missing": "no hay track.json — el pack se ignora.",
        "json-invalid": (a) => `track.json no es JSON válido (${a.detail}) — el pack se ignora.`,
        "too-big": (a) => `${a.file} supera los ${a.max} bytes — el pack se ignora.`,
        "fragment-linked": (a) => `${a.file} no es un archivo normal dentro de .specs/ (es un enlace o una carpeta) — el pack se ignora.`,
        "field-missing": (a) => `falta "${a.field}" (${a.rule}) — el pack se ignora.`,
        "field-invalid": (a) => `"${a.field}" no es válido (${a.rule}) — el pack se ignora.`,
        "marker-invalid": (a) => `el marcador '${a.marker}' no es ^[A-Z][A-Z0-9]{1,11}$ — el pack se ignora.`,
        "marker-reserved": (a) => `el marcador [${a.marker}] es de dev-spec (un marcador de serie, una etiqueta de historia / paralela o un hueco genérico) — el pack se ignora.`,
        "marker-duplicate": (a) => `el marcador ${a.marker} ya es del pack +${a.other} — los marcadores son únicos; este pack se ignora.`,
        "signal-invalid": (a) => `signals.${a.tier}: '${a.keyword}' no es una palabra clave (letras y dígitos con espacios, - ' . intermedios — de 2 a 60 caracteres; siempre se compara como palabra literal, nunca como patrón) — el pack se ignora.`,
        "too-many": (a) => `${a.field}: más de ${a.max} — el pack se ignora.`,
        "section-duplicate": (a) => `la sección '${a.name}' tiene el nombre repetido — el pack se ignora.`,
        "steering-invalid": (a) => `el steering '${a.file}' no es un nombre de archivo de steering (minúsculas, dígitos y -, terminado en .md; no un nombre de dispositivo) — el pack se ignora.`,
        "steering-shared": (a) => `el steering ${a.file} también es un archivo de steering de serie — se conserva el que se escriba primero.`,
        "unknown-key": (a) => `clave desconocida "${a.key}" — ignorada.`,
        "unknown-variable": (a) => `{{${a.v}}} no es una variable de pack — se deja tal cual (conocidas: {{ac1}}… {{acs}} {{t1}}… {{tests}} {{title}} {{marker}} {{name}} {{slug}}).`,
        "fragment-empty": (a) => `${a.file} no contiene nada que el motor lea — se usa el valor de serie.`,
        "fragment-row": (a) => `una fila de ${a.file} sin las seis celdas del plan (Test ID | Capa | Tipo | Descripción | Cubre | Archivo) — el pack se ignora.`,
        "fragment-ref": (a) => a.kind === "t" && a.file !== "tasks.md" ? `${a.ref} no se puede usar en ${a.file} — solo tasks.md nombra las pruebas planificadas — el pack se ignora.`
          : `${a.ref} no nombra nada ${a.ctx ? "en las funciones " + a.ctx : "en la raíz del pack"}: ${a.from || "el valor de serie"} da ${a.n} ${a.kind === "ac" ? "criterio(s)" : "prueba(s) planificada(s)"} — el pack se ignora.`,
        "section-name-lead": (a) => `el nombre de sección '${a.name}' empieza con numeración, un emoji o un guion — se ignora al comparar encabezados: cuenta como '${a.key}'.`,
        "section-core-name": (a) => `la sección '${a.name}' tiene el nombre de un encabezado del diseño base ('${a.heading}') — solo cuenta un encabezado con el marcador del pack (o bajo uno); la sección base nunca cuenta.`,
      },
    },

    stakeholderExport: {
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_export (dev-spec export).",
      kicker: { feature: "Especificación de la función", bugfix: "Especificación del bugfix", change: "Especificación del cambio", project: "Especificación del proyecto" },
      projectTitle: (proj) => `${proj} — visión general de la especificación`,
      generated: (date) => `generado el ${date} a partir de las specs del proyecto (.specs/)`,
      meta: { id: "Función", kind: "Tipo", tracks: "Tracks", phase: "Fase", progress: "Progreso", status: "Estado", lang: "Idioma", overall: "Progreso global" },
      kind: { feature: "función", bugfix: "bugfix", change: "cambio (tamaño xs)" },
      progress: (done, total, pct) => `${done}/${total} tareas hechas · ${pct}%`,
      overall: (pct, complete, total, done, tasks) => `${pct}% · ${complete}/${total} funciones completas · ${done}/${tasks} tareas hechas`,
      sections: {
        contents: "Índice", summary: "Resumen", stories: "Historias de usuario y criterios de aceptación", successCriteria: "Criterios de éxito", bug: "Informe del bug",
        design: "Diseño", testPlan: "Plan de pruebas", tasks: "Tareas", decisions: "Decisiones", approvals: "Aprobaciones", clarifications: "Aclaraciones pendientes",
        roadmap: "Hoja de ruta", backlog: "Backlog", catalog: "Catálogo vivo",
      },
      cols: { task: ["#", "Tarea", "Estado", "Verificación"], approval: ["Fase", "Aprobado por", "Cuándo", "Notas"], roadmap: ["Función", "Tracks", "Fase", "Progreso", "Tareas", "Depende de"] },
      taskStatus: { done: "✅ hecha", open: "☐ pendiente" },
      verification: { verified: "verificada", nothing: "nada que verificar", open: "—", unverified: (why) => "⚠ sin verificar" + (why ? ` (${why})` : "") },
      phases: { classification: "Clasificación", requirements: "Requisitos", design: "Diseño", "test-plan": "Plan de pruebas", "eval-plan": "Plan de evals", tests: "Pruebas (Fase 4)", tasks: "Tareas", execution: "Aprobación de la ejecución" },
      forced: (ids) => `aprobado con --force (fallando: ${ids})`,
      changedSince: "modificado desde esta aprobación — por revisar de nuevo",
      planPhase: "Plan (change.md)",
      criteria: "Criterios de aceptación",
      pending: "pendiente de aprobación",
      template: "plantilla — aún sin escribir",
      supersededBy: (list) => `sustituido por ${list}`,
      toBeSupersededBy: (list) => `se sustituirá por ${list} (aún no entregada)`,
      supersedes: (list) => `sustituye ${list}`,
      blocked: (list) => `bloqueada por ${list}`,
      none: "Nada.",
      noSummary: "Aún sin resumen.",
      noStories: "Aún sin historias de usuario ni criterios de aceptación.",
      noDesign: "Aún sin diseño.",
      noTasks: "Aún sin tareas.",
      noApprovals: "Aún ninguna fase aprobada.",
      noClarifications: "Ninguna — no hay marcadores [NEEDS CLARIFICATION] pendientes.",
      noFeatures: "Aún sin funciones.",
      theme: "Tema",
      print: "Imprimir",
      wrote: (file) => `✎ generado ${file}`,
      exportsIsFeature: (dir) => `${dir} es una carpeta de función anterior a que dev-spec reservara el nombre 'exports' (contiene requirements.md / .state.json) — mueve o renombra esa carpeta a mano y vuelve a exportar.`,
    },
    rtm: {
      title: "Matriz de trazabilidad",
      projectTitle: "Trazabilidad",
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: dev-spec export --csv (spec_export format csv).",
      cols: {
        feature: "Función", id: "ID", kind: "Tipo", requirement: "Requisito", status: "Estado", gaps: "Lagunas", template: "Plantilla", design: "Secciones del diseño",
        tasks: "Tareas", tests: "Pruebas", testFiles: "Ficheros de prueba", evidence: "Última evidencia", decisions: "Decisiones", supersedes: "Sustituye",
        supersededBy: "Sustituido por", approvedAt: "Requisitos aprobados", approvedBy: "Aprobado por", changed: "Modificado desde la aprobación",
      },
      projectCols: ["Función", "Requisitos", "Verificados", "Implementados", "Planeados", "Sin trazar"],
      status: { verified: "verificado", implemented: "implementado", planned: "planeado", untraced: "sin trazar" },
      gap: {
        "no-task": "ninguna tarea lo cita", "no-test": "ninguna fila del plan de pruebas lo cubre", "no-coverage": "ninguna tarea ni prueba planeada lo cubre",
        "no-coverage-sc": "ninguna fila del plan de pruebas ni línea del quickstart lo cubre",
      },
      yes: "sí", no: "no", unknown: "desconocido",
      forced: "forzada",
      task: {
        verified: (n) => `#${n} verificada`, nothing: (n) => `#${n} hecha (nada que verificar)`, open: (n) => `#${n} pendiente`,
        unverified: (n, why) => `#${n} hecha, sin verificar${why ? ` (${why})` : ""}`,
      },
      evidence: (n, cmd, code, at, commit, expectedFail) => `#${n}: ${cmd} → salida ${code}${expectedFail ? " (ejecución en rojo, fallo esperado)" : ""}${commit ? ` @${commit}` : ""}${at ? ` · ${at}` : ""}`,
      evidenceNote: (n, note, at) => `#${n}: nota — ${note}${at ? ` · ${at}` : ""}`,
      notInCode: "en ningún fichero de prueba",
      outsideCode: "se ejecuta fuera del código de prueba",
      template: "plantilla — aún sin escribir",
      supersededBy: (list) => `sustituido por ${list}`,
      toBeSupersededBy: (list) => `se sustituirá por ${list} (aún no entregada)`,
      changedSince: "modificado desde la aprobación de los requisitos",
      legend: "Una fila por ID de requisito. Tareas: ✅ verificada · ⚠ hecha, sin verificar · ☐ pendiente. Estado: verificado — todas las tareas vinculadas hechas y verificadas; implementado — hechas, no todas verificadas; planeado — trazado, con trabajo pendiente; sin trazar — una laguna de trazabilidad (indicada).",
      projectLegend: "IDs de requisito (AC / EC / NFR / SC) por función, según su estado de trazabilidad — la exportación de cada función incluye su matriz.",
      approvedLine: (at, by, forced) => `Requisitos aprobados el ${at} por ${by}${forced ? " (con --force)" : ""}.`,
      notApproved: "Requisitos aún sin aprobar.",
      planApprovedLine: (at, by, forced) => `Plan (change.md) aprobado el ${at} por ${by}${forced ? " (con --force)" : ""}.`,
      planNotApproved: "Plan (change.md) aún sin aprobar.",
      changedSincePlan: "modificado desde la aprobación del plan",
      none: "Aún sin IDs de requisito.",
      cli: {
        head: (feature, tracks, c) => `Matriz de trazabilidad — ${feature} (${tracks}): ${c.rows} requisito(s) · ${c.verified} verificado(s) · ${c.implemented} implementado(s) · ${c.planned} planeado(s) · ${c.untraced} sin trazar`,
        legend: "tareas: ✓ verificada · ▲ hecha, sin verificar · ○ pendiente",
        codeLegend: "pruebas: ✓ nombrada en un fichero de prueba · ✗ en ningún fichero de prueba · ○ se ejecuta fuera del código de prueba",
        approved: (at, by, forced) => `requisitos aprobados el ${at} por ${by}${forced ? " (forzada)" : ""}`,
        notApproved: "requisitos aún sin aprobar",
        planApproved: (at, by, forced) => `plan (change.md) aprobado el ${at} por ${by}${forced ? " (forzada)" : ""}`,
        planNotApproved: "plan (change.md) aún sin aprobar",
        notes: { template: "plantilla", superseded: (list) => `sustituido por ${list}`, changed: "modificado desde la aprobación" },
      },
    },
    releaseNotes: {
      title: (proj) => `Notas de la versión — ${proj}`,
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_changelog {write: true} (dev-spec changelog --write).",
      sinceDate: (d) => `Cambios desde ${d}`,
      sinceLast: (d) => `Cambios desde las últimas notas de la versión (${d})`,
      all: "Todos los cambios registrados en las specs",
      generated: (d) => `generadas el ${d}`,
      added: "Añadido",
      changed: "Cambiado",
      fixed: "Corregido",
      none: "Nada.",
      rootCause: (t) => `Causa raíz: ${t}`,
      noRootCause: "causa raíz sin escribir en bug.md",
      changeRequest: (n, phase, d) => `solicitud de cambio #${n} (${phase}, ${d})`,
      crParts: { added: (l) => `añadido: ${l}`, modified: (l) => `modificado: ${l}`, removed: (l) => `eliminado: ${l}`, reopened: (l) => `tareas reabiertas: ${l}` },
      wrote: (file, a, c, f) => `✎ generado ${file} — ${a} añadido(s) · ${c} cambiado(s) · ${f} corregido(s)`,
      nothingToWrite: (file) => `Nada que informar desde entonces — ${file} no se ha escrito y meta.changelogAt no cambia.`,
      badSince: (v) => `since: '${v}' no es una fecha ISO (AAAA-MM-DD, o una marca de tiempo ISO completa), 'last' ni 'all'.`,
      noLast: "Aún no se han escrito notas de la versión (roadmap.json meta.changelogAt no está definido) — se listan todos los cambios.",
    },
    gherkin: {
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_export {format: \"gherkin\"} (dev-spec export <feature> --gherkin).",
      source: (rel) => `Origen: ${rel} — un escenario por criterio de aceptación vigente; EARS → Dado (MIENTRAS / DONDE / SI) · Cuando (CUANDO) · Entonces (la cláusula DEBE).`,
      summaryLabel: "Resumen",
      template: (id) => `${id} — plantilla, aún sin escribir: omitido`,
      superseded: (id, by) => `${id} — reemplazado por ${by} (entregada): omitido`,
      unsplit: "cláusulas EARS sin separación limpia — el criterio entero es un único paso Entonces",
      noScenarios: "Aún sin criterios de aceptación vigentes.",
      spike: (slug) => `'${slug}' es un spike — no tiene criterios de aceptación que exportar en Gherkin (spec_export {name: "${slug}"} sin el formato gherkin exporta su documento).`,
      wroteMany: (n, scenarios) => `✎ generados ${n} archivo(s) .feature — ${scenarios} escenario(s)`,
      noFeatures: "Ninguna función activa con criterios de aceptación que exportar.",
    },
    trackerCsv: {
      autogen: "AUTO-GENERADO por dev-spec — no editar a mano; deja esta columna sin asignar. Para regenerar: spec_export {format: \"jira\" | \"linear\"} (dev-spec export --tracker jira|linear).",
      featureLine: (rel, tracks, phase, done, total) => `función dev-spec ${rel} · tracks ${tracks} · fase: ${phase} · ${done}/${total} tareas hechas`,
      acceptance: "Criterios de aceptación:",
      taskLine: (rel, n) => `tarea dev-spec #${n} — ${rel}`,
      wrote: (file, n) => `✎ generado ${file} — ${n} elemento(s) de trabajo`,
    },
    milestone: {
      title: "Hitos",
      cols: ["Hito", "Fecha", "Funciones", "Hechas", "ETA", "Estado"],
      status: { "on-track": "a tiempo", "at-risk": "en riesgo", late: "retrasado", done: "completado" },
      archivedLabel: "archivadas",
      line: (name, date, done, total, eta, status, feats, archived) => `${name} — ${date} · ${done}/${total} función(es) hechas · ETA ${eta || "—"} · ${status} · ${feats || "—"}${archived ? ` (archivadas: ${archived})` : ""}`,
      head: (n, today) => `${n} hito(s) — hoy ${today}:`,
      none: "Aún sin hitos — añade uno: " + DEV_SPEC + " milestone add <nombre> <AAAA-MM-DD> <funciones…> (spec_milestone {action: \"add\", name, date, features}).",
      added: (name, date, list) => `Hito '${name}' añadido — ${date}: ${list}`,
      updated: (name, date, list) => `Hito '${name}' actualizado — ${date}: ${list}`,
      removed: (name) => `Hito '${name}' eliminado.`,
      attention: {
        late: (date, done, total, eta) => `hito retrasado — su fecha ${date} ya pasó con ${done}/${total} función(es) hechas${eta ? ` (ETA ${eta})` : ""}`,
        "eta-after-date": (date, eta) => `hito en riesgo — el ETA más tardío de sus funciones (${eta}) es posterior a su fecha ${date}`,
        "eta-unknown": (date, eta, list) => `hito en riesgo — aún sin ETA para ${list} (fecha ${date}): datos de velocidad insuficientes, o aún sin tareas`,
        "no-features": (date) => `hito en riesgo — ya no le queda ninguna función activa (fecha ${date})`,
        invalid: (n, names, rel) => `${n} entrada(s) no válida(s) (${names}) en ${rel} — ignoradas: sin estado, y renombrar / archivar / eliminar / restaurar una función no las actualiza; corrígelas a mano (un nombre válido, un día AAAA-MM-DD real, listas de slugs de funciones, una entrada por nombre).`,
        notList: (rel) => `${rel} → meta.milestones no es una lista — no se lee ningún hito, y renombrar / archivar / eliminar / restaurar una función no lo actualiza; corrígelo a mano.`,
      },
      nameRequired: "Indica el nombre del hito (name).",
      badName: (v) => `nombre de hito no válido '${v}' — letras, dígitos, espacios y . _ : # ( ) + - (hasta 60 caracteres, empezando por una letra o un dígito).`,
      badDate: (v) => `date: '${v}' no es un día en formato AAAA-MM-DD (p. ej. 2026-10-31).`,
      noFeatures: "Indica al menos una función del hito (features).",
      unknownFeatures: (list) => `Cada función del hito debe ser una función activa existente — no encontrada(s): ${list}`,
      tooMany: (max) => `como máximo ${max} hitos — elimina uno primero (${DEV_SPEC} milestone rm <nombre>).`,
      tooManyFeatures: (max) => `como máximo ${max} funciones por hito.`,
      notFound: (name, list) => `No existe el hito '${name}' (hitos: ${list}).`,
      badStored: (rel) => `${rel} → meta.milestones no es una lista de {name, date, features} como los escribe milestone add (un nombre válido, un día AAAA-MM-DD real, una entrada por nombre) — corrígelo a mano; me niego a cambiarlo.`,
      notesTitle: (title, name) => `${title} — ${name}`,
      notesScope: (name, date, list) => `Hito ${name} (${date}): ${list}`,
      notesAutogen: "AUTO-GENERADO por dev-spec — no editar a mano. Para regenerar: spec_changelog {milestone, write: true} (dev-spec changelog --milestone <nombre> --write).",
      nothingToWrite: (file) => `Nada que informar para este hito — ${file} no se ha escrito.`,
    },

    governance: {
      rolesShape: "approvalRoles debe asociar fases a listas de roles, p. ej. {\"requirements\": [\"product\"], \"design\": [\"tech\", \"security\"]} (CLI: --roles requirements=product,design=tech+security; --roles none los elimina)",
      rolesPhase: (phase, known) => `approvalRoles: fase desconocida '${phase}' (conocidas: ${known})`,
      rolesEmpty: (phase) => `approvalRoles.${phase}: indica al menos un rol`,
      badRole: (role) => `nombre de rol no válido '${role}' — usa letras, dígitos, '-', '_' o '.' (40 caracteres como máximo)`,
      rolesSet: (summary) => `Roles de aprobación: ${summary} — cada fase indicada solo cuenta como aprobada cuando todos los roles han validado su contenido actual (spec_approve {role} / --role).`,
      rolesCleared: "Roles de aprobación eliminados — cada fase vuelve a necesitar una sola aprobación.",
      phaseRequired: "Indica la fase que apruebas — o through: <fase> (CLI: --through <fase>) para avanzar rápido hasta ella.",
      roleRequired: (phase, slug, roles) => `'${phase}' se valida por rol (${roles}) — indica el rol con el que validas: /approve ${slug} ${phase} --role <rol> (spec_approve {role}). No se ha registrado nada.`,
      roleNotListed: (role, phase, roles) => `'${role}' no es un rol que valide '${phase}' (roles: ${roles}) — no se ha registrado nada.`,
      missing: (list) => `${list.length > 1 ? "faltan los roles" : "falta el rol"}: ${list.join(", ")}`,
      stepForced: (ids) => ` (forzada: ${ids.join(", ")})`,
      signedOff: (phase, slug, role) => `'${phase}' de ${slug} validada como ${role} ✓`,
      signedForced: (ids) => `Validado con force — las verificaciones que fallan quedan registradas con la validación: ${ids}.`,
      stillPending: (phase, missing) => `'${phase}' sigue pendiente hasta que todos los roles validen su contenido actual — ${missing}.`,
      approvedByRoles: (phase, roles) => `'${phase}' está aprobada — todos los roles validaron el contenido actual: ${roles}.`,
      staleSignOffs: (list) => `las validaciones hechas antes de que cambiara el artefacto ya no cuentan (vuelve a validar el contenido actual): ${list}`,
      resigning: (list) => `nueva validación en curso (la fase sigue aprobada como estaba hasta que todos los roles validen el nuevo contenido): ${list}`,
      unsigned: (list) => `aprobado sin las validaciones por rol que ahora se exigen (aprobado antes de configurar o cambiar los roles — cuenta como aprobado por un rol desconocido; pide a cada rol que vuelva a validar): ${list}`,
      approveRoles: (phase, slug, missing, signed, first) => `Revisa y valida '${phase}' — ${missing}${signed ? ` (ya validaron: ${signed})` : ""}: /approve ${slug} ${phase} --role ${first}.`,
      signedAll: (roles) => `todos los roles validaron: ${roles} — aún no aprobada`,
      signoffsComplete: (list, cmd) => `todos los roles validaron, pero la fase nunca se aprobó (las validaciones se registraron por separado — en dos ramas combinadas, o antes de retirar un rol): ${list} — uno de esos roles vuelve a validar para completarla: ${cmd}`,
      completeSignoffs: (phase, slug, signed, first) => `Todos los roles validaron '${phase}' (${signed}), pero aún no está aprobada — las validaciones se registraron por separado (¿dos ramas combinadas?). Uno de ellos vuelve a validar para completarla: /approve ${slug} ${phase} --role ${first}.`,
      roadmapAwaiting: (list) => `esperando validación por rol: ${list}`,
      resignHint: (list, cmd) => `Cada rol vuelve a validar el nuevo contenido — ${list}: ${cmd}.`,
      ffBoth: "Pasa una fase o through (el avance rápido), no ambas.",
      ffExecution: "El avance rápido cubre solo las fases de planificación (como mucho hasta 'tasks') — valida 'execution' aparte, después de /spec-finish.",
      ffNotActive: (phase, slug) => `'${phase}' no es una fase aprobable de '${slug}' ahora mismo (su track está desactivado, o el plan que valida aún no existe) — no se ha aprobado nada.`,
      ffNothing: (slug, through) => `Nada que avanzar: todas las fases activas de '${slug}' hasta '${through}' ya están aprobadas.`,
      ffDone: (slug, list, through) => `Avance rápido de '${slug}': aprobadas ${list}, en orden, cada una por su propio gate — todas las fases hasta '${through}' están aprobadas.`,
      ffStopped: (slug, phase, list, why) => `El avance rápido de '${slug}' se detuvo en '${phase}'${list ? ` (aprobadas antes: ${list})` : " (nada aprobado)"} — ${why}`,
      ffWhyRefused: (ids, lines, slug, phase) => `su gate la rechaza — verificaciones que fallan: ${ids}.\n${lines}\nCorrígelas (detalles: /spec-doctor ${slug}) y vuelve a ejecutar el avance rápido (se reanuda en '${phase}').`,
      ffWhyRoles: (missing) => `validada, pero espera a los demás roles (${missing}) — las fases siguientes no pueden aprobarse antes que ella.`,
      ffWhyRole: (roles, slug, phase, through, given) => (given ? `'${given}' no es un rol que valide '${phase}' (roles: ${roles})` : `'${phase}' se valida por rol (${roles})`) +
        ` — no se ha registrado nada para '${phase}'. Vuelve a ejecutar el avance rápido con el rol con el que validas: /spec-ff ${slug} --role <rol> (CLI: ${DEV_SPEC} approve ${slug} --through ${through} --role <rol>); se reanuda en '${phase}'.`,
      ffHint: (slug, list, role) => `Todos los artefactos de planificación hasta las tareas están rellenados y pasan su gate — avance rápido: /spec-ff ${slug}${role ? " --role " + role : ""} (CLI: ${DEV_SPEC} approve ${slug} --through tasks${role ? " --role " + role : ""}) aprueba ${list} en orden, cada una por su propio gate.`,
      ffHintTests: (slug, list, through, role) => `Todos los artefactos de planificación hasta ${through} están rellenados y pasan su gate — avance rápido: /spec-ff ${slug} ${through}${role ? " --role " + role : ""} (CLI: ${DEV_SPEC} approve ${slug} --through ${through}${role ? " --role " + role : ""}) aprueba ${list} en orden, cada una por su propio gate. Después la Fase 4: escribe las pruebas que fallan / los conjuntos de evaluación (/writeTests ${slug}), aprueba las pruebas y luego las tareas.`,
      batch: (n) => `  aprobaciones en lote (avance rápido): ${n}`,
    },

    undo: {
      unticked: (n, slug, runnable, stale) => `La tarea ${n} vuelve a estar abierta (desmarcada).` +
        (stale ? ` Su evidencia registrada deja de contar — volver a marcarla exige ${runnable ? `una nueva ejecución de su comando _Verify:_: ${DEV_SPEC} done ${slug} ${n} --run` : "nueva evidencia"}.` : ""),
      alreadyOpen: (n) => `La tarea ${n} no está marcada — nada que deshacer.`,
      redKept: (n, slug, day) => `Su ejecución en rojo del ${day} (la prueba de _Expect: fail_) se mantiene: volver a marcarla exige una nueva ejecución de su comando _Verify:_ — con el arreglo hecho, una ejecución correcta cuenta como el arreglo que pone la prueba en verde: ${DEV_SPEC} done ${slug} ${n} --run.`,
      duplicateTicked: (n, list) => `Varias tareas marcadas comparten el número ${n} (${list}) — undo no puede saber cuál de las marcas fue el error. Renuméralas primero para que cada número sea único (doctor: duplicate-tasks) y después deshaz la que se marcó por error. No se ha cambiado nada.`,
      duplicateItem: (line, text) => `línea ${line}: "${text}"`,
      reopened: (slug) => `'${slug}' ya estaba terminada o aprobada — cuando la tarea vuelva a estar hecha, termínala de nuevo (/spec-finish ${slug}) y vuelve a aprobar la ejecución (/approve ${slug} execution).`,
      noEvidence: "undo no acepta evidencia — solo desmarca la tarea (registra la nueva ejecución cuando la vuelvas a marcar).",
      reasonNeedsUndo: "reason acompaña a undo (spec_complete_task {undo: true, reason} / " + DEV_SPEC + " undone <feature> <n> --reason \"…\") — al marcar una tarea se registra evidencia.",
      badReason: (max) => `reason debe ser texto (una línea, como máximo ${max} caracteres).`,
      staleNote: (n, slug, runnable) => `Tarea ${n}: se desmarcó después de registrar esta evidencia — sigue sin verificar hasta que se registre ` +
        (runnable ? `una nueva ejecución: ${DEV_SPEC} done ${slug} ${n} --run` : "nueva evidencia."),
      label: "desmarcada después de registrar esta evidencia",
      cliDone: (n, done, total) => `Tarea ${n} desmarcada. ${done}/${total}`,
      cliAlready: (n, done, total) => `La tarea ${n} no estaba marcada. ${done}/${total}`,
      driftWhy: (list) => `desmarcada(s) después: ${list}`,
      signOffWhy: (list) => `la desmarcación de ${list}`,
    },
    revoke: {
      revoked: (phase, slug) => `Aprobación de '${phase}' revocada en ${slug} — la fase vuelve a estar pendiente (doctor, next_action y spec_finish la piden).`,
      withdrawn: (phase, slug, roles) => `Retiradas las aprobaciones por rol en espera para '${phase}' de ${slug}: ${roles} — aún no había nada aprobado.`,
      signOffsToo: (roles) => `También se retiraron las aprobaciones por rol que estaban en espera: ${roles}.`,
      laterStay: (list, phase) => `Nada en cascada: las fases siguientes siguen aprobadas (${list}); aprobar otra fase se rechaza (phase-order) hasta que '${phase}' vuelva a aprobarse.`,
      notApproved: (phase, slug) => `'${phase}' no está aprobada en ${slug} y ninguna aprobación por rol está en espera — nada que revocar.`,
      phaseRequired: "Indica la fase cuya aprobación quieres revocar.",
      noThrough: "revoke acepta una sola fase — no through (el avance rápido).",
      noForce: "revoke no acepta force ni expires — elimina una aprobación; reason dice por qué.",
      driftWhy: (list) => `aprobación revocada: ${list} (apruébala de nuevo antes de volver a cerrarla)`,
      signOffWhy: (list) => `la revocación de ${list}`,
    },
    waiver: {
      badExpires: (v, max) => `expires debe ser una fecha ISO (AAAA-MM-DD, hoy o después, como máximo dentro de ${max} días) o un número de días (30d, 1–${max}) — recibido: ${v}.`,
      needsForce: "reason / expires describen una excepción (waiver) — van con force (reason también con revoke).",
      notForced: "El gate pasó — no se eximió nada: el motivo / la caducidad no se registraron.",
      recorded: (reason, expires) => `Excepción registrada${reason ? `: ${reason}` : ""}${expires ? ` (vence el ${expires})` : ""}.`,
      doctor: (list, slug) => `aprobaciones forzadas cuya excepción caducó: ${list} — corrige las comprobaciones que fallan y vuelve a aprobar sin force (/approve ${slug} <fase>), o renueva la excepción (/approve ${slug} <fase> --force --reason "…" --expires 30d)`,
      expiredItem: (phase, expires, reason) => `${phase} (caducó el ${expires}${reason ? ` — ${reason}` : ""})`,
      roadmapItem: (phase, reason, expires, expired) => `${phase} (${[reason ? `excepción: ${reason}` : "excepción", expires ? (expired ? `CADUCADA el ${expires}` : `hasta el ${expires}`) : null].filter(Boolean).join(", ")})`,
      prHeading: "## Gates eximidos (aprobaciones forzadas)",
      prLine: (phase, failing, reason, expires, expired) => `- ${phase} — forzada pese a: ${failing || "—"} · ${reason ? `motivo: ${reason}` : "sin motivo registrado"}${expires ? ` · ${expired ? "CADUCADA el" : "vence el"} ${expires}` : ""}`,
      finishWarn: (list, slug) => `excepciones caducadas en aprobaciones forzadas: ${list} — vuelve a aprobar esas fases sin force, o renueva la excepción (${DEV_SPEC} approve ${slug} <fase> --force --reason "…" --expires 30d)`,
    },

    forecast: {
      colEta: "Previsión",
      etaCell: (eta, low, high) => `${eta}${low ? ` (${low}…${high})` : ""}`,
      cliEta: (eta, low, high) => `previsión ${eta}${low ? ` (${low}…${high})` : ""}`,
      velocity: (v) => `Velocidad: ${v.pointsPerDay} punto(s)/día laborable — ${v.completed} tarea(s), ${v.points} punto(s) completados desde ${v.since} (últimos ${v.windowDays} días)`,
      notEnough: (v) => `Velocidad: aún no hay datos suficientes — ${v.completed} de las ${v.minTasks} tareas completadas que una previsión necesita en los últimos ${v.windowDays} días`,
      metricsVelocity: (v) => (v.completed ? `  velocidad: ${v.pointsPerDay} punto(s)/día laborable (${v.completed} tarea(s), ${v.points} punto(s) desde ${v.since}, últimos ${v.windowDays} días)${v.enough ? "" : ` — aún no hay datos suficientes para una previsión (se necesitan ${v.minTasks})`}`
        : `  velocidad: ninguna tarea completada en los últimos ${v.windowDays} días`),
      etaNote: (pct) => `Previsión = puntos pendientes ÷ velocidad, en días laborables (±${pct}%) · \`_Size: XS|S|M|L|XL_\` en una tarea = 1/2/3/5/8 puntos; una tarea sin tamaño cuenta como la mediana de su función (si no, M) · una función que espera una dependencia empieza después de la previsión de esa.`,
      overlap: {
        attentionActive: (other, files) => `planifica los mismos ficheros que ${other}: ${files} — ordénalas (spec_depend) o declara _Supersedes:_ si una sustituye el comportamiento de la otra`,
        attentionFinished: (other, files) => `planifica ficheros de la línea base de cierre de ${other}: ${files} — declara _Supersedes: ${other}/US-n.AC-m_ donde sustituye ese comportamiento, o spec_drift señalará ${other} después del merge`,
        doctorActive: (list, slug) => `hay tareas pendientes que planifican los mismos ficheros que otra función activa — ${list}: ambas los tocan en el merge y una deriva sin aviso. Ordena las dos (spec_depend {name: "${slug}", add: ["<otra>"]} · ${DEV_SPEC} depend ${slug} <otra>) o, donde una sustituye el comportamiento de la otra, declara _Supersedes: <otra>/US-n.AC-m_`,
        doctorFinished: (list, slug) => `hay tareas pendientes que planifican ficheros que una función cerrada registró en su línea base de drift — ${list}: después del merge, spec_drift la señala. Declara _Supersedes: <función>/US-n.AC-m_ en los criterios de ${slug} que sustituyen su comportamiento, haz que ${slug} dependa de ella donde se apoya en ella (spec_depend {name: "${slug}", add: ["<función>"]} · ${DEV_SPEC} depend ${slug} --add <función>), o vuelve a cerrarla después del merge (spec_finish)`,
        hookLine: (n, list) => `⚠ ${n} solapamiento(s) de ficheros entre funciones: ${list} — ejecuta /spec-doctor en ellas (ordénalas con /depend, o declara _Supersedes:_)`,
        cliHead: (n) => `⚠ ${n} solapamiento(s) de ficheros entre funciones:`,
        cliActive: (a, b, files) => `  ${a} ↔ ${b}: ${files}`,
        cliFinished: (a, b, files) => `  ${a} → ${b} (cerrada): ${files}`,
        more: (n) => `+${n} más`,
      },
    },

    // 1.14 B5 — rojo → verde (_Expect: fail_), verificaciones del proyecto (roadmap.json meta.checks) + la suite al final, `dev-spec log`.
    redGreen: {
      passRefused: (n) => `La tarea ${n} espera que su prueba FALLE (_Expect: fail_), pero la ejecución pasó (exit 0) — la prueba aún no falla, así que no prueba nada. Hazla fallar por la razón correcta (una aserción, "no implementado" — no una errata ni un import que falta) y registra esa ejecución. No la marco como hecha.`,
      passTicked: (n) => `La tarea ${n} está marcada, pero espera que su prueba FALLE (_Expect: fail_) y esta ejecución pasó (exit 0) sin ninguna ejecución en rojo registrada antes — la prueba no prueba nada: registrado; la tarea cuenta como no verificada hasta que se registre una ejecución que falle (en rojo).`,
      cantRun: (n, code, ticked) => `Tarea ${n}: exit ${code} significa que el propio comando no pudo ejecutarse (no encontrado / no ejecutable) — eso no es una prueba en rojo (_Expect: fail_). Corrige el comando _Verify:_ y registra después la ejecución que falla. ` + (ticked ? "Registrado; la tarea cuenta ahora como no verificada." : "No la marco como hecha."),
      passAfterRed: (n, day) => `Tarea ${n}: su prueba pasa ahora — es lo esperado tras el arreglo; la ejecución en rojo registrada el ${day} sigue siendo la prueba (_Expect: fail_).`,
      unexpectedPassNote: (n, slug) => `La tarea ${n} espera que su prueba FALLE (_Expect: fail_), pero su última ejecución pasó sin ninguna ejecución en rojo antes — sigue sin verificar hasta que se registre una ejecución que falle: ${DEV_SPEC} done ${slug} ${n} --run`,
      redRecorded: (n, code) => `  ✓ ejecución en rojo registrada para la tarea ${n} (exit ${code}) — la prueba falla antes de su arreglo, como espera _Expect: fail_.`,
      shellNotRed: (cmd) => `la shell predeterminada de Windows (cmd.exe) no pudo ejecutar \`${cmd}\` tal como está escrito — eso no es una prueba en rojo (_Expect: fail_). No se registró nada; la tarea sigue abierta.`,
      pwshNotRed: (cmd, what) => `PowerShell no pudo analizar \`${cmd}\` (${what}) — el comando nunca se ejecutó, así que eso no es una prueba en rojo (_Expect: fail_). No se registró nada; la tarea sigue abierta. Windows PowerShell 5.1 no tiene && / || (usa ; o pwsh 7).`,
      cantRunOutput: (n, code, what, ticked) => `Tarea ${n}: la ejecución salió con exit ${code}, pero su salida muestra que la prueba ni llegó a ejecutarse (${what}) — eso no es una prueba en rojo (_Expect: fail_): un fichero de prueba, módulo o script que falta no es la razón correcta. Escribe la prueba para que falle en una aserción (o "no implementado") y registra esa ejecución. ` + (ticked ? "Registrado; la tarea cuenta ahora como no verificada." : "No la marco como hecha."),
      notRed: (cmd, what) => `\`${cmd}\` falló, pero su salida muestra que la prueba ni llegó a ejecutarse (${what}) — eso no es una prueba en rojo (_Expect: fail_): un fichero de prueba, módulo o script que falta no es la razón correcta. No se registró nada; la tarea sigue abierta. Escribe la prueba para que falle en una aserción (o "no implementado"); después, repite el done --run.`,
      prRed: "la ejecución en rojo esperada (_Expect: fail_)",
      prRedKept: (code, day) => `ejecución en rojo antes del arreglo: exit ${code}${day ? " el " + day : ""}`,
      doctorMissing: (list) => `T-IDs puestos en verde por tareas hechas sin una ejecución en rojo registrada: ${list} — una prueba que nunca falló no prueba nada. Marca la tarea que la escribe con _Expect: fail_ y registra su ejecución que falla antes del arreglo (${DEV_SPEC} done <función> <n> --run).`,
      doctorOk: (n) => `todos los T-IDs puestos en verde por tareas hechas (${n}) tienen una ejecución en rojo registrada`,
      briefExpect: "**Resultado esperado: FALLO** (_Expect: fail_) — la ejecución debe terminar con un exit distinto de cero: la prueba falla por la razón correcta antes del arreglo (una aserción / no implementado — no una errata, un import que falta o un comando que no se ejecuta). Una ejecución que pase se rechaza: significaría que la prueba no prueba nada.",
      dodExpect: "La ejecución del _Verify:_ debe FALLAR (exit distinto de cero) por la razón correcta — pon en el informe el comando, su exit code y el fallo; queda registrada como la ejecución en rojo de la tarea.",
      naVerify: (n, slug) => `La tarea ${n} tiene _Expect: fail_: su prueba es una ejecución que FALLA (la prueba en rojo antes del arreglo) — una ejecución que pasa no cuenta. Registra la ejecución en rojo (${DEV_SPEC} done ${slug} ${n} --run mientras la prueba falla — antes del arreglo, o con el arreglo guardado en un stash), o quita _Expect: fail_ si la tarea no es una prueba en rojo.`,
    },
    projectChecks: {
      badInput: 'checks debe ser un objeto nombre → comando (p. ej. {"test": "npm test"}); un comando vacío elimina esa verificación.',
      badName: (k) => `nombre de verificación no válido '${k}' — letras, dígitos y . _ : - (hasta 40 caracteres, empezando por una letra o un dígito).`,
      badCommand: (k) => `el comando de la verificación '${k}' debe ser una línea de texto (hasta 500 caracteres) — o vacío para eliminar la verificación.`,
      tooMany: (max) => `como máximo ${max} verificaciones del proyecto.`,
      badStored: (rel) => `${rel} → meta.checks no es un objeto de nombre → comando (texto) — corrígelo a mano; no se modificará.`,
      initLine: (list) => `Verificaciones del proyecto (meta.checks): ${list}`,
      evidenceNotList: "evidence debe ser una lista de ejecuciones de verificaciones: [{name, command, exitCode, summary}].",
      noChecks: 'no hay verificaciones del proyecto configuradas (roadmap.json meta.checks) — nada que registrar. Defínelas primero: spec_init {checks: {"test": "npm test"}} (CLI: ' + DEV_SPEC + ' init --check test="npm test").',
      evidenceItem: (i, why) => `evidence[${i}]: ${why}`,
      itemNotObject: "cada ejecución debe ser un objeto {name, command, exitCode, summary}",
      unknownCheck: (name, list) => `'${name}' no es una verificación del proyecto — una de: ${list}`,
      needsCommand: "falta el comando que se ejecutó",
      needsExit: "falta su exit code (un entero)",
      status: (i) => ({ "no-run": "ninguna ejecución registrada", failed: `la última ejecución falló (exit ${i.exitCode})`, changed: "la ejecución no es de su comando (o el comando cambió desde entonces)", "before-last-tick": "se ejecutó antes de la última actividad en las tareas", "code-changed": "los ficheros de implementación cambiaron desde la ejecución", unobserved: "la ejecución no fue observada por el harness" })[i.status] || i.status,
      blocker: (list, slug) => `verificaciones del proyecto sin una ejecución correcta desde la última actividad en las tareas: ${list} — ejecútalas: ${DEV_SPEC} finish ${slug} --run (o registra las ejecuciones con spec_finish {evidence})`,
      doctorWarn: (list, slug) => `todas las tareas están hechas, pero hay verificaciones del proyecto sin una ejecución correcta desde la última actividad en las tareas: ${list} — spec_finish rechaza hasta que pasen: ${DEV_SPEC} finish ${slug} --run`,
      doctorOk: (n) => `todas las verificaciones del proyecto (${n}) tienen una ejecución correcta desde la última actividad en las tareas`,
      invalidStored: (list) => `roadmap.json meta.checks: entradas no válidas ignoradas (${list}) — cada una debe ser "nombre": "comando en una línea"`,
      prChecks: "## Verificaciones del proyecto",
      prNoRun: "ninguna ejecución registrada",
      briefDod: (list) => `Ejecuta las verificaciones del proyecto y pon en el informe cada comando, su exit code y las últimas líneas de la salida — nada de lo que pasaba antes de esta tarea puede fallar después: ${list}.`,
      briefDodRed: (list) => `Ejecuta las verificaciones del proyecto y pon en el informe cada comando, su exit code y las últimas líneas de la salida — los únicos fallos permitidos son las nuevas pruebas en rojo de esta tarea; todo lo que pasaba antes debe seguir pasando: ${list}.`,
      naFinish: (slug, list) => `Hay verificaciones del proyecto configuradas (${list}): el cierre necesita una ejecución correcta de cada una desde la última actividad en las tareas — ${DEV_SPEC} finish ${slug} --run las ejecuta y las registra (o ejecútalas tú y registra cada una con spec_finish {evidence: [{name, command, exitCode, summary}]}).`,
      recorded: (n) => `Registrada(s) ${n} ejecución(es) de verificaciones del proyecto en .state.json → finishChecks.`,
      noneToRun: 'no hay verificaciones del proyecto que ejecutar (roadmap.json meta.checks) — defínelas: ' + DEV_SPEC + ' init --check test="npm test" [--check lint="npm run lint"]',
      badArg: (v) => `--check espera nombre=comando (recibido '${v}') — un comando vacío (nombre=) elimina esa verificación`,
      posixOnWindows: (name, cmd, kinds) => `la verificación del proyecto '${name}' (\`${cmd}\`) usa sintaxis de shell POSIX (${kinds.map((k) => ({ "single-quotes": "comillas simples '…'", variable: "$VARIABLES" })[k] || k).join(", ")}) que cmd.exe — la shell predeterminada de --run en Windows — interpreta de otra forma, a menudo sin fallar. No se ejecutó nada. Vuelve a ejecutar con --shell bash (Git Bash; o define DEV_SPEC_SHELL=bash), con --shell pwsh si es un comando de PowerShell (o pasa el script a PowerShell entre comillas dobles: pwsh -NoProfile -Command "…") — o --shell cmd para ejecutarla en cmd.exe de todos modos.`,
      pwshInPosix: (name, cmd, kinds, shell) => `la verificación del proyecto '${name}' (\`${cmd}\`) pasa a PowerShell un script con ${kinds.map((k) => ({ variable: "$VARIABLES", backtick: "acentos graves (backticks)" })[k] || k).join(" y ")} fuera de comillas simples, pero lo ejecuta una shell POSIX (${shell}), que los expande antes — \`exit $LASTEXITCODE\` queda en un \`exit\` sin código (sale con 0), así que una comprobación que falla podría registrarse como correcta. No se ejecutó nada. En una shell POSIX pon el script entre comillas simples, o ejecuta las verificaciones con --shell pwsh (o define DEV_SPEC_SHELL=pwsh) y escribe solo el PowerShell.`,
    },
    runGate: {
      taskRefused: (cmd, why) => `\`${cmd}\` no pudo ejecutarse (${why}) — no se registró nada; la tarea sigue abierta.`,
      checkRefused: (name, cmd, why) => `la verificación del proyecto '${name}' (\`${cmd}\`) no pudo ejecutarse (${why}) — no se registró nada; corrígelo y vuelve a ejecutar finish --run.`,
      why: {
        spawn: (shell, code) => `no se pudo iniciar la shell '${shell}': ${code}`,
        signal: (sig) => `lo terminó la señal ${sig}`,
        timeout: (s) => `no terminó dentro del --timeout de ${s} s`,
        buffer: "su salida superó los 64 MB",
        wsl: (text) => `el bash que lo ejecutó es el lanzador de WSL, no una shell de esta máquina: ${text}`,
        shell: (text) => `la shell no pudo iniciarlo: ${text}`,
        error: (code) => `la ejecución no pudo arrancar: ${code}`,
      },
      wslBash: (p) => `--shell ${p} es el lanzador bash.exe de WSL: ejecuta el comando dentro de una distribución Linux (o falla con "execvpe(/bin/bash) failed"), no en una shell de esta máquina — se usa como pediste; una ejecución que WSL no pueda arrancar no se registra. Para una shell de esta máquina usa Git Bash: --shell bash lo encuentra (Git for Windows).`,
      wslExe: (p) => `--shell ${p} es wsl.exe, que no es una shell (rechaza el -c que usa toda ejecución en una shell) — rechazado, no se ejecutó nada. Indica la ruta del bash.exe de WSL para ejecutar dentro de WSL, o --shell bash para Git Bash.`,
      noGitBash: "--shell bash: no se encontró ningún Git Bash (git --exec-path, %ProgramFiles%\\Git\\bin\\bash.exe, PATH) — un bash.exe en System32 o WindowsApps es el lanzador de WSL, que ejecuta el comando dentro de una distribución Linux, así que nunca se usa. No se ejecutó nada. Instala Git for Windows, o indica en --shell la ruta completa de un bash.exe.",
    },
    gitLog: {
      head: (slug, n, citing, truncated) => `Commits: ${slug} — ${n} commit(s) leído(s)${truncated ? " (la ventana está llena: los commits más antiguos no se leyeron — --max N)" : ""}, ${citing} citan sus tareas`,
      taskLine: (n, text, done, list) => `  ${done ? "[x]" : "[ ]"} #${n} ${text} — ${list}`,
      commitRef: (short, subject, via) => `${short} ${subject} (${via})`,
      more: (n) => `+${n} más`,
      noCommit: "ningún commit la cita",
      implFirst: (n, tests, taskC, testC, files) => `red-first: el primer commit de la tarea ${n} (pone ${tests} en verde) es ${taskC}, anterior a cualquier commit que toque un fichero de prueba que nombre ${tests} (${files} — el primero en ${testC}): la implementación llegó antes que su prueba.`,
      testNotCommitted: (n, tests, taskC, files) => `red-first: la tarea ${n} (pone ${tests} en verde) tiene commit (${taskC}), pero ningún commit leído toca un fichero de prueba que nombre ${tests} (${files}) — haz primero el commit de la prueba.`,
      redFirstStatus: (n, tests, status) => `red-first: tarea ${n} (${tests}) — ` + ({ ok: "la prueba tuvo commit primero ✓", "no-test-file": "ningún fichero de prueba la nombra aún (nada que comparar)", "no-task-commit": "ningún commit cita aún la tarea", "outside-window": "no se puede saber: la ventana del log está llena (--max N)" })[status],
      conventions: (slug) => `Ningún commit cita una tarea de '${slug}'. Convenciones: nombra la función y la tarea — "Part of .specs/${slug}/ task #N." (lo que escribe /spec-commit) — o los IDs que cubre: "Makes T-01 green", US-1.AC-2.`,
      noGit: "git no está disponible aquí, o esto no es un repositorio git con commits — dev-spec log lee `git log`. O pasa un log por la entrada estándar: git log --name-only --relative | " + DEV_SPEC + " log <función> -",
    },

    stopGate: {
      claims: [
        String.raw`(?:está|están|esta|quedó|quedaron|fue|fueron|ya\s+está|ya\s+están)\s+(?:todo\s+)?(?:hech[oa]s?|list[oa]s?|terminad[oa]s?|completad[oa]s?|implementad[oa]s?|verificad[oa]s?|finalizad[oa]s?|resuelt[oa]s?)`,
        String.raw`tareas?\s+#?\d+(?:\s*(?:,|y|[-–]|a)\s*#?\d+)*\s+(?:(?:est[áa]|est[áa]n|fue|fueron|quedó|quedaron)\s+)?(?:hech[oa]s?|terminad[oa]s?|completad[oa]s?|implementad[oa]s?|verificad[oa]s?)`,
        String.raw`todas\s+las\s+(?:\d+\s+)?tareas\s+(?:(?:est[áa]n|fueron|quedaron|ya)\s+)*(?:hechas|terminadas|completadas|implementadas|verificadas|finalizadas|listas)`,
        String.raw`^[ \t*_#>\p{Extended_Pictographic}\uFE0F\u2713\u2714-]*(?:todo\s+)?(?:hecho|listo|terminado|completado|implementado|verificado|finalizado)[*_]*(?=[ \t]*(?:[.,!:—–\p{Extended_Pictographic}\u2713\u2714-]|$))`,
        String.raw`todo\s+(?:hecho|listo|terminado|en\s+verde|funciona)`,
        String.raw`(?:todas\s+las\s+(?:\d+\s+)?|las\s+)?(?:pruebas|tests?)\s+(?:(?:ya|ahora|todas)\s+)*(?:pasan|pasaron|pasa|pasó|est[áa]n\s+pasando|est[áa]n\s+en\s+verde|en\s+verde)`,
        String.raw`ya\s+funciona`,
        String.raw`terminé|completé|implementé|verifiqué|acabé|finalicé`,
        String.raw`completad[oa]s?|verificad[oa]s?|implementad[oa]s?`,
      ],
      negators: ["no", "nunca", "ni", "nada", "sin", "falta", "faltan", "ser", "cuando", "después", "antes", "si", "hasta", "voy", "vamos", "debo", "debe",
        "deben", "necesita", "necesitan", "tengo", "tenemos", "hay", "casi", "parcialmente", "pueda", "puedan", "aún", "todavía"],
      admissions: [
        String.raw`(?:no|nunca)\s+(?:(?:fue|fueron|está|están|ha|han|sido|se|todavía|aún)\s+){0,2}(?:verificad[oa]s?|probad[oa]s?|ejecutad[oa]s?)`,
        String.raw`sin\s+verificar|sin\s+evidencia|sin\s+verificación`,
        String.raw`[1-9]\d*\s+(?:pruebas?\s+|tests?\s+)?(?:fallan|fallaron|fallando|fallos?)`,
        String.raw`(?:pruebas|tests?)\s+(?:(?:todavía|aún|están)\s+)*(?:fallan|fallaron|fallando)`,
      ],
      fixed: ["corregí", "corregimos", "corregido", "corregida", "corregidos", "corregidas", "arreglé", "arreglamos", "arreglado", "arreglada", "arreglados", "arregladas",
        "resolví", "resolvimos", "resuelto", "resuelta", "resueltos", "resueltas", "anteriormente"],
      head: "dev-spec — gate de evidencia: tu último mensaje dice que el trabajo está hecho o verificado, pero hay tareas marcadas sin evidencia de verificación:",
      headSuite: "dev-spec — gate de evidencia: tu último mensaje dice que el trabajo está hecho o verificado, pero las verificaciones del proyecto no tienen una ejecución correcta desde la última actividad en las tareas:",
      taskLine: (slug, list) => `  - ${slug}: ${list}`,
      suiteLine: (slug, list) => `  - ${slug}: verificaciones del proyecto sin una ejecución correcta desde la última actividad en las tareas: ${list}`,
      more: (n) => `+${n} más`,
      todoTasks: (slug, n, file = "tasks.md") => `Registra la evidencia antes de afirmarlo: lee el comando _Verify:_ de cada tarea listada en .specs/${slug}/${file} (primero la tarea ${n}), ejecútalo sobre el código final solo si es seguro hacerlo y registra esa ejecución con spec_complete_task {name, number, evidence: {command, exitCode, summary}}.`,
      todoSuite: (slug) => `Las verificaciones del proyecto de ${slug} no tienen ninguna ejecución que pase: léelas en .specs/roadmap.json (meta.checks), ejecútalas solo si es seguro hacerlo y registra las ejecuciones con spec_finish {evidence}.`,
      plainly: "O di claramente cuáles de ellas no están verificadas.",
      implementer: {
        head: (n, slug) => `dev-spec — gate de evidencia: informas la tarea ${n} de '${slug}' como DONE, pero`,
        noReport: (file) => `su informe (${file}) no existe.`,
        noRun: (file, cmds) => `su informe (${file}) no muestra la ejecución del _Verify:_ — el comando exacto y su exit code: ${cmds}.`,
        notPassing: (file, cmds) => `su informe (${file}) no muestra ninguna ejecución correcta (exit 0) de ${cmds} — el _Verify:_ de una tarea DONE debe pasar.`,
        notFailing: (file, cmds) => `su informe (${file}) no muestra ninguna ejecución que falle (un exit code distinto de cero) de ${cmds} — la tarea tiene _Expect: fail_: su prueba es la ejecución en rojo.`,
        todo: "Ejecuta el comando sobre el código final y pon en el informe el comando, su exit code y las últimas líneas de su salida — o informa BLOCKED / NEEDS_CONTEXT si no puede pasar. (Evidencia antes que afirmaciones: el controlador solo marca la tarea con esa ejecución.)",
      },
      simplifier: {
        head: (slug) => `dev-spec — gate de evidencia: informas la pasada de simplificación de '${slug}' como DONE, pero`,
        noReport: (file) => `su informe (${file}) no existe.`,
        noFinal: (file) => `su informe (${file}) no tiene una sección "## Final runs" con ejecuciones — la última sección, una línea por ejecución: - \`<comando>\` → exit <código>.`,
        noRun: (file, cmds) => `la sección "## Final runs" de su informe (${file}) no muestra estas ejecuciones con su exit code: ${cmds} — todas las verificaciones del proyecto deben estar, una línea por ejecución: - \`<comando>\` → exit <código>.`,
        notPassing: (file, cmds) => `las ejecuciones finales de su informe (${file}) fallan: ${cmds} — una simplificación debe dejar todas las ejecuciones en verde.`,
        todo: "Ejecuta las verificaciones del proyecto (o la batería de pruebas completa) y el _Verify:_ de las tareas cambiadas sobre el código final y ponlos al final del informe, en \"## Final runs\", una línea cada uno (- `<comando>` → exit <código>, luego las últimas líneas de la salida) — o revierte el cambio que hizo fallar una ejecución, o informa BLOCKED. (\"Comportamiento sin cambios\" es una afirmación: las ejecuciones son su prueba.)",
      },
      allow: {
        off: () => "gate de evidencia: desactivado (roadmap.json meta.stopCheck: false) — nada comprobado.",
        "stop-hook-active": () => "gate de evidencia: este fin de turno ya se devolvió una vez (stop_hook_active) — permitido.",
        "no-specs": () => "gate de evidencia: aquí no hay una .specs/ de dev-spec — nada que comprobar.",
        "no-claim": () => "gate de evidencia: el mensaje no afirma que algo esté terminado ni verificado — permitido.",
        admitted: () => "gate de evidencia: el mensaje dice claramente qué no está verificado (o falla) — permitido.",
        "no-recent": (i) => `gate de evidencia: ninguna función tuvo actividad en las últimas ${i.hours} h (tarea marcada, evidencia registrada o tasks.md editado) — permitido.`,
        verified: (i) => `gate de evidencia: todas las tareas marcadas de las funciones con actividad reciente tienen evidencia correcta (${i.list}) — permitido.`,
        "not-done": () => "gate de evidencia: el subagente informa BLOCKED / NEEDS_CONTEXT — permitido.",
        "no-changes": () => "gate de evidencia: el simplificador informa NO_CHANGES — nada que probar, permitido.",
        "no-report": () => "gate de evidencia: el mensaje no nombra ningún informe de simplificación (.specs/<función>/.execution/simplify-report.md) — permitido.",
        "simplify-ok": (i) => `gate de evidencia: el informe de simplificación de '${i.slug}' termina con sus ejecuciones correctas — permitido.`,
        "no-task": () => "gate de evidencia: el mensaje no nombra ningún informe de tarea (.specs/<función>/.execution/task-N-report.md) — permitido.",
        "nothing-to-verify": (i) => `gate de evidencia: la tarea ${i.n} de '${i.slug}' no tiene un comando _Verify:_ ejecutable — permitido.`,
        "report-ok": (i) => `gate de evidencia: el informe de la tarea ${i.n} de '${i.slug}' muestra la ejecución de su _Verify:_ — permitido.`,
      },
      on: "Gate de evidencia ACTIVADO — un turno que termina diciendo que el trabajo está hecho o verificado se devuelve mientras una función con actividad reciente tenga tareas marcadas sin evidencia de verificación (roadmap.json meta.stopCheck; hooks/stop-hook.js).",
      off: "Gate de evidencia DESACTIVADO — la comprobación de las afirmaciones al final del turno está desactivada (roadmap.json meta.stopCheck: false).",
      badValue: (v) => `--stop-check admite on u off (recibido '${v}').`,
    },
    scopeGuard: {
      on: "Modo guardia SCOPE (alcance) — Write/Edit en un fichero de código fuera de .specs/ pide confirmación salvo que una tarea sin terminar de una función aprobada lo nombre en _Implements:_ (el fichero, su carpeta o un glob; ficheros de prueba exceptuados), y la pide en todo cambio de código mientras ninguna función tenga tareas aprobadas sin terminar (roadmap.json meta.guard: \"scope\"). Los ficheros de prueba se permiten mientras el plan de pruebas de una función sin terminar esté aprobado (la Fase 4 escribe las pruebas que fallan antes del gate de las tareas), y todo fichero de código mientras un spike esté en curso (su prototipo).",
      ask: (file, features, hint) => `dev-spec guard (scope): ${file} no está en el plan — ninguna tarea sin terminar de ${features} lo nombra en _Implements:_. ${hint} (El modo guardia está en scope — ${DEV_SPEC} init --guard on permite todo fichero de código mientras haya tareas aprobadas; --guard off lo desactiva.)`,
      hint: {
        "same-folder": (n, slug, ref) => `Añádelo al _Implements:_ de la tarea ${n} (${slug} — misma carpeta que ${ref}) y vuelve a aprobar la fase tasks, o planifica el cambio con /spec-converge (spec_append_tasks).`,
        nearby: (n, slug, ref) => `Añádelo al _Implements:_ de la tarea ${n} (${slug} — planifica ${ref}, cerca) y vuelve a aprobar la fase tasks, o planifica el cambio con /spec-converge (spec_append_tasks).`,
        next: (n, slug) => `Añádelo al _Implements:_ de la tarea ${n} (${slug}, la siguiente tarea sin terminar) y vuelve a aprobar la fase tasks, o planifica el cambio con /spec-converge (spec_append_tasks).`,
      },
    },

    // 1.14 C2 — registro de decisiones (decisions.md, spec_decide) y el tipo spike (investigar → decidir).
    decisions: {
      header: (name) => `# Decisiones: ${name}

<!-- Registro de decisiones — solo se añade, se versiona con la spec. spec_decide (dev-spec decide) añade cada entrada:
     D-1, D-2… nunca renumeradas, nunca reescritas. _Affects:_ indica los AC IDs, T-IDs y secciones del diseño que toca
     la decisión; una decisión posterior que reemplace a otra dice _Supersedes: D-n_. Los descubrimientos (hechos
     aprendidos durante el trabajo) usan el mismo registro (_Kind: discovery_). -->
`,
      labels: { context: "Contexto", decision: "Decisión", discovery: "Descubrimiento", consequences: "Consecuencias" },
      kinds: { decision: "decisión", discovery: "descubrimiento" },
      titleRequired: "una decisión necesita un título (una línea de texto).",
      decisionRequired: "una decisión necesita su texto — decision: qué se decidió (en un descubrimiento: qué se descubrió).",
      badText: (field) => `${field} debe ser texto.`,
      tooLong: (field, max) => `${field} es demasiado largo (como máximo ${max} caracteres).`,
      badKind: (v) => `kind debe ser decision o discovery (recibido: ${v}).`,
      badAffectsChange: (list) => `referencia(s) _Affects:_ desconocida(s): ${list} — un cambio nombra un AC ID que su change.md define, o un título de sección de change.md (Resumen, Criterios de Aceptación, Enfoque, Tareas). No se escribió nada.`,
      badAffects: (list) => `referencia(s) _Affects:_ desconocida(s): ${list} — un AC ID debe estar definido en requirements.md, un T-ID planificado en test-plan.md, un ID EC/NFR/SC escrito en requirements.md; cualquier otra debe ser un título de sección de design.md (bug.md / design.md en un bugfix, spike.md en un spike). No se escribió nada.`,
      badSupersedes: (list) => `_Supersedes:_ debe indicar decisiones que ya están en este registro (D-n): ${list}. No se escribió nada.`,
      unsafeFile: (rel) => `${rel} no es un archivo normal dentro de .specs/ (es un enlace simbólico, o apunta fuera del proyecto) — sustitúyelo primero por un archivo normal. No se escribió nada.`,
      recorded: (id, kind, file) => `${id} (${kind}) registrada en ${file}.`,
      briefHeading: "## Decisiones",
      briefIntro: "Decisiones y descubrimientos (decisions.md) que citan los criterios o pruebas de esta tarea — respétalos:",
      briefOmitted: (list) => `…y ${list} — ver decisions.md.`,
      supersedesNote: (list) => `reemplaza ${list}`,
      prHeading: "## Decisiones",
      catalogLine: (n, list) => `Decisiones (${n}): ${list}`,
      superseded: "reemplazada",
      affectsApproved: (list, slug, phases) => `decisiones registradas después de una aprobación tocan la spec aprobada: ${list} — revisa lo que cambian (spec_impact ${slug} --phase ${phases}), actualiza la spec y vuelve a aprobar.`,
      affectsApprovedEntry: (id, refs, file, day) => `${id} (${refs}) después de aprobarse ${file} (${day})`,
      phantomDoctor: (list) => `referencias _Affects:_ en decisions.md que no corresponden a nada en esta función: ${list} — una errata, o un criterio / prueba / sección eliminado desde entonces.`,
      phantom: (id, ref) => `${id} _Affects:_ ${ref} — no corresponde a nada en esta función (una errata, o un criterio / prueba / sección eliminado desde entonces)`,
      cliRecorded: (id, title, file) => `✎ ${id} — ${title}  (${file})`,
    },
    spike: {
      kind: "spike",
      kicker: "Spike (investigación)",
      report: (a) => `# Spike: ${a.name}

<!-- Spike (investigar → decidir): una investigación con tiempo acotado (timebox) que termina en una DECISIÓN, no en código de producción.
     El código de prototipo vive FUERA de .specs/ (una carpeta de borrador o una rama) — enlázalo en Evidencia.
     spec_doctor falla mientras la "Decisión" no esté escrita y avisa cuando pasa la fecha del timebox sin ella.
     Indica el resultado en su propia línea: _Outcome: go_ · _Outcome: no-go_ · _Outcome: pivot_ -->

## Pregunta
${a.question || "> **TODO** — la única pregunta que responde este spike (¿qué respuesta cambiaría el plan?)."}

## Timebox (plazo)
${a.until ? `**Hasta:** ${a.until}${a.raw && a.raw !== a.until ? ` (${a.raw})` : ""}` : "> **TODO** — la fecha de fin (AAAA-MM-DD) o el límite de esfuerzo. Cuando termine, decide con la evidencia que tengas."}

## Opciones consideradas
- [opción A — qué es, cuánto costaría]
- [opción B]

## Evidencia
<!-- Enlaces, mediciones, prototipos (el código queda fuera de la spec — enlázalo aquí), qué se probó y qué pasó. -->
- [enlace / medición / prototipo — y qué mostró]

## Decisión
> **TODO** — go / no-go / pivot (seguir / no seguir / cambiar de rumbo) y por qué: la evidencia que lo decidió.

_Outcome: [go | no-go | pivot]_

## Seguimiento
- [go: la función a especificar (spec_create) · no-go: por qué se descartó · pivot: la nueva pregunta]
`,
      tasks: (name) => `# Tareas: ${name}

<!-- Un spike no tiene gates de requisitos / diseño: pregunta → investigar → decidir. El código de prototipo vive FUERA
     de .specs/ — enlázalo en spike.md → Evidencia. Cuando termine el timebox, decide con lo que tengas. -->

## Fase: Investigación
- [ ] 1. [shared] Afinar la pregunta y fijar el timebox en spike.md (¿qué respuesta cambiaría el plan?)
- [ ] 2. [shared] Listar las opciones consideradas en spike.md → Opciones consideradas
- [ ] 3. [shared] Reunir la evidencia — prototipos (fuera de .specs/), mediciones, enlaces — en spike.md → Evidencia
- [ ] 4. [shared] Registrar la decisión (go / no-go / pivot) y su justificación en spike.md → Decisión; regístrala con spec_decide
**Checkpoint:** la pregunta tiene una respuesta respaldada por evidencia.
`,
      badTimebox: (v) => `timebox debe ser una fecha de fin (AAAA-MM-DD) o una duración desde hoy (p. ej. 3d, 2w, 8h) — recibido: ${v}.`,
      spikeOnly: (arg) => `${arg} solo se aplica a un spike (kind: "spike").`,
      tracksIgnored: (list) => `Un spike es solo core — tracks ignorados (${list}); dáselos a la función que especifiques tras un 'go'.`,
      noTracks: (slug) => `'${slug}' es un spike — no tiene tracks. Tras un 'go', especifica la función real con sus tracks (spec_create).`,
      noGate: (phase, slug) => `'${slug}' es un spike: no tiene gate de ${phase} — sigue pregunta → investigar → decidir. Registra la decisión en spike.md → Decisión (spec_decide la registra en el log); spec_finish lo cierra.`,
      doctor: {
        missing: "falta spike.md — ahí viven la pregunta, la evidencia y la decisión de un spike.",
        questionOk: "la pregunta está escrita",
        questionMissing: "spike.md → Pregunta sigue siendo la plantilla — escribe la única pregunta que responde este spike.",
        decisionOk: (o) => `decisión registrada (_Outcome: ${o}_)`,
        decisionMissing: "spike.md → Decisión aún no está escrita (go / no-go / pivot + justificación) — el spike no termina hasta que lo esté.",
        outcomeMissing: "la decisión está escrita pero su resultado no está indicado — añade una línea _Outcome: go_, _Outcome: no-go_ o _Outcome: pivot_.",
        timeboxOk: (d) => `timebox hasta ${d}`,
        timeboxPassed: (d) => `el timebox terminó el ${d} y no hay decisión registrada — decide con la evidencia que tienes (go / no-go / pivot), o amplía el timebox a propósito.`,
        timeboxUnset: "sin timebox — escribe una fecha de fin (AAAA-MM-DD) en spike.md → Timebox.",
        timeboxNoDate: "el timebox no tiene fecha de fin (AAAA-MM-DD) — no se puede comprobar cuándo se agota.",
        timeboxDecided: "decidido — el timebox está cerrado",
      },
      next: {
        missing: (slug) => `falta spike.md — vuelve a crearlo: ${DEV_SPEC} spike "${slug}" (solo crea: lo que existe se mantiene).`,
        fillQuestion: (slug) => `Escribe la pregunta que responde este spike (y su timebox) en spike.md → Pregunta / Timebox — /spec-spike ${slug}.`,
        investigate: (n, text, slug) => `Investiga — tarea #${n}: ${text}. El código de prototipo queda fuera de .specs/ (enlázalo en spike.md → Evidencia); márcala: ${DEV_SPEC} done ${slug} ${n}.`,
        decide: (slug) => `Registra la decisión en spike.md → Decisión — go / no-go / pivot, la justificación y su línea _Outcome:_ — y regístrala en el log: /spec-decide ${slug} (spec_decide).`,
        outcome: (slug) => `Indica el resultado en spike.md → Decisión: una línea _Outcome: go_, _Outcome: no-go_ o _Outcome: pivot_ (/spec-spike ${slug}).`,
        timeboxPassed: (d) => `El timebox terminó el ${d}: decide con la evidencia que tienes.`,
        goCreateFirst: (slug, name, summary) => `Decisión: go. Especifica la función real — spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (${DEV_SPEC} create "${name}" --summary ${JSON.stringify(summary)}) — y luego archiva el spike: /feature archive ${slug}.`,
        goArchiveFirst: (slug, name, summary) => `Decisión: go. Archiva primero el spike — /feature archive ${slug} (libera el nombre) — y luego especifica la función real: spec_create {name: "${name}", summary: ${JSON.stringify(summary)}} (${DEV_SPEC} create "${name}" --summary ${JSON.stringify(summary)}).`,
        noGo: (slug, reason) => `Decisión: no-go${reason ? ` — ${reason}` : ""}. Archiva el spike con su motivo (queda en spike.md → Decisión): /feature archive ${slug}.`,
        pivot: (slug, reason) => `Decisión: pivot${reason ? ` — ${reason}` : ""}. Empieza un nuevo spike para la nueva dirección (${DEV_SPEC} spike "<nueva pregunta>") — o especifica la función si la respuesta ya está clara — y luego archiva este: /feature archive ${slug}.`,
      },
      finish: {
        ready: (slug) => `el spike '${slug}' está listo para cerrar — su decisión está registrada. Actúa en consecuencia (spec_next_action dice cómo).`,
        notReady: (slug) => `el spike '${slug}' aún no está listo para cerrar:`,
        missing: "falta spike.md",
        decisionBlocker: "spike.md → Decisión aún no está escrita (go / no-go / pivot + justificación)",
        prQuestion: "## Pregunta",
        prDecision: (o) => `## Decisión${o ? ` — ${o}` : ""}`,
        prEvidence: "## Evidencia",
        prOptions: "## Opciones consideradas",
        prFollowUp: "## Seguimiento",
        checks: ["La decisión se ha compartido con las personas a las que afecta.", "El código de prototipo queda fuera de la rama principal — la función real reescribe lo que aproveche en sus propias tareas."],
      },
      roadmapTimebox: (d) => `spike: el timebox terminó el ${d} sin decisión`,
      catalogQuestion: (q) => `Pregunta: ${q}`,
      catalogOutcome: (o) => `Decisión: ${o}`,
      catalogPending: "Decisión: pendiente",
      exportSection: "Spike",
      cliQuestion: (q) => `  pregunta: ${q}`,
      cliUntil: (d) => `  timebox: hasta ${d}`,
    },

    flow: {
      required: (slug, known) => `falta el flujo — uno de: ${known} (spec_feature {action: "flow", name: "${slug}", flow}; CLI: ${DEV_SPEC} feature flow ${slug} <flow>).`,
      kindRefused: (slug, kind) => `'${slug}' es un ${kind}: sigue su propio orden de fases fijo — el flujo solo se aplica a funciones.`,
      kindIgnored: (kind) => `flujo ignorado: un ${kind} sigue su propio orden de fases fijo (el flujo solo se aplica a funciones).`,
      kept: (slug, cur, asked) => `flujo mantenido: '${slug}' sigue ${cur} (pedido: ${asked}) — cámbialo con spec_feature {action: "flow"} (CLI: ${DEV_SPEC} feature flow ${slug} ${asked}).`,
      set: (slug, flow, prev, order) => `'${slug}' sigue ahora el flujo ${flow} (antes: ${prev}) — orden de fases: ${order}.`,
      same: (slug, flow, order) => `'${slug}' ya sigue el flujo ${flow} — orden de fases: ${order}.`,
      approvedStay: (list) => `Las fases ya aprobadas siguen aprobadas: ${list}.`,
      created: (order) => `flujo design-first — orden de fases: ${order} (los requisitos se escriben después de aprobar el diseño).`,
      nextNote: (order) => `(flujo design-first: ${order})`,
      laterPhase: (detail) => `requirements.md es una fase posterior (design-first) — ${detail}`,
    },
    importPlans: {
      plansDir: "El plan mode de Claude Code guarda los planes en plansDirectory (por defecto ~/.claude/plans — fuera del proyecto): copia primero el plan dentro del proyecto, o apunta plansDirectory a una carpeta dentro de él.",
      several: (dir, list) => `'${dir}' contiene varios documentos (${list}) — indica el que quieres importar.`,
      planTitle: "Plan",
      wNoSteps: "no se encontró ninguna checklist, lista de to-dos ni de pasos — se mantuvo el tasks.md del scaffold (divide el trabajo en tareas con /createTask)",
      wCancelled: (list) => `to-dos cancelados importados como tareas abiertas (elimina los que ya no apliquen): ${list}`,
      wNoDesignLeft: "no quedó nada para el diseño aparte de los criterios y los pasos — se mantuvo el design.md del scaffold",
      wNotExecPlan: "no se encontraron secciones de ExecPlan (Progress, Decision Log, Concrete Steps, Validation and Acceptance …) — ¿es un ExecPlan? Prueba la herramienta 'plan'.",
      decisionsHeading: "## Decisiones",
      nonFunctional: "## Requisitos No Funcionales",
      wUnknownAc: (story, task, list) => `${story}, '${task}': la(s) referencia(s) de AC ${list} no corresponden a ningún criterio de esa historia — se mantienen como están`,
      wWorkflow: (list) => `registros de workflow de BMAD no importados (se quedan donde están): ${list}`,
    },
    // 1.17 F — spec_import {tool: "fluidplan"} (ver el bloque EN).
    importFluidplan: {
      several: (dir, list) => `'${dir}' contiene varios planes de fluidplan (${list}) — indica el que quieres importar (su carpeta, su plan.json o su PLAN.md).`,
      notFluidplan: (file) => `'${file}' no es un PLAN.md ni un DECISIONS.md de fluidplan (sin título '<título> — execution plan' / '<título> — decisions', sin tarea '### [ ] 1.1 <tarea> · D1').`,
      notFluidplanText: "El texto no es un PLAN.md ni un DECISIONS.md de fluidplan (sin título '<título> — execution plan' / '<título> — decisions', sin tarea '### [ ] 1.1 <tarea> · D1').",
      decisionsIntro: "El contexto, la elección y las consecuencias de cada decisión están en decisions.md.",
      rejectedMark: "rechazada",
      openMark: (state) => `aún abierta en fluidplan (${state})`,
      chosen: "elegida",
      tradeoffsHead: ["Decisión", "Opción", "Pros", "Contras", "Esfuerzo"],
      context: "## Contexto",
      sourceDoc: (p) => `Documento de origen: \`${p}\``,
      glossary: "## Glosario",
      finalCheck: "## Verificación final",
      visuals: "## Visuales",
      outOfScope: "## Fuera de Alcance",
      openDecisions: "## Decisiones abiertas",
      openLine: (id, title, state, acs, note) => `- [NEEDS CLARIFICATION] **${id} · ${title}** — ${state}${note ? `: ${note}` : ""}${acs ? ` (los criterios que determina: ${acs})` : ""}: decídela en fluidplan, o aquí, antes de aprobar los requisitos`,
      constraints: "## Restricciones Globales",
      themes: "## Temas",
      revisionNote: (round, note) => `Revisión (ronda ${round}): ${note}`,
      label: {
        decision: "Decisión", deletes: "A eliminar", untraced: "Otros ficheros indicados (sin rastreo)", verify: "Verificar (sin marcador)", do: "Hacer", remark: "Observación", remarks: "Observaciones",
        itemsKept: "Elementos conservados", items: "Elementos", importance: "Importancia", phase: "Fase", page: "Tema", proposal: "Propuesta", rewritten: "reescrita por quien revisó",
        pros: "pros", cons: "contras", effort: "esfuerzo", cost: "coste", others: "Otras opciones", dependsOn: "Depende de", fluidplan: "decisión de fluidplan",
        question: "Pregunta abierta en el origen", sourceRef: "En el origen", learnMore: "Más", subtitle: "Subtítulo",
      },
      importance: { critical: "crítica", important: "importante", minor: "menor" },
      verdict: { pending: "sin respuesta", modify: "a cambiar", explain: "con una pregunta", ko: "rechazada", mixed: "parcialmente decidida" },
      otherOption: "otra opción (descrita en la observación)",
      rejected: (reason) => `Rechazada — fuera de esta función${reason ? `: ${reason}` : "."}`,
      wDraft: (pending, revise) => `el plan de fluidplan no está cerrado (DRAFT: ${pending} decisión(es) sin respuesta, ${revise} a revisar) — hay que cerrarlo en fluidplan y finalizarlo, o aclarar aquí las decisiones abiertas`,
      wOpen: (list) => `decisiones aún abiertas en fluidplan — sin entrada en decisions.md, listadas en Decisiones abiertas con [NEEDS CLARIFICATION]: ${list}`,
      wRejected: (list) => `decisiones rechazadas en fluidplan (Not OK) — registradas en decisions.md como rechazadas y listadas en Fuera de Alcance (fluidplan no conserva ninguna de sus tareas): ${list}`,
      wAfter: (task, ref) => `tarea ${task}: after '${ref}' no corresponde a ninguna tarea que el plan conserva — sin _Depends:_ para ella`,
      wPath: (task, p) => `tarea ${task}: '${p}' no es una ruta relativa al proyecto (absoluta, en la carpeta personal, URL, '..' o un glob) — citada en el texto de la tarea, no en _Implements:_`,
      wVerify: (task, cmd) => `tarea ${task}: el comando de verificación '${cmd}' no se puede escribir como marcador _Verify:_ — se mantiene en el texto de la tarea`,
      wRounds: "el historial de rondas de fluidplan (rounds/, los veredictos de las rondas anteriores) no se importa — las decisiones cerradas sí, con su última nota de revisión",
      wCycle: (tasks, dropped) => `tareas ${tasks}: sus 'after' forman un ciclo — ninguna podía empezar. Quitado: ${dropped} (tarea → la tarea posterior de la que dependía, contra el orden del plan); corrige el orden en fluidplan`,
      wNoExport: "state.json dice que el plan se exportó, pero no se encontró su PLAN.md (la carpeta del plan, el output de plan.json, el outputDir de fluidplan.config.json) — las tareas vienen de plan.json, sin sus marcas de hechas",
      wNoDecisions: "no hay DECISIONS.md ni plan.json junto al PLAN.md — decisions.md solo tiene lo que PLAN.md dice de cada decisión (la elección y la importancia: sin porqué, sin alternativas)",
      wBadJson: (file, err) => `${file} no es un objeto JSON válido (${err}) — no se leyó`,
      wVisuals: (list) => `los visuales de fluidplan los dibuja su página — citados en design.md (Visuales), no dibujados: ${list}`,
      wNoTasks: "el plan no conserva ninguna tarea — se mantuvo el tasks.md del scaffold",
    },
  };

// 1.16 Q — spec quality: steering amendments (Q1), cross-feature acceptance criteria (Q2), the glossary (Q3). One group per
// language, merged into MSG (pt-BR derives from pt's). Check ids, reason codes and file names stay English.
const quality = {
    steeringChange: { modified: "modificado", removed: "eliminado" },
    steeringItem: (phase, day, files) => `${phase} (aprobado el ${day}): ${files}`,
    steeringDoctor: (items, slug) => `steering modificado después de la aprobación — ${items}: revisa según el steering modificado y vuelve a aprobar (${DEV_SPEC} impact ${slug} --phase steering; sin función lista todas las afectadas).`,
    naSteering: (phases, files, slug) => `Nota: el steering cambió después de la aprobación de ${phases} (${files}) — revisa según él y vuelve a aprobar si sigue siendo válido (${DEV_SPEC} impact ${slug} --phase steering).`,
    impactNeedsName: (phases) => `falta el nombre — solo la fase 'steering' funciona para todo el proyecto (sin función). Fases: ${phases}.`,
    impactNoReopen: "reopen no se aplica a la fase 'steering' — no se desmarca nada: revisa las funciones listadas y vuelve a aprobar sus requisitos / su diseño.",
    impactHead: (n, feature) => (feature
      ? (n ? `Steering — ${feature}: aprobada con una versión anterior de steering que cambió desde entonces` : `Steering — ${feature}: ninguna aprobación se hizo con steering que cambió desde entonces`)
      : (n ? `Steering — ${n} función(es) activa(s) aprobada(s) con una versión anterior de steering que cambió desde entonces` : "Steering — ninguna aprobación de requisitos / diseño se hizo con steering que cambió desde entonces")),
    impactUntracked: (list) => `aprobadas antes de la 1.16 (sin fingerprints del steering — nunca señaladas): ${list}`,
    impactUnreadable: (list) => `omitidas — .state.json ilegible: ${list}`,
    impactReReview: (slug, phase) => `Revisa cada una según el steering modificado y vuelve a aprobar (/approve ${slug} ${phase}) — la aprobación registra el steering actual.`,
    xacKind: { duplicate: "casi duplicado", conflict: "posible conflicto" },
    xacWhy: (reason, pct, nums) => (reason === "opposite-modal" ? `DEBE vs NO DEBE, ${pct}% parecidos` : reason === "different-numbers" ? `números distintos ${nums}, ${pct}% parecidos` : `${pct}% parecidos`),
    xacItem: (mine, other, kind, why) => `${mine} ↔ ${other} (${kind}: ${why})`,
    xacDoctor: (n, list) => `${n} par(es) de criterios se parecen a los de otra función activa o pueden contradecirlos — ${list}. Únelos o reescríbelos, o declara _Supersedes: <feature>/US-n.AC-m_ en el más reciente.`,
    xacMore: (n) => `… +${n}`,
    xacHeading: "Posibles duplicados / conflictos",
    xacIntro: "Criterios de aceptación de funciones activas distintas que se parecen (casi duplicados) o pueden contradecirse (el mismo disparador con DEBE vs NO DEBE, o números distintos) — una heurística: únelos o reescríbelos, o declara _Supersedes:_ en el más reciente.",
    xacTruncated: "(limitado — no se compararon todos los criterios)",
    glossaryQuestion: (locs, word, term, def) => `${locs}: '${word}' — el glosario dice ${term}${def ? ` (${def})` : ""}. Usa "${term}", o corrige .specs/steering/glossary.md si '${word}' significa otra cosa aquí.`,
    glossaryMore: (n) => `… y ${n} palabra(s) más que el glosario manda evitar — ver spec_doctor (glossary).`,
    glossaryItem: (word, term, locs) => `'${word}' → ${term} (${locs})`,
    glossaryDoctor: (n, list) => `${n} uso(s) de palabras que el glosario manda evitar — ${list} (spec_clarify pregunta por cada una)`,
    glossaryOk: (n) => `ninguna palabra que el glosario manda evitar en requirements.md / design.md (${n} término(s))`,
    glossaryTruncated: (read, total) => `glossary.md tiene ${total} entradas — solo se leen las primeras ${read} (divídelo o recórtalo)`,
    briefGlossaryHeading: "## Glosario (términos que usa esta tarea)",
    briefGlossaryIntro: "Usa estas palabras tal como están definidas (.specs/steering/glossary.md) — nunca las que hay que evitar:",
    briefGlossaryAvoid: (list) => `evitar: ${list}`,
    briefGlossaryOmitted: (list) => `Se aplican más entradas (tamaño) — léelas en .specs/steering/glossary.md: ${list}`,
  };

// 1.17 A — every design weighs its choices: doctor's design-tradeoffs / design-risks details (keyed by check id, then by the
// section state: missing · template · empty · few · filled) and spec_clarify's consistency nudge (A2). pt-BR derives from pt.
const designWeigh = {
    "design-tradeoffs": {
      filled: (n) => (n ? `${n} opción(es) sopesada(s)` : "escrita en prosa (sin lista de opciones — las opciones sopesadas en un párrafo, o por qué este diseño no tiene ninguna decisión clave)"),
      missing: () => "sin sección Alternativas y Compensaciones — enumera las opciones sopesadas para cada decisión clave (pros, contras, coste de equivocarse, la elegida y por qué)",
      template: () => "Alternativas y Compensaciones sigue siendo la plantilla — sustituye sus placeholders por las opciones realmente sopesadas",
      empty: () => "Alternativas y Compensaciones está vacía — enumera las opciones sopesadas para cada decisión clave",
      few: (n, min) => `Alternativas y Compensaciones enumera ${n} opción(es) — sopesa al menos ${min} por decisión clave (una fila de la tabla o un punto cada una: una opción sola nunca se sopesó), o explica en una frase por qué no hay ninguna decisión clave`,
    },
    "design-risks": {
      filled: (n) => (n ? `${n} riesgo(s) enumerado(s)` : "escrita (sin fila ni punto — un honesto 'ningún riesgo relevante' cuenta)"),
      missing: () => "sin sección Riesgos — enumera lo que podría hacer erróneo el diseño o retrasar la entrega (probabilidad, impacto, mitigación, responsable)",
      template: () => "Riesgos sigue siendo la plantilla — sustituye sus placeholders por los riesgos reales (o explica por qué no hay ninguno)",
      empty: () => "Riesgos está vacía — un honesto 'ningún riesgo relevante, porque X' sirve; en blanco no",
      few: () => "Riesgos no enumera ningún riesgo",
    },
    // 1.19 R1 — la sección Reutilización e Integración (los estados de arriba, más `integration`: el integration-plan.md de una
    // función brownfield → Puntos de Integración la sustituye).
    "design-reuse": {
      filled: (n) => (n ? `${n} elemento(s) indicado(s) (reutilizado / extendido / nuevo)` : "escrita (sin fila ni punto — 'proyecto nuevo: aún nada que reutilizar' cuenta)"),
      missing: () => "sin sección Reutilización e Integración — indica los módulos, componentes, helpers o servicios existentes que esta función reutiliza o extiende (con sus rutas), qué es nuevo y por qué nada de lo existente sirve, y dónde vive el código nuevo",
      template: () => "Reutilización e Integración sigue siendo la plantilla — sustituye sus placeholders por lo que esta función realmente reutiliza, extiende y añade (o indica que es un proyecto nuevo)",
      empty: () => "Reutilización e Integración está vacía — indica qué se reutiliza o extiende, o explica en una línea por qué nada (proyecto nuevo); en blanco no",
      few: () => "Reutilización e Integración no indica nada",
      integration: (n) => `cubierta por integration-plan.md → Puntos de Integración${n ? ` (${n} elemento(s))` : ""}`,
    },
    legacyApproval: (d, v = "1.17") => `diseño aprobado antes de la ${v} — solo se exige a partir de su próxima aprobación (${d})`,
    clarifyConsistency: (words) => `La spec menciona ${words}, pero ni los requisitos ni el diseño dicen nada de consistencia ni de idempotencia (la respuesta va en Alternativas y Compensaciones / Riesgos del diseño, o en un requisito): ¿qué debe tener éxito o fallar a la vez (atomicidad, nivel de aislamiento), quién más escribe los mismos datos a la vez, consistencia fuerte o eventual (qué desfase es aceptable), y cuál es la garantía de entrega y la idempotencia de todo lo asíncrono?`,
  };

// ===========================================================================
// Task brief (spec_task_brief) — the self-contained brief a fresh implementer reads first.
// Labels and loop rules per language; renderBrief() owns the layout. IDs, `_Label:_` markers and
// **Checkpoint:** stay English-stable inside the rendered brief.
// ===========================================================================
const brief = {
    title: (feature, n) => `# Brief de la tarea — ${feature} · tarea ${n}`,
    intro: "Lee esto primero — son tus requisitos. Los valores de abajo son vinculantes; no construyas nada más allá de esta tarea.",
    story: "Historia", phase: "Fase", parallel: "Paralela", tracks: "Tracks", loop: "Ciclo",
    yes: "sí [P]", no: "no",
    inlineOnly: "⚠ **Solo inline** — tarea de prompt/evals: el controlador la ejecuta en la sesión principal (las evals cuestan dinero; aceptar/revertir es una decisión). No la delegues.",
    task: "## Tarea",
    context: "## Dónde encaja (historia de usuario)",
    bug: "## El bug (bug.md)", bugRepro: "Reproducción", bugRootCause: "Causa raíz",
    bugUnfilled: "_Aún sin escribir — ninguna corrección antes de que la causa raíz esté escrita en bug.md._",
    acs: "## Criterios de aceptación (vinculantes)",
    acsNone: "_Ningún criterio de aceptación referenciado — responde NEEDS_CONTEXT en vez de inventar alcance._",
    tests: "## Pruebas a poner en verde",
    testsRed: "## Pruebas que escribe esta tarea — deben FALLAR primero (rojo)",
    evals: "## Evals afectadas",
    metrics: "## Métricas a emitir",
    files: "## Ficheros (_Implements:_)",
    // 1.19 R2 — buscar antes de escribir: las entradas de Reutilización e Integración del diseño para esta tarea, y los ficheros junto a los suyos
    reuse: "## Reutilización — buscar antes de escribir",
    reuseRule: "Antes de escribir cualquier helper, componente, cliente, validador o formateador, busca en el código por concepto y por sinónimos (references/code-reuse-and-quality.md): primero reutilizar, luego extender, y solo entonces crear. Una unidad que extender fuera de los ficheros de esta tarea (_Implements:_) nunca se edita en silencio — detente y pregunta (NEEDS_CONTEXT), o créala localmente y nómbrala en el informe. El bloque **Reuse** de tu informe dice qué se reutilizó, extendió o creó, y por qué.",
    reuseEntries: "Las entradas de Reutilización e Integración del diseño para esta tarea — reutilízalas o extiéndelas antes de escribir nada nuevo:",
    reuseOmitted: (n) => `${n} elemento(s) más coinciden — léelos en design.md (Reutilización e Integración).`,
    reuseNoMatch: (n) => `La sección Reutilización e Integración del diseño enumera ${n} elemento(s), ninguno con los ficheros ni los criterios de esta tarea — léela antes de crear nada nuevo.`,
    reuseFiles: "Ficheros de código existentes junto a los de esta tarea — mira aquí primero:",
    reuseFilesMore: (n, atLeast) => (!atLeast ? `…y ${n} más en la(s) misma(s) carpeta(s).`
      : n ? `…y al menos ${n} más en la(s) misma(s) carpeta(s) — una carpeta grande: solo se leyeron sus primeras entradas.`
        : "…y posiblemente más en la(s) misma(s) carpeta(s) — una carpeta grande: solo se leyeron sus primeras entradas."),
    design: "## Contexto de diseño",
    designToc: (p) => `Diseño completo: \`${p}\` — secciones:`,
    designOmitted: "Relevantes pero no incluidas (tamaño) — léelas en design.md:",
    steering: "## Restricciones globales",
    constraintsIntro: "Vinculantes para toda tarea (tasks.md → Restricciones Globales):",
    verification: "## Verificación (_Verify:_)",
    verifyRule: "Ejecuta cada comando _Verify:_ de arriba sobre el código final y pon en el informe el comando exacto, su exit code y las últimas líneas de la salida — el controlador los registra con spec_complete_task como evidencia de la tarea.",
    steeringRead: "Lee antes de programar:",
    unresolved: "## ⚠ Referencias sin resolver",
    unresolvedNote: "La tarea cita estos IDs pero la spec no los define. Responde NEEDS_CONTEXT en vez de adivinar.",
    dod: "## Definición de hecho",
    loopRules: {
      core: [
        "Implementa exactamente lo que exigen la tarea y sus criterios de aceptación — nada más (YAGNI).",
        "Ejecuta la suite de pruebas existente: todo lo que estaba en verde sigue en verde.",
        "Haz commit con un mensaje convencional que cite la tarea (p. ej. `feat(ámbito): … — tarea #N`).",
        "Nunca modifiques una prueba existente para que pase. Si una prueba parece incorrecta, para y responde BLOCKED.",
      ],
      tdd: [
        "Primero ROJO: ejecuta las pruebas objetivo y confirma que fallan por la razón correcta (aserción / no implementado — no una errata ni un import que falta). Pon el comando y la salida en el informe.",
        "Escribe el código mínimo que pone las pruebas objetivo en verde.",
        "Ejecuta la suite COMPLETA: objetivos en verde, las que estaban en verde siguen en verde, las de tareas futuras siguen en rojo.",
        "Refactoriza solo en verde. Nunca cambies la expectativa de una prueba planificada — si parece incorrecta, para y responde BLOCKED.",
        "Haz commit citando la tarea y las pruebas que pone en verde (`Makes T-01, T-02 green`).",
      ],
      "ai-prompt": [
        "Registra la baseline de las evals antes de cambiar nada.",
        "Edita el prompt en un fichero versionado NUEVO (`prompts/vN.md`), nunca en el mismo.",
        "Ejecuta el harness de evals completo; acepta solo si golden mejoró o se mantuvo y adversarial se mantuvo — si no, revierte.",
        "Haz commit con el delta de evals (`Eval delta: golden 82% → 87%`).",
      ],
    },
    metricsRule: "Cada métrica listada arriba se emite de verdad — muestra la evidencia en el informe.",
    redRules: [
      "Esta es una tarea ROJA: escribe (o conserva) las pruebas planificadas exactamente como las describe el plan de pruebas — nada de código de producción ni de arreglo en esta tarea.",
      "Ejecútalas: deben FALLAR por la razón correcta — una aserción o \"no implementado\". Un fichero de prueba, módulo o script que falta, una errata o un comando que no se ejecuta no es una prueba en rojo (se rechaza como tal).",
      "Las pruebas que pasaban antes siguen en verde: solo pueden fallar las pruebas nuevas de esta tarea. Nunca modifiques una prueba existente.",
      "Haz commit de la prueba que falla citando la tarea y sus T-IDs (`test(ámbito): T-01 red — tarea #N`).",
    ],
    evalsRule: "Este cambio toca una ruta de IA: ejecuta el harness de evals al final — golden se mantiene o mejora, adversarial se mantiene — y pon las puntuaciones en el informe.",
    checkpoint: "Cuando la última tarea de esta historia esté hecha, el controlador se detiene para revisión humana en el checkpoint:",
    report: "## Informe",
    reportTo: (p) => `Escribe el informe completo en \`${p}\` y responde solo con la línea de estado (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), tus commits, un resumen de una línea de las pruebas, cualquier duda y la ruta del informe escrita completa (\`${p}\`) — por ella el gate de evidencia y el controlador encuentran tu informe.`,
    ledgerHeader: (feature) => `# Ledger de ejecución — función: ${feature}\n\n<!-- Una línea por evento, añadida por el controlador (nunca reescrita):\n     Preflight: … · Ruling: <qué> — <por qué> — <coste si es erróneo> · Task N: dispatched (base <sha>, model <m>)\n     Task N: fix round R/5 (…) · Task N: minor (deferred): … · Task N: parked — … · Task N: complete (commits a..b, review clean)\n     Checkpoint USn: presented → approved -->\n`,
    allDone: "Todas las tareas están hechas — no hay nada para el brief.",
    alreadyDone: (n) => `La tarea ${n} ya está marcada como hecha.`,
  };

module.exports = { build, steering, evalsReadme, msg, quality, designWeigh, brief, __link };
