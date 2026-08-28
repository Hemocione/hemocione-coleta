# Handoff — rodada de QA em produção (hemocione-coleta), 2026-08-27

Este arquivo existe pra continuar o trabalho em outra sessão/ferramenta (ex.: Codex) se
esta sessão do Claude Code cortar por uso. Sem segredos aqui — **este repo é público no
GitHub** (`Hemocione/hemocione-coleta`, `githubRepoVisibility: public`).

## Onde as coisas estão

- Repo: `/home/guima/Projects/Hemocione/.worktrees/prod-dogfood-fixes` (worktree, branch
  `chore/coleta-dogfood-qa-infra`, a partir de `main`).
- Branch já commitada e **pushada** (`47c4e76`): relatório, handoff e evidência do
  reteste do ISSUE-D.
- Esta rodada: `docs/qa/rounds/2026-08-27-prod-hemodemo/report.md` + este arquivo.
- Prod inicial confirmada == `main` HEAD `7f0d516` via Vercel API (projeto
  `hemocione-coleta`, team `hemocione`, domínio `coleta.hemocione.com.br`).
- O fix do ISSUE-D foi mergeado no PR #45. O fix do ISSUE-E foi mergeado no PR #47.
- O deploy atual usa `main` HEAD `dad09cf`.

## Credenciais (não estão neste arquivo por segurança — repo público)

- Hemocentro `hemodemo`: login e senha só na conversa original com o Guima — peça a ele.
- 3 instituições `QA-TESTE` (Alpha/Beta/Gama): emails e ids estão em
  `docs/qa/rounds/2026-08-27-prod-hemodemo/report.md` (seção "Fixtures criados nesta
  rodada"); a senha compartilhada delas foi dada só na conversa — peça ao Guima ou,
  se ele não tiver, recrie via signup real (perde histórico de qualquer solicitação já
  criada com as antigas).

## O que já está confirmado e escrito no report.md

- **ISSUE-A** (high): Bugsnag nunca recebia nada em produção real. Corrigido e
  verificado em produção.
- **ISSUE-B** (low): `/agendar/nao-existe` mostra prompt de login genérico, não 404 —
  decisão de produto pendente, não necessariamente bug.
- **ISSUE-C** (low): `isFormValid` em `layouts/agendamento.vue` habilita "Salvar" no
  cadastro de instituição sem Nome/Endereço/Cidade/Estado preenchidos.
- **ISSUE-D** (critical): corrigido no PR #45. A validação de associação atual ocorre
  antes da consulta e da alteração da solicitação.
- **ISSUE-E** (high): corrigido no PR #47. A aceitação de uma solicitação passou em
  produção após a normalização de UUIDs BSON.
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
O primeiro agente expôs um token de sessão durante diagnóstico de rede. O valor não foi
persistido. Os demais agentes foram encerrados. Nenhum resultado parcial foi aceito como
veredito.

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
- O teste histórico confirmou que a rota de retirada permitia que Alpha cancelasse uma
  solicitação pendente de Beta. Após o fix, Alpha recebeu HTTP 403 e a solicitação
  permaneceu `pending`. Beta retirou a própria solicitação com HTTP 200.
- A matriz completa de agendamento ficou incompleta. O QA administrativo somente leitura
  passou; os cenários administrativos de escrita ficaram incompletos.
- Os fluxos `pending` para aceitação e rejeição passaram no deploy `dad09cf`.
- `accepted → rejected` ficou bloqueado: a UI aceita só exibiu `Cancelar Coleta` e
  `Gerar Termo de Compromisso`.
- Uma nova conta e uma nova instituição sintéticas foram criadas. A interface não
  encontrou banco próximo, então os fluxos da instituição não avançaram.

## Incidente de segurança

Uma ferramenta exibiu um token de sessão em uma URL de redirecionamento durante o QA
paralelo. A sessão foi fechada. O valor não foi salvo nos artefatos.

O dono da conta confirmou a rotação antes da retomada. O novo reteste não usou
diagnóstico de rede. A sessão nova foi fechada após o teste.

O reteste administrativo somente leitura passou no deploy `dad09cf`. Calendário,
Equipes de Coleta, Área de Cobertura e Restrições carregaram sem erros.

## O que falta fazer depois da interrupção

1. Concluir a matriz de agendamento, visita técnica e os cenários administrativos de
   escrita com dados sintéticos separados.
2. Manter diagnóstico de rede fora do QA de produção até existir redaction comprovado.
3. Fora do escopo desta rodada por decisão do Guima: WhatsApp (disparo e recebimento) —
   não testar, já documentado no checklist.
