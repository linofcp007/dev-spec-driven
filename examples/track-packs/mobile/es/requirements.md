<!-- Los criterios de una función +mobile en español (ganan a los de la raíz para las funciones en es). -->
- CUANDO el dispositivo esté sin conexión EL SISTEMA DEBE mantener [las acciones principales] disponibles y encolar los cambios del usuario para sincronizarlos
- CUANDO el dispositivo vuelva a conectarse EL SISTEMA DEBE sincronizar los cambios encolados y resolver un conflicto según [la regla de conflicto] sin perder los datos del usuario
- SI la versión instalada de la app es anterior a [la versión mínima soportada] ENTONCES EL SISTEMA DEBE bloquear la función y pedir al usuario que actualice
- SI el usuario deniega o revoca [un permiso] ENTONCES EL SISTEMA DEBE explicar qué queda no disponible y mantener el resto de la función operativo
- CUANDO ocurra [el evento] EL SISTEMA DEBE enviar una notificación push que abra [la pantalla de destino] y no muestre datos personales en la pantalla de bloqueo
