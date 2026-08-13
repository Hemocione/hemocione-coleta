# Coleta Externa e Portal de Instituições — Arquitetura e Plano

**Data:** 2026-08-13
**Repos afetados:** `hemocione-coleta`, `hemocione-id`, `hemocione-digital-event`, `hemocione-app` (embed), e uma plataforma nova: `instituicoes.hemocione.com.br`
**Status:** proposta em revisão — ver seção 10 (suposições a validar)

## 1. Contexto e objetivo

Hoje uma instituição solicita uma coleta externa a um banco de sangue através do `hemocione-coleta`. O fluxo é binário (aceita/rejeita), não tem negociação de data/horário, não liga a visita técnica à solicitação, e não existe nenhuma superfície dedicada para a instituição acompanhar seu histórico. Este documento propõe:

1. Evoluir o domínio de solicitação de coleta para suportar negociação (contraproposta), nota, horário específico e visita técnica reaproveitável.
2. Criar uma plataforma nova, `instituicoes.hemocione.com.br`, como o "lar" das instituições no ecossistema Hemocione.
3. Integrar essa cadeia com `hemocione-digital-event` para gerar automaticamente o evento e o link de inscrição quando a coleta é confirmada.
4. Dar visibilidade interna (equipe Hemocione) e cross-instituição (pessoa vinculada a N instituições) sobre esses pedidos.

**Princípio de design usado em todo o documento:** nenhum backend novo, nenhum banco de dados novo. `hemocione-coleta` continua dona do domínio de solicitação/coleta; `hemocione-id` continua dono de identidade/instituição/notificação; `hemocione-digital-event` continua dono de evento/inscrição. A plataforma nova é uma camada de apresentação que consome essas três APIs — o mesmo padrão que `hemocione-app`/`id-frontend` já usam hoje. Isso evita duplicar regra de negócio.

## 2. Fases (ordem de dependência técnica)

| Fase | Conteúdo | Por que nessa ordem |
|---|---|---|
| **0 — Fundações** | Fecha gaps do código atual que travam tudo o resto (seção 9) | Sem isso, as fases seguintes não têm onde se apoiar |
| **1 — Núcleo do domínio** | Nota, horário, duração, máquina de estados com contraproposta, visita técnica reaproveitável | É o dado que todo o resto lê/escreve |
| **2 — Portal instituicoes.hemocione.com.br** | Login SSO, histórico, troca de organização, tela de acompanhamento, embed no app | Consome a Fase 1 |
| **3 — Backoffice interno Hemocione** | Visão cross-instituição para equipe interna, cadastro em nome de instituição | Reusa a mesma UI da Fase 2, com escopo ampliado |
| **4 — Integração com hemocione-digital-event** | Geração automática de evento, horários por perfil de dia, link de inscrição | Depende da Fase 1 estar madura (é o desfecho do fluxo) |
| **5 — Automação de divulgação** | Notificar responsável da instituição quando o link de inscrição sai | Depende da Fase 4 existir |

## 3. Modelo de dados e máquina de estados (`hemocione-coleta`)

Esta é a peça central — todo o resto do documento (notificação, telas, integração) só reflete este estado.

### 3.1 Evolução do `CollectionRequestSchema`

Arquivo: `server/models/collectionRequest.ts`.

```ts
note?: string                     // nota da instituição na solicitação original
requestedDates: [{
  date: Date,
  startTime?: string,             // "HH:mm" — horário específico, opcional
  availableDateId, slotIds?       // mantém compatibilidade com o sistema de slots atual
}]
technicalVisitId?: ObjectId       // aponta para uma TechnicalVisit — nova OU reaproveitada
counterProposal?: {               // objeto único (não array) — aplica "1 contraproposta por
                                   // solicitação" por construção, sem precisar de validação extra
  proposedDates: [{ date: Date, startTime: string, durationMinutes: number, note?: string }],
  needsTechnicalVisit: boolean,
  note?: string,
  proposedBy: string,             // userId do banco de sangue
  proposedAt: Date,
  response?: {
    decision: "accepted" | "declined",
    selectedDateId?: string,
    respondedAt: Date,
    respondedBy: string,
  }
}
previousCounterProposals?: Array<typeof counterProposal>
                                   // arquivo append-only: toda vez que `counterProposal` seria
                                   // sobrescrito ou descartado, o valor anterior migra pra cá antes
                                   // — ver 3.3 para o motivo (recusa por engano não tem undo hoje)
confirmedSchedule?: { date: Date, startTime: string, durationMinutes: number }
                                   // data final acordada — unifica aceite direto e aceite de
                                   // contraproposta num único campo que o resto do sistema lê
eventSlug?: string                // referência ao Event criado no hemocione-digital-event
status: enum [
  "pending", "counter_proposed", "counter_proposal_declined",
  "accepted", "awaiting_technical_visit", "technical_visit_confirmed",
  "scheduled", "rejected", "cancelled",
]
```

### 3.2 Transições de estado

```
pending
  ├─ [banco aceita direto]                         → accepted | awaiting_technical_visit
  ├─ [banco rejeita]                                → rejected
  └─ [banco contrapropõe — só 1x, ver 3.3]          → counter_proposed

counter_proposed
  ├─ [instituição aceita a contraproposta]          → accepted | awaiting_technical_visit
  └─ [instituição recusa]                           → counter_proposal_declined  (terminal)

awaiting_technical_visit
  ├─ [reaproveita visita já aprovada — ver 3.4]     → technical_visit_confirmed  (imediato)
  ├─ [nova visita, veredito aprovado]                → technical_visit_confirmed
  └─ [nova visita, veredito reprovado]               → rejected

accepted | technical_visit_confirmed
  └─ [banco gera link de inscrição — Fase 4]         → scheduled

scheduled
  └─ [instituição ou banco cancela]                  → cancelled  (com efeito colateral — ver nota)

qualquer outro estado não-terminal
  └─ [instituição ou banco cancela]                  → cancelled  (terminal)
```

