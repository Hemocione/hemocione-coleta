# Handoff — rodada de QA em produção (hemocione-coleta), 2026-08-27

Este arquivo existe pra continuar o trabalho em outra sessão/ferramenta (ex.: Codex) se
esta sessão do Claude Code cortar por uso. Sem segredos aqui — **este repo é público no
GitHub** (`Hemocione/hemocione-coleta`, `githubRepoVisibility: public`).

## Onde as coisas estão

- Repo: `/home/guima/Projects/Hemocione/.worktrees/prod-dogfood-fixes` (worktree, branch
  `chore/coleta-dogfood-qa-infra`, a partir de `main`).
- Branch já commitada e **pushada** (`aaa42cb`): `AGENTS.md`, `.claude/skills/coleta-dogfood-qa/SKILL.md`,
  `docs/qa/REGRESSION_CHECKLIST.md`.
- Esta rodada: `docs/qa/rounds/2026-08-27-prod-hemodemo/report.md` (parcialmente
  preenchido — ver abaixo) + este arquivo. **Ainda não commitados** (faça isso ao
  continuar).
- Prod confirmada == `main` HEAD `7f0d516` via Vercel API (projeto
  `hemocione-coleta`, team `hemocione`, domínio `coleta.hemocione.com.br`).

## Credenciais (não estão neste arquivo por segurança — repo público)

- Hemocentro `hemodemo`: login e senha só na conversa original com o Guima — peça a ele.
- 3 instituições `QA-TESTE` (Alpha/Beta/Gama): emails e ids estão em
  `docs/qa/rounds/2026-08-27-prod-hemodemo/report.md` (seção "Fixtures criados nesta
  rodada"); a senha compartilhada delas foi dada só na conversa — peça ao Guima ou,
  se ele não tiver, recrie via signup real (perde histórico de qualquer solicitação já
  criada com as antigas).

## O que já está confirmado e escrito no report.md

- **ISSUE-A** (high): Bugsnag nunca recebe nada em produção real —
  `enabledReleaseStages: ["prod","dev"]` em `nuxt.config.ts` não bate com
  `VERCEL_ENV === "production"`. Fix de 1 linha, não aplicado ainda.
- **ISSUE-B** (low): `/agendar/nao-existe` mostra prompt de login genérico, não 404 —
  decisão de produto pendente, não necessariamente bug.
- **ISSUE-C** (low): `isFormValid` em `layouts/agendamento.vue` habilita "Salvar" no
  cadastro de instituição sem Nome/Endereço/Cidade/Estado preenchidos.
- Fluxo público (a11y, mobile, termo, acompanhar-inválido) — tudo verificado sem
  regressão.
- Onboarding de instituição (CNPJ bloqueia salvar, sessão sobrevive a reload, "Meus
  Agendamentos" vazio sem erro) — tudo verificado sem regressão, além do ISSUE-C acima.
- **Segundo hemocentro sintético logável: bloqueado, confirmado por leitura de código**
  do `hemocione-id` — não existe rota (backoffice/MCP/job/self-service) que crie um
  `userBloodBankRole` pra um banco novo. Só existe o equivalente pra instituição
  (`POST /institutions` → `userInstitutionRole`). Sem isso, o probe de fronteira de
  confiança banco↔banco não roda; o probe instituição↔instituição roda normalmente
  com 2+ das instituições `QA-TESTE` contra o mesmo hemodemo.

## Trabalho despachado em paralelo, resultado ainda não coletado nesta sessão

Três tarefas foram disparadas como subagentes do Claude Code (Agent tool) e podem ou
não ter voltado antes do corte de sessão. Se o resultado delas não estiver em
`report.md` ainda quando você retomar, redespache o mesmo escopo (via subagente, Codex,
ou você mesmo, com browser real contra produção):

1. **Agendamento — matriz de status principal** (contra hemodemo, usando as 3
   instituições, datas 10-16 dias a partir de 2026-08-27): pending→accepted (slot
   trava), pending→rejected, **accepted→rejected e conferir se o slot destrava depois**
   (suspeita de bug real — slot fantasma preso), counter-propose→accept/decline, 409 em
   duplicata (e confirmar que não dispara fora do escopo certo), cancel institucional em
   pending/accepted, **as 3 rotas de `withdraw`** (painel, pública, pública-por-token),
   link de digital-event nos 2 estados que permitem, prioridade de instituição na
   listagem.
2. **Visita técnica + concorrência + IDOR entre instituições** (datas 17-23 dias):
   proposta sequencial de visita técnica com pelo menos 2 rodadas (recusa → nova
   proposta, confirmar que não trava), fuso horário America/Sao_Paulo, motivo interno
   oculto do histórico da instituição; concorrência de 2 instituições pro mesmo slot;
   **e o teste de segurança mais importante da rodada**: usar o token de acompanhamento
   de uma instituição pra tentar `respond-counter-proposal`/`respond-technical-visit-proposal`/
   `withdraw` numa solicitação de OUTRA instituição (mesmo hemodemo) — `respondToCounterProposal`
   e `respondToTechnicalVisitProposal` não filtram por institutionId no service, só o
   binding do token na rota. Se aceitar quando deveria recusar, é achado CRÍTICO — pare e
   reporte, não explore mais.
3. **Admin do hemocentro restante** (datas 24-30 dias): calendário (config em massa
   sobrevive a reload, PATCH de status bloqueada/pendente/liberada, inclusive numa data
   com solicitação vinculada), equipes, cobertura (mapa), restrições.

## O que falta fazer depois de coletar os 3 resultados acima

1. Preencher a seção "Summary" (contagem por severidade) e a seção "Fronteira de
   confiança" do `report.md` com os resultados reais.
2. Atualizar `docs/qa/REGRESSION_CHECKLIST.md` se alguma área nova foi descoberta.
3. Perguntar ao Guima, achado por achado: corrige agora (branch nova a partir de
   `main`, TDD, PR) ou só registra pra depois — não decidir sozinho.
4. Commit + push da pasta `docs/qa/rounds/2026-08-27-prod-hemodemo/` inteira (report.md
   + HANDOFF.md + screenshots) e do checklist atualizado.
5. Publicar um Claude Artifact com o relatório final (pedido explícito do Guima —
   ainda não feito).
6. Fora do escopo desta rodada por decisão do Guima: WhatsApp (disparo e recebimento) —
   não testar, já documentado no checklist.
