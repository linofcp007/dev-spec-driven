#!/usr/bin/env bash
# limite-peticiones (ES, core +saas): classification and requirements filled and approved; design.md is still
# the scaffold — the mandatory [SaaS] sections carry their `> **TODO**` sentinel, so the design gate refuses.
. "$(dirname "${BASH_SOURCE[0]}")/../fixtures/lib.sh"
ds init core saas --lang es
copy_fixture specs-es/steering .specs/steering
ds create "limite-peticiones" core saas --lang es --summary "Limitar las peticiones a la API por inquilino, según su plan."
copy_fixture specs-es/limite-peticiones .specs/limite-peticiones
for phase in classification requirements; do ds approve limite-peticiones "$phase" --by "Lucía"; done
git_init_main "docs(limite-peticiones): requisitos aprobados"
