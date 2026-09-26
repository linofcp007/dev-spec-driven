---
name: Bugfix — causa raiz e teste de regressão antes da correção (PT)
description: A defect report in Portuguese — the agent must take the bugfix flow (spec_create kind bugfix, in PT), write the root cause, and stop at the design (bug.md) gate — the product code stays untouched in this run; a fix may never precede bug.md or a regression test.
tags:
  - behavior
  - bugfix
  - pt
runs: 2
max_turns: 18
timeout_seconds: 480
allowed_tools: [Read, Glob, Grep, Skill, TodoWrite, Write, Edit]
---
Bug no carrinho: se o cliente aplicar o mesmo cupão duas vezes, o desconto é aplicado duas vezes — um carrinho de 100 € com o cupão PROMO10 fica a 81 € em vez de 90 €. Corrige isto.