Terminais: `scheduled` (sucesso, mas ainda cancelável — ver abaixo), `rejected`, `cancelled`, `counter_proposal_declined`.

**`awaiting_technical_visit` cobre dois momentos distintos**, não um só: (a) a decisão ainda não foi tomada (reaproveitar vs. agendar nova visita) e (b) uma visita nova já foi agendada e está aguardando acontecer/receber veredito. `TechnicalVisit.outcome` já modela um terceiro valor, `"pending"`, que corresponde ao momento (b) — a UI faz join com esse campo para saber qual dos dois momentos mostrar; não é um sub-status novo em `CollectionRequest`, é leitura do `technicalVisitId` referenciado. **Cancelamento durante o momento (b)** (visita física já marcada, sem veredito ainda) deixa a `TechnicalVisit` órfã — ela continua existindo e pode ser reaproveitada por uma solicitação futura da mesma instituição+banco, então não precisa de tratamento especial de limpeza.

**`scheduled → cancelled` precisa de efeito colateral explícito**: uma vez que existe um `Event` real no `hemocione-digital-event` com inscrições abertas, cancelar a solicitação sem cancelar o evento correspondente deixa as duas fontes de verdade divergentes (a solicitação mostra `cancelled`, o evento continua ativo e aceitando inscrições). A transição precisa disparar uma chamada de cancelamento/exclusão do lado do evento (a operação já existe — é a mesma usada hoje pelo backoffice Lowcoder). Também é preciso considerar o caminho inverso: o evento pode ser cancelado direto no backoffice de eventos, sem passar pela `CollectionRequest` — nesse caso a solicitação fica presa em `scheduled` apontando para um `eventSlug` morto. Fechar esse caminho exige um webhook/callback de `hemocione-digital-event` avisando `hemocione-coleta` quando um evento com `institutionId` preenchido for cancelado, ou aceitar isso como reconciliação manual conhecida na Fase 4 (ver seção 10).

### 3.3 Regra "1 contraproposta por solicitação"

`counterProposal` é um **objeto único opcional**, não um array. O service (`server/services/collectionRequest.ts`) rejeita a criação de uma nova contraproposta se o campo já existir — não precisa de contador nem de validação de array; a própria forma do dado impõe o limite. Se a instituição recusa (`counter_proposal_declined`), não há novo ciclo: para insistir, ela abre uma solicitação nova (mesma UX que já existe hoje para pedidos rejeitados).

**Duas ressalvas importantes, vindas de revisão adversarial (seção 12):**

- **Sem undo.** `counter_proposal_declined` é terminal — se a instituição recusar por engano, ou se o banco digitar a data errada na contraproposta antes da instituição responder, não existe caminho de correção sem perder o contexto original (nota, host, endereço já preenchidos). Mitigação adotada: antes de sobrescrever/descartar `counterProposal`, o valor atual migra para `previousCounterProposals[]` (seção 3.1) — não desfaz a decisão, mas preserva o histórico para suporte/auditoria e para reabrir manualmente um caso excepcional.
- **A regra "1 rodada" não tem evidência de campo** — é uma simplificação de modelagem a partir das notas originais, não um padrão observado de como bancos negociam hoje. Se na prática for insuficiente, o custo de migrar de objeto único para array toca todo consumidor (timeline do portal, backoffice, gatilho de notificação) — vale validar com quem realmente responde essas solicitações antes de travar a decisão em código.

**Proteção contra corrida:** as funções já existentes (`acceptCollectionRequest`, `rejectCollectionRequest`) usam um filtro `status: "pending"` dentro do `findOneAndUpdate` para evitar dupla transição simultânea — é esse padrão, e não apenas "o campo já existe", que precisa proteger a criação da contraproposta e sua resposta. Contar só com a forma do dado (objeto vs. array) protege contra duplicidade, não contra duas requisições concorrentes lendo o mesmo estado antes de qualquer uma escrever.

### 3.4 Reaproveitamento de visita técnica

`TechnicalVisit` (`server/models/technicalVisit.ts`) já é escopado por `institutionId + bloodBanksLocationId`, não por solicitação — isso já favorece reaproveitamento, só faltava o vínculo do lado certo. A mudança é `CollectionRequest.technicalVisitId` (N:1, uma visita pode ser referenciada por várias solicitações), nunca o inverso.

Ao entrar em `awaiting_technical_visit`, a tela do banco de sangue mostra o histórico de visitas aprovadas daquela instituição+banco (já existe a query, só falta a UI) e oferece **três ações**, não duas:

1. **Reaproveitar** uma visita já registrada — pula direto para `technical_visit_confirmed`.
2. **Declarar visita já realizada, sem registro prévio** (confirmado pelo Guima): mesmo sem nenhuma `TechnicalVisit` cadastrada para aquela instituição+banco, o banco de sangue pode saber que já visitou informalmente (antes deste sistema existir, ou por qualquer motivo não registrado). Ele informa uma **data** (quando a visita ocorreu) e confirma explicitamente que **não precisa de nova visita técnica**. O sistema cria uma `TechnicalVisit` nova nesse momento (`outcome: "approved"`, `visitDate` = data informada, `institutionId`/`bloodBanksLocationId` preenchidos, mais um campo novo `registeredRetroactively: true` — distingue de visitas que passaram pelo ciclo normal agendar→realizar→veredito, útil para auditoria/qualidade de dado depois) e a solicitação segue exatamente como no caso 1: pula direto para `technical_visit_confirmed`.
3. **Agendar visita nova** — cria uma `TechnicalVisit` com `outcome: "pending"`, entra de fato em `awaiting_technical_visit` aguardando a visita acontecer.

