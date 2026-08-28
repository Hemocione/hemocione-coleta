# Dogfood Report: Hemocione Coleta — Produção (hemodemo)

| Field | Value |
|-------|-------|
| **Date** | 2026-08-27 |
| **App URL** | https://coleta.hemocione.com.br |
| **Deploy inicial validado** | `7f0d516` (main, confirmado como deploy de produção via Vercel API) |
| **Deploy dos fixes** | `de00511` (PR #45) e `dad09cf` (PR #47), mergeados em `main` e validados em produção |
| **Fixtures** | hemocentro `hemodemo`; demais fixtures listados na seção Fixtures abaixo |
| **Scope** | Regressão completa — fluxo público, onboarding de instituição, agendamento (eixo transversal), visita técnica, admin do hemocentro, fronteira de confiança |

## Summary

| Severity | Count |
|---|---:|
| Critical | 1 |
| High | 2 |
| Medium | 0 |
| Low | 2 |
| **Total** | **5** |

A rodada foi retomada após a correção do ISSUE-D. O reteste de autorização passou em
produção. O fluxo `pending` para aceitação passou após o PR #47. A matriz restante de
agendamento continua incompleta. O QA administrativo somente leitura passou; cenários
administrativos de escrita continuam incompletos.

## Fixtures criados nesta rodada

| Instituição | id | Login |
|---|---|---|
| QA-TESTE Alpha | `91b30035-61f4-462f-9f08-ebbb6331de77` | qa-teste-alpha@hemocione-qa.test |
| QA-TESTE Beta | `bb061558-6a72-44b1-96e4-e2293be96633` | qa-teste-beta@hemocione-qa.test |
| QA-TESTE Gama | `534b879e-7cc0-4121-9702-a97b9ecfecf5` | qa-teste-gama@hemocione-qa.test |

Senhas não ficam registradas neste arquivo (ver `DEV_GUIDELINES.md` global sobre não
gravar segredo em doc durável) — peça ao dono da rodada se precisar reusar as contas.

**Segundo hemocentro sintético: não foi possível criar.** Investigado a fundo (ver
"Fronteira de confiança" abaixo) — não existe hoje nenhuma rota de API/MCP/job que
vincule um usuário logável a um `bloodBanksLocation` recém-criado no `hemocione-id`.
Só `userInstitutionRole` tem um caminho self-service
(`POST /institutions`); não existe equivalente `userBloodBankRole`. Criar um banco via
`id__criar_banco_de_sangue`/`coleta__cadastrar_hemocentro` gera só o registro de
localização, sem dono. Ficou registrado como gap de ferramentas de backoffice, não como
bug do coleta.

## Issues

### ISSUE-A: Bugsnag nunca recebe sessão/erro em produção real

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | monitoring |
| **URL** | todas as rotas |
| **Status** | fixed and verified in production |

**Descrição**

Toda navegação em produção mostra no console: `[bugsnag] Session not sent due to
releaseStage/enabledReleaseStages configuration`.

**Causa raiz**

`nuxt.config.ts` define `enabledReleaseStages: ["prod", "dev"]` (linha ~79), mas
`releaseStage` vem de `currentEnv = process.env.VERCEL_ENV || "dev"` (linha ~4). Na
Vercel, `VERCEL_ENV` em produção vale `"production"`, não `"prod"` — o próprio repo já
espera esse valor real em `utils/publicUrl.ts:29`
(`if (process.env.VERCEL_ENV === "production")`). Como `"production"` não está na
lista `enabledReleaseStages`, o Bugsnag descarta toda sessão/erro em produção,
silenciosamente, provavelmente desde sempre.

**Impacto**

O item de fechamento "Bugsnag sem erro novo" de qualquer dogfood anterior estava
sempre verde por default — não porque não havia erro, mas porque o Bugsnag nunca
recebeu nada. Isso inclui todas as rodadas anteriores documentadas em
`dogfood-output/report.md` e `docs/qa/qa-round-2-report.html`.

**Repro**

Abrir qualquer rota de `coleta.hemocione.com.br` com DevTools aberto; ver o warning.

**Fix sugerido**

Trocar `enabledReleaseStages: ["prod", "dev"]` por
`["production", "preview", "development"]` (valores reais de `VERCEL_ENV`), ou mapear
`currentEnv` pros nomes curtos antes de passar pro Bugsnag. Arquivo:
`nuxt.config.ts`.

---

### ISSUE-B: `/agendar/nao-existe` mostra prompt de login genérico, não 404

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | functional |
| **URL** | `https://coleta.hemocione.com.br/agendar/nao-existe` |
| **Status** | found, decisão de produto pendente |

**Descrição**

`pages/agendar/[bloodbankSlug]/index.vue` captura qualquer segmento após `/agendar/`
como `bloodbankSlug` sem validar existência antes de checar `isLoggedIn`. Um slug
inexistente e um slug real sem sessão são indistinguíveis pro visitante anônimo — os
dois mostram "Você precisa estar logado para agendar coletas." A existência do banco só
é checada depois do login, via `useFetchWithAuth`.

**Não é crash nem tela em branco.** Se o produto realmente quer um 404 dedicado aqui, é
gap de produto; senão, é comportamento aceitável e o item do checklist deveria mudar.

---

### ISSUE-C: Formulário de cadastro de instituição habilita "Salvar" sem campos obrigatórios preenchidos

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | functional |
| **URL** | `https://coleta.hemocione.com.br/agendar` (modal de registro de instituição) |
| **Status** | found, not fixed |

**Descrição**

`isFormValid` em `layouts/agendamento.vue` só exige que algum campo esteja preenchido
(`isFormDirty`) + CNPJ com checksum válido + um `kind` selecionado — não exige
Nome/Endereço/Cidade/Estado. Como Telefone já vem pré-preenchido do perfil do usuário
logado, dá pra habilitar "Salvar" com um CNPJ válido (mas não cadastrado) e Nome/
Endereço/Cidade/Estado em branco.

**Repro:** logar, abrir "Registrar Instituição", preencher só CNPJ válido, deixar o
resto em branco — botão habilita.

**Fix sugerido:** `isFormValid` deveria exigir os campos obrigatórios reais (Nome,
Endereço, Cidade, Estado), não só "algum campo foi tocado".

**Reprodução adicional em 2026-08-28**

Uma conta institucional sintética nova reproduziu o comportamento. Após um CNPJ válido
e um tipo selecionado, `Salvar` ficou habilitado com os campos obrigatórios vazios. O
botão não foi acionado. A sessão foi fechada sem mutação.

---

### ISSUE-D: Rota institucional de retirada permite IDOR entre instituições

| Field | Value |
|-------|-------|
| **Severity** | critical |
| **Category** | security / authorization |
| **URL** | `POST /api/v1/institutions/{institutionId}/collection-requests/{requestId}/withdraw` |
| **Status** | fixed and verified in production |

**Descrição**

Antes do fix, uma instituição autenticada conseguia retirar uma solicitação pertencente
a outra instituição. O teste usou somente dados sintéticos de duas instituições.

**Reprodução**

1. Crie uma solicitação pendente como a instituição vítima.
2. Autentique como a instituição atacante.
3. Envie `POST` para a rota usando o `institutionId` e o `requestId` da vítima.
4. **Observe no teste histórico:** a resposta retornava HTTP 200 e o status mudava para
   `cancelled`.
5. **Observe no teste histórico:** o motivo enviado pelo atacante aparecia no histórico
   da vítima.

**Evidência**

O JWT da instituição atacante não tinha papel na instituição vítima. Mesmo assim, a
solicitação da vítima foi cancelada no teste histórico. O resultado está em
`agendamento/screenshots/idor-critical-institution-withdraw-request-response.txt`.

**Causa provável**

A rota confiava no `institutionId` da URL e não verificava a associação atual da
identidade autenticada com essa instituição.

**Ação imediata**

O fix valida a associação atual antes de consultar ou alterar a solicitação. A rota
retorna 403 sem alterar a solicitação quando a identidade não tem acesso à URL.

### Reteste pós-fix em produção

O deploy `de00511` foi validado em `coleta.hemocione.com.br` com browser real e dados
sintéticos.

- Alpha tentou retirar uma solicitação de Beta e recebeu HTTP 403.
- A solicitação de Beta permaneceu `pending` após a tentativa não autorizada.
- Beta retirou a própria solicitação e recebeu HTTP 200.
- A solicitação autorizada passou para `cancelled` e o histórico recebeu o evento.
- A evidência sanitizada está em
  `agendamento/screenshots/idor-post-fix-production-evidence.txt`.

### ISSUE-E: Aceitação de solicitação retorna HTTP 500 após confirmar o horário

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | functional / data serialization |
| **URL** | painel do hemocentro, detalhes de solicitação pendente |
| **Status** | fixed and verified in production |

**Descrição**

Ao aceitar uma solicitação pendente, a confirmação retornava HTTP 500. O botão ficava
carregando e a lista continuava mostrando a solicitação como `pending`.

**Causa raiz**

O serviço enviava um UUID BSON serializado como bytes para a consulta externa de
instituições. A consulta falhava depois da atualização da solicitação. A interface
ficava desatualizada após o erro.

**Fix**

O PR #47 normaliza UUIDs BSON e textuais antes da consulta externa. O fix inclui um
teste unitário para o valor BSON e passou na suíte unitária e no build.

**Reteste pós-fix em produção**

O deploy `dad09cf` foi validado em `coleta.hemocione.com.br` com browser real e dados
sintéticos.

- A solicitação pendente abriu com a opção de horário selecionada.
- A confirmação exibiu `Solicitação aceita!` e `A solicitação foi aceita com sucesso.`
- A página de detalhes passou a mostrar `Cancelar Coleta`.
- A lista `Pendentes` não mostrou mais a solicitação.
- `agent-browser errors` não retornou erros.
- A evidência sanitizada está em
  `agendamento/screenshots/acceptance-post-fix-production-evidence.txt`.

## Reteste administrativo seguro em produção

O deploy `dad09cf` foi validado em `coleta.hemocione.com.br` com browser real e dados
sintéticos. O reteste usou somente navegação visível e não executou escritas.

- `Calendário`: passou.
- `Equipes de Coleta`: passou.
- `Área de Cobertura`: passou.
- `Restrições`: passou.
- As 4 telas carregaram sem erro do navegador ou do console.
- A evidência sanitizada está em
  `admin/screenshots/admin-read-only-production-evidence.txt`.

## Cenário adicional pós-deploy

O fluxo `pending` para rejeição passou no deploy `dad09cf` com browser real e uma
solicitação sintética `QA-TESTE`.

- O diálogo exigiu um motivo antes de habilitar a confirmação.
- A confirmação exibiu `Solicitação rejeitada!` e `A solicitação foi rejeitada com sucesso.`
- A página de detalhes passou a mostrar o motivo da rejeição.
- A aba `Rejeitadas` carregou sem erros do navegador.
- A evidência sanitizada está em
  `agendamento/screenshots/rejection-post-fix-production-evidence.txt`.

## Onboarding institucional adicional

Uma conta e uma instituição sintéticas novas foram criadas pela interface. O cadastro
passou e a instituição ficou validada. A página não encontrou banco de sangue próximo,
mesmo após o endereço sintético ser ajustado para o Rio de Janeiro.

- Nenhum pedido de coleta foi criado nesta etapa.
- Nenhuma mensagem foi enviada.
- A sessão foi fechada sem erro do navegador.
- O fluxo institucional restante exige um banco disponível para a instituição.
- A evidência sanitizada está em
  `instituicao/screenshots/onboarding-production-evidence.txt`.

## QA paralelo pós-fix interrompido

A matriz de agendamento iniciou em browser real, mas a ferramenta exibiu um token de
sessão em uma URL de redirecionamento durante o diagnóstico de rede.

- O valor não foi salvo no relatório nem nas evidências.
- A sessão foi fechada imediatamente.
- Nenhuma mensagem real foi enviada.
- Nenhum dado foi excluído.
- A matriz de agendamento não recebeu um veredito.
- O QA de visita técnica foi encerrado por segurança.

O dono da conta confirmou a rotação após o incidente. A sessão usada no novo reteste
foi fechada. O diagnóstico de rede não foi usado. O QA restante continua incompleto.

---

## Verificado sem problema (fluxo público)

- `/agendar/acompanhar/<token-inválido>`: "Solicitação não encontrada", sem crash.
- `/termo/<token-inválido>`: abre sem sessão, sem redirecionar pro login — ISSUE-005
  do round anterior não regrediu.
- Menu mobile (390×844): abre/fecha corretamente, `aria-label` presente.
- Modal "Registrar Instituição": `aria-labelledby` aponta pro título real — ISSUE-002
  não regrediu.
- axe-core em `/agendar` desktop: 0 violations, 0 incomplete; `<html lang="pt-BR">`
  presente, 1 `<h1>` — ISSUE-003 não regrediu.
- axe-core no modal (mobile + desktop): 0 violations.
- Console limpo de exceções JS.

## Resultados adicionais da rodada interrompida

- Visita técnica sequencial: recusa seguida por nova proposta funcionou. A segunda
  proposta foi aceita. O fuso America/Sao_Paulo converteu para UTC corretamente. O
  motivo interno não apareceu no histórico público.
- Concorrência de slot: duas instituições criaram solicitações pendentes para o mesmo
  slot. A primeira aceitação travou o slot. A segunda aceitação retornou HTTP 409 e
  permaneceu `pending`.
- Probes públicos cross-institution: as rotas públicas de resposta e as rotas públicas
  de retirada bloquearam o acesso indevido com HTTP 403 ou HTTP 404.
- O teste parou imediatamente após o ISSUE-D. O fluxo de aceitação foi retestado depois
  do PR #47, com dados sintéticos e sem novos erros.
- O fluxo de rejeição foi retestado depois do PR #47, com dados sintéticos e sem novos
  erros.

## Correção de escopo descoberta nesta rodada

Busca por geolocalização e restrições do hemocentro na página pública **exigem sessão
de instituição** — não são anônimas como o checklist original assumia.
`GET /api/v1/bloodbanks/by-location` exige Bearer token, e a página do hemocentro só
renderiza com `isLoggedIn && selectedInstitution`. Checklist já corrigido para refletir
isso (ver `docs/qa/REGRESSION_CHECKLIST.md`).

## Fronteira de confiança

O plano original previa um segundo hemocentro sintético logável, pra testar cross-tenant
nos dois sentidos (banco↔banco e instituição↔instituição). O lado banco↔banco **não foi
testado nesta rodada** — não há caminho de ferramenta pra provisionar o segundo login
(ver "Fixtures" acima). `counter-propose`/`propose-technical-visit` foram lidos no
código e chamam `assertUserAccessToBloodBanksLocationId` com o `bloodBanksLocationId` da
URL antes de agir — parecem guardados, mas isso não foi confirmado com um teste ao vivo.

O lado instituição↔instituição foi testado com os 3 fixtures de instituição e o
hemodemo. As rotas públicas bloquearam os casos cross-institution.

A rota de retirada do painel institucional falhou no mesmo tipo de fronteira no teste
histórico. Alpha cancelou uma solicitação pendente de Beta com um JWT válido de Alpha.
Após o fix, o mesmo teste retornou HTTP 403 sem alterar a solicitação.

O lado banco↔banco não foi testado. Não existe caminho disponível para provisionar um
segundo login de hemocentro.

## Direções para quem for corrigir os achados

- **ISSUE-A foi corrigido e validado em produção.** Mantenha uma checagem de sessão do
  Bugsnag em cada rodada futura.
- ISSUE-B: antes de "corrigir", confirme com o dono do produto se um 404 dedicado é
  realmente o comportamento esperado — pode ser trabalho desnecessário se o gate de
  login em `/agendar/[bloodbankSlug]` for intencional.

---

_A rodada foi interrompida após a exposição acidental de um token de sessão. O dono da
conta confirmou a rotação. O reteste seguinte não usou diagnóstico de rede._
