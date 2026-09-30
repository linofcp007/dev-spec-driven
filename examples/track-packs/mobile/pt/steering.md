# Padrões Móveis

## Plataformas
- Versões mínimas: iOS [16] · Android [API 26] · a framework: [nativa | React Native | Flutter] · os dispositivos em que testamos: [lista].

## Lançamentos
- Tempo de revisão das lojas: [N dias] · lançamento faseado: [1% → 10% → 50% → 100%] com critérios para o parar (sessões sem falhas abaixo de [99,5%]).
- Atualização obrigatória quando: [uma alteração incompatível da API] · a versão mais antiga da app que a API ainda serve: [versão].

## Offline e Sincronização
- O que tem de funcionar offline: [lista] · regra de conflito: [a última escrita ganha | fusão | perguntar ao utilizador] · a fila sobrevive a um reinício da app.

## Permissões
- Pedidas no contexto, nunca no arranque · primeiro um ecrã com a justificação · cada funcionalidade tem um caminho para uma permissão recusada.

## Desempenho e Bateria
- Arranque a frio ≤ [2 s] num [dispositivo de gama baixa] · tamanho da app ≤ [N MB] · trabalho em segundo plano no máximo a cada [N minutos].

## Notificações Push
- Sem dados pessoais no ecrã de bloqueio · cada notificação abre uma ligação profunda · no máximo [N] por utilizador por dia · uma opção de saída por categoria.