**Decisão confirmada:** sem expiração automática — a escolha de reaproveitar (opções 1 e 2) ou não é sempre manual, o sistema só mostra a data/resultado da última visita para apoiar a decisão. Sem política de validade no MVP; se isso virar um problema real (ex: banco reaproveitando visitas muito antigas), entra como ajuste futuro.

**A opção 2 também resolve, na prática, o risco de dado legado abaixo** — cada vez que um banco de sangue a usa, o histórico daquela instituição fica mais completo, sem precisar de uma migração de dados separada.

**Risco a verificar antes de prometer esta feature:** `TechnicalVisit.institutionId` é opcional no schema (`server/models/technicalVisit.ts:7`), e o segundo índice do modelo é `bloodBanksLocationId + address`, não `bloodBanksLocationId + institutionId` — sinal de que o vínculo real usado até hoje pode ser por endereço, não por instituição. Se visitas antigas tiverem `institutionId` nulo, o histórico "visitas aprovadas daquela instituição" viria incompleto ou vazio para dados legados, e ninguém notaria até um banco reclamar "já fizemos essa visita, por que não aparece pra reaproveitar". Antes de implementar a Fase 1, rodar uma consulta simples (`TechnicalVisit.countDocuments({institutionId: null, outcome: "approved"})`) para medir o tamanho real do backfill necessário.

**Verificar antes de implementar a opção 2:** o endpoint de criação de `TechnicalVisit` hoje existe para *agendar* uma visita (CRUD em `server/api/v1/bloodbank/[bloodbanksLocationId]/technical-visits/*`) — confirmar que ele (ou uma variante) aceita `visitDate` no passado sem alguma validação pensada só para agendamento futuro barrar isso.

### 3.5 "Aparece na solicitação ao vivo"

**Confirmado pelo Guima:** "ao vivo" significa "atualiza assim que a pessoa abre a tela de novo" — não uma tela que se atualiza sozinha na frente da pessoa. Sem WebSocket/polling em tempo real. O que fecha essa experiência é a notificação: toda transição de etapa dispara um aviso via `hemocione-id` (WhatsApp ou push, decidido automaticamente pelo canal orquestrado — ver seção 6) para quem precisa saber, e é esse aviso que leva a pessoa a abrir a tela e ver o estado já atualizado.

## 4. Plataforma `instituicoes.hemocione.com.br`

### 4.1 Stack e padrão

Nuxt 3 (mesmo padrão do restante do ecossistema), deploy Vercel. Recomendo Element Plus (maioria dos produtos do ecossistema usa) em vez de replicar o Tailwind+MapLibre do `hemocione-coleta` — o portal é voltado à pessoa da instituição, não ao operador de banco de sangue, então não precisa herdar a UI do backoffice de coleta. Tem sua própria camada `server/api/*` (BFF), seguindo o mesmo padrão Nuxt-server que todo repo do ecossistema já usa — não é uma escolha nova, é consistência.

### 4.2 Por que isso não duplica o `hemocione-coleta`

O `hemocione-coleta` mantém suas páginas públicas (`/agendar/...`) para quem chega por link direto, sem necessariamente estar logado como "pessoa de instituição" navegando o produto. O portal novo é a **casca autenticada** — dashboard, histórico agregado (solicitações + eventos juntos, que hoje vivem em dois backends diferentes e não têm um lugar comum), troca de organização. Nenhuma regra de negócio de *leitura* é reescrita: o portal só chama as APIs de `hemocione-coleta` (domínio de solicitação) e `hemocione-digital-event` (domínio de evento), e a criação de uma nova solicitação pode reusar o fluxo já existente em `/agendar` via link/embed, em vez de reimplementar.

**Ressalva importante:** essa descrição vale para leitura. A geração de evento (seção 7.2) não é "consumir uma API" — é uma orquestração de escrita atravessando dois bancos Mongo diferentes sem transação distribuída, e precisa do mesmo rigor de design que o resto deste documento dá a decisões de consistência. Chamar o sistema inteiro de "camada de apresentação" seria subestimar essa parte — ver seção 7.2.

**Custo de latência já existente, que este projeto empilha em cima:** `hemocione-coleta` já faz uma chamada síncrona sem cache a `hemocione-id` (`getInstitutionsByIds`, ver `server/services/hemocioneId.ts`) toda vez que lista solicitações de um banco de sangue. Uma tela de detalhe no portal novo (seção 4.6) encadeia potencialmente 3 hops HTTP síncronos (portal → hemocione-coleta → hemocione-id, e depois portal → hemocione-digital-event se `scheduled`) — o design não piora esse padrão, mas também não resolve o que já existe. Vale medir a latência real em produção antes de assumir que está aceitável.

### 4.3 Autenticação e SSO

Mesmo padrão do `hemocione-coleta`: JWT emitido pelo `hemocione-id`, validado localmente com o secret compartilhado (`HEMOCIONE_ID_JWT_SECRET_KEY`), redirecionamento para login centralizado quando não autenticado (`redirectToID`). **Pré-requisito a verificar antes de prometer SSO sem re-login** (não apenas assumir): confirmar no código de emissão de cookie do `hemocione-id` se o `Domain` configurado é `.hemocione.com.br` (compartilhado entre subdomínios) e não um domínio específico de cada produto. Um subdomínio novo sem esse `Domain` correto vira um bug de dia 1 visível para toda pessoa de instituição tentando entrar no portal.

### 4.4 Modelo "tenant" — pessoa com múltiplas instituições

