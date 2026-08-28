# Checklist de regressão — hemocione-coleta

Fonte única do que precisa ser reverificado a cada dogfood/QA. Atualize este arquivo
sempre que uma rodada descobrir uma área nova, ou que um item pare de fazer sentido.
Use a skill `coleta-dogfood-qa` pra rodar uma leva completa; este arquivo é o
checklist que ela referencia, não um passo a passo de execução.

## Auth / sessão

- [ ] Login via Hemocione ID completa sem loop de redirecionamento (regressão de
      ISSUE-001, ver `dogfood-output/report.md`).
- [ ] Sessão sobrevive a reload da página (regressão de ISSUE-004).
- [ ] Logout limpa usuário, token e cookie.
- [ ] Callback de volta do Hemocione ID não vaza `token` na URL, mas preserva os
      demais parâmetros (regressão de ISSUE-006).
- [ ] `/termo/:token` e outras rotas públicas abrem sem sessão.

## Fluxo público (`/agendar`, sem autenticação)

**Correção de round 2026-08-27:** busca por geolocalização e restrições do hemocentro
NÃO são anônimas — `GET /api/v1/bloodbanks/by-location` exige Bearer token, e
`pages/agendar/[bloodbankSlug]/index.vue` só renderiza depois de `isLoggedIn &&
selectedInstitution`. Teste esses dois itens logado como instituição (seção
"Agendamento"), não nesta seção.

- [ ] `/agendar/acompanhar/<token-inválido>` mostra "Solicitação não encontrada",
      não crash.
- [ ] `/agendar/nao-existe` — hoje mostra o prompt genérico de login, não um 404
      dedicado (visitante anônimo não distingue slug inexistente de slug real sem
      sessão). Decisão de produto pendente: aceitar como é, ou tratar como gap.
- [ ] Menu mobile e modal de login (viewport 390×844).
- [ ] axe-core sem violação no documento público nem no modal de login (regressão
      de ISSUE-002/ISSUE-003 — `aria-dialog-name`, `html-has-lang`,
      `page-has-heading-one`).
- [ ] Console do navegador limpo nas rotas públicas.

## Onboarding de instituição

- [ ] Signup real cria a conta e loga automaticamente.
- [ ] CNPJ inválido bloqueia o botão de salvar (não só mostra erro depois do submit).
- [ ] **Nome/Endereço/Cidade/Estado também bloqueiam "Salvar" se vazios** — achado de
      2026-08-27: `isFormValid` em `layouts/agendamento.vue` só exige CNPJ válido +
      algum campo tocado, não os campos obrigatórios reais. Confirme antes de assumir
      corrigido.
- [ ] "Meus Agendamentos" lista todas as solicitações da instituição, em todos os
      status.

## Agendamento — matriz de status e transições

Estados possíveis (`server/models/collectionRequest.ts`): `pending`, `accepted`,
`rejected`, `cancelled`, `counter_proposed`, `counter_proposal_declined`,
`awaiting_technical_visit`, `technical_visit_confirmed`, `scheduled`.

- [ ] Criar solicitação com até 3 datas preferidas (`pending`).
- [ ] Hemocentro aceita (`pending → accepted`) — slot correspondente trava
      (`AvailableDate.slots.$.locked`).
- [ ] Hemocentro rejeita com justificativa a partir de `pending`.
- [ ] **Hemocentro rejeita uma solicitação já `accepted`** — permitido pelo código
      (`REJECTABLE_STATUSES` inclui `accepted`). Confirme que o slot travado é
      destravado nesse caso; se não for, é um slot fantasma preso pra sempre.
- [ ] Hemocentro contrapropõe (`pending → counter_proposed`); instituição aceita
      (`→ accepted` ou `→ awaiting_technical_visit` se precisar de visita) e
      instituição recusa (`→ counter_proposal_declined`).
- [ ] 409 estruturado ao duplicar solicitação: mesma instituição + mesmo hemocentro
      + mesma data, com sobreposição de slot (ou lado coringa sem `slotIds`).
      Confirme que **não** dispara pra datas diferentes ou hemocentro diferente.
- [ ] Instituição cancela solicitação própria em `pending`/`accepted`
      (`cancelCollectionRequestByInstitution`).
- [ ] Instituição desiste (`withdraw`) em `pending` — **testar as 3 rotas**: painel
      da instituição, pública, e pública por token de acompanhamento. São 3
      implementações separadas da mesma regra.
