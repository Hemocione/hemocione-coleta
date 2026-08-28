# Dogfood Report: Hemocione Coleta — Produção (hemodemo)

| Field | Value |
|-------|-------|
| **Date** | 2026-08-27 |
| **App URL** | https://coleta.hemocione.com.br |
| **Deploy validado** | `7f0d516` (main, confirmado == deploy de produção via Vercel API) |
| **Fixtures** | hemocentro `hemodemo`; demais fixtures listados na seção Fixtures abaixo |
| **Scope** | Regressão completa — fluxo público, onboarding de instituição, agendamento (eixo transversal), visita técnica, admin do hemocentro, fronteira de confiança |

## Summary

_Preenchido ao final da rodada._

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
| **Status** | found, not fixed |

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
- Console limpo de exceções JS (fora do warning do Bugsnag, ISSUE-A).

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

O lado instituição↔instituição (`respondToCounterProposal`,
`respondToTechnicalVisitProposal`, as 3 rotas de `withdraw` — nenhuma filtra por
institutionId internamente, só o binding do token de acompanhamento na rota) **foi**
testável só com os 3 fixtures de instituição + hemodemo, sem precisar do segundo banco.
Resultado abaixo, na seção que o agente dedicado devolveu.

## Direções para quem for corrigir os achados

- **ISSUE-A é o mais importante de corrigir primeiro**, mesmo sendo classificado
  "monitoring": enquanto ele não for corrigido, toda checagem de "Bugsnag limpo" em
  qualquer dogfood futuro (incluindo o fechamento desta própria rodada) é um falso
  positivo estrutural, não uma confirmação real. Fix é de uma linha em
  `nuxt.config.ts`; valide comparando `console.log(process.env.VERCEL_ENV)` num
  preview deploy real antes de assumir o valor.
- ISSUE-B: antes de "corrigir", confirme com o dono do produto se um 404 dedicado é
  realmente o comportamento esperado — pode ser trabalho desnecessário se o gate de
  login em `/agendar/[bloodbankSlug]` for intencional.

---

_Seções de agendamento, visita técnica, admin do hemocentro e fronteira de confiança
em preenchimento — agentes ainda em execução._