`userInstitutionRole` no `hemocione-id` já suporta N vínculos por usuário (só é único o par `[userId, institutionId]`). Fluxo:

1. No login, busca `GET /users/me/institutions` (já existe).
2. Se 0 instituições → tela vazia com CTA para criar/vincular instituição.
3. Se 1 → entra direto nela.
4. Se N > 1 → seletor de organização ativa (padrão Slack/Vercel: dropdown no topo, persiste a escolha em cookie/localStorage). Toda chamada subsequente é escopada por essa `institutionId` (mesmo padrão de URL `[institutionId]` que `hemocione-coleta` já usa).

### 4.5 Gestão de membros (gap a fechar — ver seção 9)

Hoje **ninguém nunca vira `admin`** de instituição — `institutionService.createInstitution` sempre atribui `staff`, e não existe endpoint de convite. Isso precisa de dois ajustes em `hemocione-id`:

- Quem cria a instituição vira `admin` (não `staff`) — corrige o bootstrap.
- Novo endpoint `POST /institutions/:id/members` (convite por e-mail, só `admin` pode chamar) + `PUT`/`DELETE` para gerenciar papel/remoção.

Sem isso, o conceito de "instituição com múltiplas pessoas" não tem como nascer na prática.

**Fronteira de confiança a testar explicitamente:** esses três endpoints recebem `:id` da instituição na URL — a autorização precisa garantir que o `admin` autenticado tem `role: admin` **especificamente para essa `:id`**, não apenas `admin` de alguma instituição qualquer. É o tipo de endpoint onde "admin da instituição A consegue adicionar/remover membro da instituição B" é um erro fácil de introduzir (basta esquecer o filtro por `institutionId` numa query) e caro de descobrir depois. Antes de considerar isso "pronto", cobrir com um teste que tenta exatamente esse cenário cross-instituição.

### 4.6 Conteúdo do MVP ("o básico", conforme pedido)