- [ ] Concorrência: duas instituições disputando o mesmo slot — só uma consegue
      `accepted`, a outra recebe conflito/409 coerente, nenhuma trava o slot sem
      solicitação válida.
- [ ] Link de inscrição no digital-event gerado nos dois estados que permitem
      (`GENERATABLE_STATUSES`: `accepted` e `technical_visit_confirmed`), não só
      no caminho de aceite direto.
- [ ] Prioridade de instituição respeitada na listagem de solicitações do
      hemocentro (precisa de 2+ instituições sintéticas pra fazer sentido).

## Visita técnica

- [ ] Proposta sequencial: hemocentro propõe, instituição recusa, hemocentro propõe
      de novo — pelo menos 2 rodadas, pra confirmar que não trava depois da 1ª
      recusa (`previousVisitProposals` deveria reabrir a precondição).
- [ ] Horário da visita interpretado em `America/Sao_Paulo`, não UTC.
- [ ] Registro de visita realizada vincula corretamente à solicitação.
- [ ] Motivo interno (`reason`) da rejeição/recusa não aparece no histórico visível
      pra instituição.

## Fronteira de confiança (segurança)

**Segundo hemocentro logável: sem caminho de ferramenta hoje.** Confirmado em
2026-08-27 lendo o código do `hemocione-id` — não existe rota (backoffice, MCP, job ou
self-service) que vincule um `userBloodBankRole` a um banco recém-criado; só existe o
equivalente pra instituição (`POST /institutions` cria `userInstitutionRole`). Sem isso,
o probe banco↔banco abaixo não roda — só o instituição↔instituição, que usa 2+
instituições sintéticas contra o MESMO hemocentro (não precisa de um segundo banco).
Se um dia existir um jeito de provisionar login de banco (via DB direto ou uma rota
nova), reative o item banco↔banco.

- [ ] **(instituição↔instituição, testável hoje)** Duas instituições, mesmo
      hemocentro: `respond-counter-proposal`/`respond-technical-visit-proposal` via
      token de acompanhamento de uma tentando agir no `requestId` da outra. Nenhuma das
      duas funções de service filtra por institutionId — só o binding do token na rota.
      Confirme que o binding impede; se não impedir, pare e reporte, não explore mais.
- [ ] `withdraw` nas 3 rotas (ver acima) também não deveria permitir agir sobre
      solicitação de outra instituição.
- [ ] **(banco↔banco, bloqueado — sem fixture)** `counter-propose` e ações de visita
      técnica chamam `assertUserAccessToBloodBanksLocationId` com o `bloodBanksLocationId`
      da URL antes de agir — parece guardado por leitura de código, mas nunca foi
      confirmado com um teste ao vivo. Fica pendente até existir um segundo hemocentro
      logável.

## Admin do hemocentro

- [ ] Calendário: criar/editar datas e slots; configuração em massa carrega dados
      corretamente em deep link; endpoint PATCH de status
      (bloqueada/pendente/liberada) reflete na UI.
- [ ] PATCH de status numa data que já tem solicitação vinculada — confirme que não
      quebra nem corrompe o estado da solicitação.
- [ ] Equipes: cadastro e disponibilidade.
- [ ] Cobertura: desenhar/editar polígono no mapa e salvar.
- [ ] Restrições: cadastrar/editar lista de restrições do hemocentro.

## Notificações (WhatsApp)

- **Não coberto por padrão** — decisão explícita do produto de não testar disparo
  nem recebimento nesta rodada. Duas famílias de código diferentes existem
  (`collectionRequestNotification.ts` compartilhado vs. chamadas diretas em
  `accept`/`reject`/`cancel`/criação da instituição) — se algum dia isso entrar de
  volta no escopo, teste as duas famílias separadamente, não só uma.

## Fechamento

- [ ] Bugsnag sem erro novo na janela do teste. **Verifique primeiro se o Bugsnag
      está mesmo recebendo dado em prod** — achado de 2026-08-27: `nuxt.config.ts`
      define `enabledReleaseStages: ["prod", "dev"]`, mas `VERCEL_ENV` em produção
      vale `"production"` (não `"prod"`), então o Bugsnag descarta tudo
      silenciosamente. Enquanto esse fix não sobe, este item está sempre verde por
      default — não é sinal de ausência de erro.
- [ ] Todo fixture criado (instituições, bancos sintéticos) listado no report da
      rodada.
