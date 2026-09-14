# hemocione-coleta

Agendamento de coletas de sangue entre instituições e hemocentros. Nuxt 3 (SPA),
MongoDB via Mongoose, autenticação via Hemocione ID (SSO).

## Comandos

- `yarn dev` — servidor local (porta 3000)
- `yarn build` — build de produção
- `yarn test` — suíte unitária/integração
- `yarn playwright test` — E2E

## Dogfood / QA de regressão

Antes de validar uma leva de features em produção ou local, use a skill
`coleta-dogfood-qa`. Ela aponta pro checklist vivo de regressão
(`docs/qa/REGRESSION_CHECKLIST.md`) e pro histórico de rodadas (`docs/qa/rounds/`).