- **Meus pedidos**: lista de `CollectionRequest` da instituição ativa, com filtro por status — consome o endpoint que hoje é um arquivo vazio em `hemocione-coleta` (Fase 0).
- **Detalhe do pedido — "Etapas e Contrapropostas"**: versão autenticada da tela de acompanhamento, renderizando a máquina de estados da seção 3 como timeline (pending → contraproposta → visita técnica → agendado), com o veredito da visita e o link de inscrição quando `scheduled`.
- **Meus eventos**: lista de `Event` da instituição ativa — precisa de um filtro novo em `hemocione-digital-event` (`GET /event?institutionId=`), já que os campos `institutionId`/`bloodBanksLocationId` foram mesclados recentemente (PR #47) mas ainda não são lidos em nenhuma query hoje.
- **Nova solicitação**: link/embed para o fluxo já existente em `hemocione-coleta` (`/agendar`), pré-selecionando a instituição ativa via query param.

### 4.7 Embed no `hemocione-app`

Iframe via `@hemocione/sdk` (postMessage), mesmo padrão já usado para `hemocione-can-donate`, `hemocione-digital-event` e `hemocione-competitions`. Aparece como uma seção no app **apenas se a pessoa tiver ao menos uma `institutionRole`** no JWT — sem essa claim, a seção nem renderiza.

## 5. Backoffice interno Hemocione

Duas personas confirmadas: (a) equipe interna Hemocione cadastrando/gerenciando em nome de instituições, visão cross-organização; (b) pessoa com vínculo em várias instituições, trocando de organização (já coberto pela seção 4.4, sem mudança).

**Decisão confirmada pelo Guima: para a persona (a), reaproveitar ao máximo o `hemocione-mcp` já existente, em vez de construir uma superfície de UI dedicada.** Isso substitui a proposta anterior (seletor de organização ampliado com claim `isAdmin` no JWT) — o caminho abaixo é o novo desenho.

### 5.1 Como o `hemocione-mcp` já funciona

`hemocione-mcp` é um servidor MCP HTTP (Hono, stateless, sem banco) que expõe endpoints de backoffice de vários serviços Hemocione como *tools* — cada serviço é um objeto `Service` (`id`, `baseUrlEnv`, `auth: {header: "x-secret", secretEnv}`, `endpoints: [...]`) registrado em `src/catalog/index.ts`. Adicionar um endpoint novo a um serviço já cadastrado é **só uma entrada de array** — nenhum handler dedicado, nenhum arquivo de servidor a tocar; a tool nasce no próximo boot (mecanismo documentado no próprio README do repo).

O catálogo de `hemocione-coleta` **já existe**, com 2 tools (`cadastrar_hemocentro`, `criar_solicitacao_de_coleta`), ambas via header `x-secret` contra `COLETA_SECRET` — mas vive hoje dentro de `src/catalog/outros.ts`, um arquivo-cesto compartilhado com mais 4 serviços (`certificados`, `askForHelp`, `promotions`, `ondeDoar`), e as variáveis `COLETA_SECRET`/`COLETA_BASE_URL` estão **vazias no ambiente atual** do `hemocione-mcp` — ou seja, essas 2 tools não funcionam de fato hoje (ver seção 9).

### 5.2 O que este projeto adiciona ao catálogo

Cada novo endpoint de backoffice proposto neste documento ganha uma entrada correspondente no catálogo — o custo marginal é uma linha de array, não uma tela nova:

| Tool MCP nova | Endpoint que ela chama | Observação |
|---|---|---|
| `coleta__listar_solicitacoes` | `GET /api/backoffice/v1/collection-requests` (novo, com filtros `institutionId?`/`bloodBanksLocationId?`/`status?`) | Visão cross-organização — endpoint novo, distinto do listing JWT-escopado da seção 4.6 |
| `coleta__aceitar_solicitacao` / `contrapor_solicitacao` / `rejeitar_solicitacao` / `cancelar_solicitacao` | Variantes backoffice-secret dos endpoints hoje só-JWT (`accept.post.ts` etc.) | Corpo exige `actingAsStaffId` explícito — mesmo padrão que `criar_solicitacao_de_coleta` já usa para `requestedByUserId` |
| `coleta__reaproveitar_visita_tecnica` / `registrar_veredito_visita` | Ações sobre `TechnicalVisit` (seção 3.4) | — |
| `coleta__gerar_link_de_inscricao` | Orquestração da seção 7.2 | — |
| `id__buscar_instituicoes_por_texto` | `GET /institutions?q=` (o gap da seção 9, agora catalogado) | Substitui a necessidade de UI de busca no portal para esta persona |

**Importante — a rota, não o catálogo, é quem autoriza e valida.** Confirmado no código do `hemocione-mcp`: o campo `body` de qualquer endpoint é repassado como `z.any()`, sem shape, sem whitelist de campos — "nada é parseado, validado ou reserializado no caminho" (comentário do próprio `forward()`). Isso significa que toda validação de autorização e todo whitelist de campos (ex.: a personalização de evento da seção 7.5 só pode tocar `banner`/`logo`/`address`, nunca datas ou vagas) **tem que estar no endpoint real** de `hemocione-coleta`/`hemocione-digital-event` — o catálogo MCP não oferece nenhuma garantia adicional, só a conveniência de invocação.

**Quem alcança essas tools hoje:** qualquer conta Google do domínio `@hemocione.com.br` (ou API key válida), sem escopo por operação ou por serviço — risco já documentado no próprio README do `hemocione-mcp` ("qualquer conta do domínio acessa tudo que o catálogo expõe"). Isso reforça por que `actingAsStaffId` precisa ser um **parâmetro explícito no corpo** de cada chamada (responsabilidade de quem chama preencher corretamente, mesmo padrão que `requestedByUserId` já usa em `criar_solicitacao_de_coleta`) — não algo inferido automaticamente da identidade de quem invocou o MCP, que não é necessariamente um usuário Hemocione.

**Sem duplicar lógica de negócio:** tanto a rota JWT (banco de sangue respondendo diretamente) quanto a variante backoffice-secret (equipe interna agindo em nome de alguém) chamam a **mesma função de service** (`acceptCollectionRequest` etc., seção 3.2) — a diferença entre as duas é só autenticação e resolução de quem está agindo, nunca a máquina de estados em si.

### 5.3 Persona (b) — sem mudança

Pessoa com vínculo em várias instituições continua servida pela UI do portal (seletor de organização, seção 4.4) — essa persona não tem conta `@hemocione.com.br` nem acesso ao MCP, então a UI web continua sendo o caminho certo para ela.

**Risco evitado por esta decisão:** ao usar o secret já existente do MCP em vez de uma claim `isAdmin` nova no JWT, evitamos crescer o raio de impacto de uma claim global compartilhada por múltiplos serviços — risco que tinha sido apontado na revisão adversarial (seção 12) sobre o desenho anterior.

## 6. Notificações (WhatsApp)

**Princípio confirmado pelo Guima: toda transição de etapa notifica quem precisa saber ou agir.** Não é "notificar só em pontos específicos" — é regra geral: cada mudança de `status` em `CollectionRequest` dispara uma chamada a `hemocione-id`, que já decide o canal automaticamente (WhatsApp se a pessoa nunca abriu o app, push com fallback para WhatsApp se já abriu — lógica adaptativa que já existe em `notificationService.js`). Canal: WhatsApp Cloud API (Meta), via `hemocione-id` (`POST /send-wpp-msg` ou o orquestrado `POST /notifications/send`), disparo síncrono fire-and-forget — mesmo padrão já usado hoje para os 4 templates existentes.

**Mapa completo de transição → quem é notificado:**

| Transição | Notifica | Template |
|---|---|---|
| Criação (`pending`) | Banco de sangue | `collection_request_created` (existente) |
| → `counter_proposed` | Instituição | `collection_request_counter_proposed` (novo) |
| → `counter_proposal_declined` | Banco de sangue | `collection_request_counter_proposal_declined` (novo) |
| → `accepted` | Instituição | `collection_request_accepted` (existente) |
| → `awaiting_technical_visit` | Instituição | `collection_request_awaiting_technical_visit` (novo) |
| → `technical_visit_confirmed` | Instituição | `technical_visit_confirmed` (novo) |
| → `rejected` | Instituição | `collection_request_rejected` (existente) |
| → `scheduled` | Instituição e ponto focal | `collection_request_scheduled` (novo) |
| → `cancelled` | A outra parte (quem não cancelou) | `collection_request_cancelled` (existente) |

**Templates novos necessários** (todo template do WhatsApp Business precisa de aprovação prévia da Meta — **é uma dependência externa com lead time de dias, fora do controle do time; deve ser submetido o quanto antes, em paralelo ao desenvolvimento**, não pode ser deixado para o fim): `collection_request_counter_proposed`, `collection_request_counter_proposal_declined`, `collection_request_awaiting_technical_visit`, `technical_visit_confirmed`, `collection_request_scheduled` — 5 novos; os outros 4 já existem e continuam sendo usados como estão.

Nenhuma mudança de infraestrutura de notificação é necessária — é só consumir o endpoint que já existe, com templates novos, disparado a partir do mesmo ponto do service layer que já grava `statusHistory` (garante que toda transição, sem exceção, dispara o aviso — nunca fica responsabilidade de cada endpoint lembrar de chamar).

## 7. Integração com `hemocione-digital-event`

### 7.1 Autenticação entre serviços

`hemocione-digital-event` hoje só tem um secret global (`API_SECRET`) compartilhado com o Lowcoder para todo write-path de evento — não distingue quem está chamando. Para a chamada `hemocione-coleta → hemocione-digital-event`, recomendo um **secret dedicado novo** (`COLETA_INTEGRATION_SECRET`, mesmo padrão de `HEMOCIONE_ID_INTEGRATION_SECRET` que já existe para chamadas do `hemocione-id`), em vez de reusar o secret do Lowcoder. Isola o raio de impacto: rotacionar o secret do Lowcoder não deveria exigir coordenar com `hemocione-coleta`, e vice-versa.

### 7.2 Geração do evento

Quando o banco de sangue clica "gerar link de inscrição" (disponível em `accepted` ou `technical_visit_confirmed`), o fluxo é: criar `Event` → gerar horários (7.3) → habilitar inscrições (`subscription/enable`) → gravar `eventSlug` de volta na `CollectionRequest` e transicionar para `scheduled`. Esses 3 primeiros passos hoje são ações manuais separadas no backoffice Lowcoder; aqui viram uma orquestração única.

**Isso não é uma leitura agregada, é uma escrita distribuída em 4 passos atravessando dois bancos Mongo diferentes, sem transação entre eles.** Uma cadeia ingênua de chamadas HTTP síncronas tem falhas de consistência concretas e não-hipotéticas:

- Falha entre o passo 1 e o 4: `Event` fica criado em `hemocione-digital-event`, mas `CollectionRequest` nunca recebe o `eventSlug` nem sai de `accepted`/`technical_visit_confirmed`. Se o operador tentar de novo, sem uma chave de idempotência **cria um segundo `Event` duplicado** para a mesma solicitação.
- Falha só no passo 4 (os 3 primeiros funcionam): o evento fica **ao vivo, com inscrições abertas e doadores reais se cadastrando**, enquanto a `CollectionRequest` continua presa no estado anterior — e as duas telas do portal ("Meus pedidos", via `hemocione-coleta"; "Meus eventos", via `GET /event?institutionId=` direto no `hemocione-digital-event`) passam a **discordar na mesma página**.

**Design recomendado:** implementar como função durável do Inngest (já é dependência do `hemocione-digital-event` — mesma ferramenta usada hoje por `findEventsToSendDonations`), com:

1. `sourceCollectionRequestId` gravado no `Event` como chave de upsert — um retry do mesmo pedido nunca cria um segundo evento, apenas continua de onde parou.
2. Passos como steps do Inngest (retry automático por step, sem repetir o que já teve sucesso).
3. O `eventSlug` só é gravado de volta em `CollectionRequest` como último step; se esse step falhar, o job aparece como pendente/falho no painel do Inngest (visibilidade operacional) em vez de silenciosamente deixar as duas fontes de verdade divergentes.

Isso é mais esforço de implementação que uma cadeia HTTP direta, mas o cenário de falha parcial deixando um evento ativo órfão da solicitação é exatamente o tipo de bug que só aparece em produção, com uma instituição parceira real no meio — vale o investimento.

### 7.3 Horários pré-configurados por dia (feature nova)

Hoje `setEventDefaultSchedule` aplica o **mesmo número de vagas a todos os blocos** de horário — não existe noção de "menos vagas no horário de almoço". Proposta: estender o endpoint de geração em massa (`POST /event/[eventSlug]/default_schedules`) com um parâmetro opcional `overrides: [{ startTime: "12:00", endTime: "13:30", slots: N }]`, aplicado por horário-do-dia (independente da data), reduzindo/ajustando `slots` nos blocos cuja janela cai dentro do override. Não muda o formato de `schedules[]` — é só um ajuste no algoritmo de geração, respeitando a restrição já existente de que a geração em massa só funciona antes de `subscription.enabled = true`.

### 7.4 Link de inscrição visível dos dois lados

Uma vez que `CollectionRequest.eventSlug` existe, tanto o portal de instituições (seção 4.6) quanto a tela de backoffice do banco de sangue (`hemocione-coleta`) simplesmente renderizam a URL do evento a partir desse campo — nenhuma capacidade nova de leitura é necessária. **Formato confirmado:** `eventos.hemocione.com.br/event/<eventSlug>` (ex.: `eventos.hemocione.com.br/event/escola-modelo-piriquito-papagaio`).

### 7.5 Personalização do evento pela instituição (feature nova)

**Confirmado pelo Guima:** ao receber o link do evento, a instituição deve poder deixar o evento "com a cara dela" — troca de banner, logo e, possivelmente, endereço. Por padrão, esses campos vêm preenchidos automaticamente:

- **Banner e logo**: default a partir do próprio cadastro da `Institution` no `hemocione-id` (campos `logo`/`banner` já existem nesse model — confirmado em `hemocione-id/src/db/models/institution.js`).
- **Endereço**: default a partir do `address` já preenchido na própria `CollectionRequest` (é o endereço real do local da coleta, mais específico que o endereço geral cadastrado na instituição).

**Risco baixo confirmado:** o model `Event` em `hemocione-digital-event` **já tem** os campos `logo`, `banner` e `location` (`address`/`city`/`state`) — não é preciso schema novo nesse repo, só um caminho de escrita.

**Caminho de escrita recomendado:** não expor esses campos a JWT de usuário diretamente em `hemocione-digital-event` (hoje só tem `assertSecretAuth` global e `x-secret`/`API_SECRET`, sem noção de "essa instituição só pode editar o evento dela"). Em vez disso, criar um endpoint escopado em `hemocione-coleta` (ex.: `PUT /v1/institutions/[institutionId]/collection-requests/[requestId]/event-branding`), que:

1. Valida que a pessoa autenticada tem `institutionRole` para `institutionId` **e** que a `CollectionRequest` referenciada pertence a essa mesma instituição (mesma checagem cross-instituição da seção 4.5).
2. Aceita só os três campos permitidos (`banner`, `logo`, `address`) — nunca datas, vagas, ou qualquer outro campo do evento.
3. Repassa a atualização para `hemocione-digital-event` via `PUT /event/[eventSlug]`, autenticado com o `COLETA_INTEGRATION_SECRET` (seção 7.1) — a mesma aresta nova que já existe para criar o evento, reusada para atualizar.

Isso mantém a autorização por instituição centralizada em `hemocione-coleta` (onde esse padrão já existe e é testado) em vez de duplicá-la dentro de `hemocione-digital-event`.

## 8. Automação de divulgação

**Escopo corrigido pelo Guima:** isto não é sobre avisar a instituição — isso já está resolvido pelo princípio geral da seção 6 (toda transição notifica, incluindo `scheduled` com o link de inscrição). "Divulgação automática" aqui é sobre **divulgação interna do próprio Hemocione**: automatizar posts em redes sociais (Instagram etc.) quando um evento nasce dessa integração.

Isso é uma frente **futura, fora do escopo imediato deste documento** — fica registrado para não se perder, mas sem desenho técnico agora (não foi pedido e provavelmente envolve decisões de conteúdo/aprovação editorial que não são deste domínio). Quando entrar em pauta, o gancho técnico mais natural é o mesmo `eventSlug`/dados do evento já disponíveis a partir da Fase 4 — não deveria exigir mudança de modelo.

## 9. Achados no código atual — ações necessárias (Fase 0)

| Achado | Repo | Ação | Bloqueia |
|---|---|---|---|
| `GET /institutions/[institutionId]/collection-requests` existe como arquivo vazio (0 bytes) | hemocione-coleta | Implementar o endpoint | Portal (4.6), Backoffice (5) |
| `TechnicalVisit` não tem vínculo com `CollectionRequest` | hemocione-coleta | Adicionar `CollectionRequest.technicalVisitId` (seção 3.4) | Máquina de estados (3) |
| `HemocioneUserAuthTokenData` desatualizado (sem `institutionRoles`, e também sem `bloodBankRoles`) | hemocione-digital-event | Sincronizar com o shape já usado em hemocione-coleta | Integração (7); mais concretamente, `GET /event?institutionId=` (4.6) se esse endpoint autorizar por JWT de usuário em vez de secret de serviço |
| `institutionService.getAllInstitutions` existe mas não tem rota | hemocione-id | Expor `GET /institutions?q=` | Backoffice interno (5), busca no portal |
| Ninguém nunca vira `admin` de instituição | hemocione-id | Corrigir bootstrap (criador vira admin) + endpoint de convite de membro | Modelo tenant (4.4/4.5) |
| Sem secret dedicado para hemocione-coleta → hemocione-digital-event | hemocione-digital-event | Novo `COLETA_INTEGRATION_SECRET` | Integração (7.1) |
| `COLETA_SECRET`/`COLETA_BASE_URL` vazios no ambiente do `hemocione-mcp` — as 2 tools de coleta que já existem no catálogo não funcionam de fato hoje | hemocione-mcp | Configurar as duas variáveis | Backoffice interno (5.1) |
| Catálogo `coleta` vive dentro de `src/catalog/outros.ts`, junto com 4 outros serviços | hemocione-mcp | Extrair para `src/catalog/hemocione-coleta.ts` próprio (mesmo padrão de `hemocione-id.ts`/`eventos.ts`/`copa.ts`) antes do catálogo crescer com as tools da seção 5.2 | Backoffice interno (5.1) |
| Endpoints de resposta (aceitar/contrapor/rejeitar/cancelar) só têm variante JWT — não existe caminho backoffice-secret para a equipe interna agir em nome de alguém | hemocione-coleta | Criar as variantes com `actingAsStaffId` obrigatório no corpo, chamando a mesma função de service da variante JWT (seção 5.2) | Backoffice interno (5.2) |
| Branch `feat/event-institution-bloodbank-link` (PR #47) já mesclada em `develop`, mas não promovida a `main`; 2 violações de prettier introduzidas por ela ainda em `develop` | hemocione-digital-event | Promover `develop → main` quando for a hora, com um `yarn lint:fix` antes | Integração (7.2) — os campos `institutionId`/`bloodBanksLocationId` só existem em `develop` hoje |
| Criação de instituição (`POST /institutions`) tem `AUTO_APPROVE` hardcoded — todo cadastro nasce `validated`, apesar de existir fluxo de moderação (`listar_instituicoes_pendentes`/`validar_instituicao`) | hemocione-id | Inconsistência a resolver — decidir se a moderação deve voltar a valer ou se o fluxo de moderação hoje é vestigial | Não bloqueia esta iniciativa, mas afeta confiabilidade do cadastro de instituição que o portal vai expor |
| `subscription/index.post.ts` faz check-then-act sem lock atômico (`schedule.slots > schedule.occupiedSlots` checado contra leitura cacheada, depois salva e incrementa em separado — `server/services/subscription.ts:123-160`); o único `// todo` real do arquivo está em `deleteSubscription` (linha 181, caminho de *cancelamento*, não o de criação aqui descrito) | hemocione-digital-event | Trocar por `findOneAndUpdate` condicional (`occupiedSlots < slots`) antes de incrementar | **Bloqueador da Fase 4** — este projeto cria o funil que mais aumenta tráfego concorrente nesse path (grupo inteiro de uma instituição se inscrevendo no mesmo horário quando o link sai) |
| `acceptCollectionRequest` pula transação deliberadamente (`server/services/collectionRequest.ts:378-380`, comentário `// For development, we'll skip transactions... TODO: Implement proper transaction handling for production`) | hemocione-coleta | Implementar a transação antes de produção — o próprio código já sinaliza isso como pendência conhecida | Máquina de estados (3) — mais estados novos = mais transições concorrentes possíveis sobre o mesmo documento |
| Guard de solicitação duplicada (`createCollectionRequest`, `server/services/collectionRequest.ts:727`) só bloqueia nova solicitação se já existir uma com `status: "pending"` | hemocione-coleta | Estender o guard para também bloquear com `counter_proposed`, `awaiting_technical_visit`, `technical_visit_confirmed`, `accepted` | Máquina de estados (3) — sem isso, os estados novos reabrem silenciosamente um buraco que hoje só existe para `pending` |

## 10. Suposições assumidas — validar com o Guima

**Confirmado pelo Guima em 2026-08-13** (não são mais suposições abertas): a interpretação de "ao vivo" (3.5), o limite de 1 contraproposta por solicitação sem previsão de rodadas extras (3.3), o reaproveitamento de visita técnica sem prazo de validade (3.4), e o escopo de divulgação automática reduzido a "notificar em toda transição de etapa" com a automação de redes sociais internas ficando para uma fase futura (8).

O que ainda segue como suposição, sem confirmação explícita:

1. **Máquina de estados da seção 3.2** — sintetizada diretamente das notas originais; ainda não teve um "faz sentido" explícito ponto a ponto — é a peça mais crítica do documento, revisar com atenção antes da Fase 1.
2. **UI kit do portal novo (4.1)** — Element Plus recomendado por consistência com a maioria do ecossistema; não foi validado.
3. **Secret dedicado `COLETA_INTEGRATION_SECRET` (7.1)** é uma recomendação de boa prática, não uma característica pedida — poderia também reusar o `API_SECRET` do Lowcoder se preferir simplicidade a isolamento.
4. **Cookie SSO `Domain=.hemocione.com.br` (4.3)** e **backfill de `TechnicalVisit.institutionId` (3.4)** — ambos precisam de uma checagem rápida no código/dado real antes da Fase 1/2 começar; o documento assume os dois, mas nenhum foi confirmado contra o estado atual.

## 11. Ordem de implementação recomendada

1. Fase 0 (fundações) — nenhuma tem valor de produto sozinha, mas todas são baratas e destravam o resto.
2. Fase 1 (núcleo do domínio) — sem isso, nada do resto tem o que mostrar.
3. Fases 2 e 3 em paralelo (portal + backoffice interno compartilham a mesma UI-base, diferem só no escopo de instituições visíveis).
4. Fase 4 (integração com eventos) — só faz sentido depois que uma solicitação real consegue chegar a `technical_visit_confirmed`/`accepted`.
5. Fase 5 (divulgação) — incremento sobre a Fase 4, pode esperar um ciclo depois do lançamento das fases anteriores.

## 12. Revisões deste documento

Antes de virar plano de implementação, este documento passou por duas rodadas de revisão adversarial (pedir refutação, não aprovação — mesmo princípio usado nas duas):

- **Advisor de arquitetura (Fable)**, com o documento completo em mãos: confirmou a base factual (endpoint vazio, `AUTO_APPROVE` hardcoded, `isAdmin` fora do JWT, campos do PR #47 só em `develop`), e apontou os pontos mais importantes já incorporados acima — as duas race conditions pré-existentes tratadas como bloqueador de Fase 4, a falta de `scheduled → cancelled`, a fragilidade de `awaiting_technical_visit`, a integração síncrona da seção 7.2 redesenhada para orquestração idempotente, e as notas de fronteira de confiança em 4.5/5.
- **Verificação factual linha-a-linha** contra o código real dos três repos (grep/read, não opinião) — rodada com um subagente genérico porque o Codex apresentou uma falha de ambiente (sandbox de rede, `bwrap: loopback: Operation not permitted`) nas duas tentativas feitas; não foi possível usar a ferramenta pedida originalmente para esta etapa. Resultado: de ~20 afirmações factuais checadas (paths, linhas, comportamento de código, estado real da branch/PR #47 via git, violações de prettier), **19 confirmadas exatamente como escrito** e **1 corrigida** — a linha 260 citava um comentário `// todo` que na verdade está numa função diferente (`deleteSubscription`, caminho de cancelamento, não o de criação de inscrição criticado ali); já ajustada no texto.

Este documento reflete as correções já incorporadas; ele não substitui uma leitura humana antes da implementação começar — em especial a seção 10, que lista o que ainda é suposição.

- **Rodada de decisões de negócio (Guima, 2026-08-13):** confirmou o formato real do link de evento (7.4), o princípio de notificar em toda transição de etapa (6), e adicionou a feature de personalização do evento pela instituição (7.5). Reduziu o escopo da seção 8 (divulgação) para "notificação por etapa", movendo a automação de redes sociais internas para uma fase futura sem desenho técnico ainda.
- **Reaproveitamento do `hemocione-mcp` (Guima, 2026-08-13):** substituiu o desenho anterior do backoffice interno (seletor de organização ampliado + claim `isAdmin` no JWT) por extensão do catálogo `hemocione-mcp` já existente (seção 5) — verificado contra o código real do repo antes de escrever (padrão de `Service`, mecanismo de registro, estado atual do catálogo `coleta`, e a ausência de validação de corpo no proxy).
- **Terceira opção de visita técnica (Guima, 2026-08-13):** adicionou a possibilidade de declarar uma visita já realizada sem registro prévio (seção 3.4, opção 2) — o banco de sangue informa data e confirma que não precisa de nova visita; o sistema cria a `TechnicalVisit` retroativamente e segue o fluxo como reaproveitamento.
