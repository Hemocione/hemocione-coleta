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

## Trabalho despachado em paralelo e resultado coletado antes da interrupção

Três tarefas foram disparadas como subagentes do Claude Code e retomadas com Codex.
Os resultados disponíveis estão registrados no `report.md` e nos arquivos de evidência.

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

## Resultado real antes da interrupção

- A visita técnica sequencial funcionou após uma recusa e uma nova proposta.
- A concorrência de slot retornou HTTP 409 para a segunda aceitação e manteve a
  solicitação como `pending`.
- As rotas públicas cross-institution bloquearam os probes indevidos.
- A rota de retirada do painel institucional permitiu que Alpha cancelasse uma
  solicitação pendente de Beta. Esse achado é crítico e encerrou a exploração.
- A matriz completa de agendamento e o QA administrativo ficaram incompletos.

## O que falta fazer depois da interrupção

1. Corrigir ou mitigar o achado crítico antes de qualquer nova mutação em produção.
2. Perguntar ao Guima, achado por achado: corrige agora (branch nova a partir de
   `main`, TDD, PR) ou só registra pra depois — não decidir sozinho.
3. Commit + push da pasta `docs/qa/rounds/2026-08-27-prod-hemodemo/` inteira (report.md
   + HANDOFF.md + screenshots) e do checklist atualizado.
4. Publicar um Claude Artifact com o relatório final (pedido explícito do Guima —
   ainda não feito).
5. Fora do escopo desta rodada por decisão do Guima: WhatsApp (disparo e recebimento) —
   não testar, já documentado no checklist.
