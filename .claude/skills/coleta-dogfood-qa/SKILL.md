---
name: coleta-dogfood-qa
description: Use when starting a dogfood or regression QA round on hemocione-coleta — production or local — before shipping a batch of changes, or when asked to validate recent hemocione-coleta features end-to-end.
---

# Coleta Dogfood QA

## Overview

A dogfood round exercises both roles of hemocione-coleta — the public institution
flow (`/agendar`) and the authenticated blood-bank admin area — against a real
running environment, using disposable test fixtures instead of real institution or
blood-bank data.

## When to use

- Before or after merging a batch of features to `main`, to validate them together.
- When asked to "test in production", "rodar QA", or validate recent changes end-to-end.
- Not for a single bug repro — just reproduce and fix it directly.

## Test fixtures — never touch real institution/bank data

- **Blood bank (hemocentro):** `hemodemo` is the standing fictitious bank in
  production. For any test that needs a *second* tenant (cross-tenant/IDOR checks,
  concurrency), create one via the `criar_banco_de_sangue` tool if one isn't already
  labeled for QA — never target a real bank.
- **Institutions:** create on demand via real signup, prefixed `QA-TESTE`.
- No delete path exists for either today — fixtures stay in production, clearly
  labeled. List every fixture created in the round's report so it stays traceable.

## Phase sequence

| # | Phase | Notes |
|---|---|---|
| 0 | Pré-voo | Confirm the deploy matches the `main` HEAD you're validating. If it doesn't, stop and say so — don't test a stale build. Run lint/build/unit/Playwright locally first — cheap gate before touching prod. |
| 1 | Setup de atores | Create every synthetic institution and second bank the round needs, up front. Everything below reuses these. |
| 2 | Fronteira de confiança | Cross-tenant probe (read **and** write endpoints — `counter-propose`, technical-visit actions, track-token responses) between fixtures you control. Read-only against a real third party's data doesn't cover the bug class that actually hit this repo. Stop and report immediately if anything looks exploitable — never keep probing. |
| 3 | Fluxo público sem autenticação | Geolocation search, restrictions, a11y (axe-core), console, mobile viewport, `/termo/:token` (valid + invalid). |
| 4 | Agendamento — eixo transversal | The core loop, run across the fixtures from phase 1, not isolated to one institution. See `docs/qa/REGRESSION_CHECKLIST.md` for the full status/transition matrix. |
| 5 | Admin do hemocentro | Calendário, equipes, cobertura, restrições — the surfaces not already exercised in phase 4. |
| 6 | Fechamento | Check Bugsnag for new errors in the test window. Write the report. |

## Reporting

- One folder per round: `docs/qa/rounds/<YYYY-MM-DD>-<label>/report.md`, plus
  `screenshots/` and `videos/` alongside it. Never overwrite a prior round's folder.
- Issue format matches existing rounds (see any `docs/qa/rounds/*/report.md`): a card
  per bug — severity, category, URL, repro steps with one screenshot per step,
  status.
- Found a regression-worthy area the checklist doesn't cover yet? Add it to
  `docs/qa/REGRESSION_CHECKLIST.md` in the same pass — that file is the point of
  doing this at all.
