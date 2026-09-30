<!-- Os critérios de uma feature +mobile em português (vencem os da raiz para as features em pt e pt-BR). -->
- QUANDO o dispositivo estiver offline O SISTEMA DEVE manter [as ações principais] disponíveis e pôr as alterações do utilizador em fila para sincronizar
- QUANDO o dispositivo voltar a ligar-se O SISTEMA DEVE sincronizar as alterações em fila e resolver um conflito segundo [a regra de conflito] sem perder os dados do utilizador
- SE a versão instalada da app for anterior a [a versão mínima suportada] ENTÃO O SISTEMA DEVE bloquear a funcionalidade e pedir ao utilizador que atualize
- SE o utilizador recusar ou revogar [uma permissão] ENTÃO O SISTEMA DEVE explicar o que fica indisponível e manter o resto da funcionalidade a funcionar
- QUANDO [o evento] acontecer O SISTEMA DEVE enviar uma notificação push que abre [o ecrã de destino] e não mostra dados pessoais no ecrã de bloqueio
