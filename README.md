# 🩸 Hemocione Coleta

Sistema de agendamento de coletas de sangue do [Hemocione](https://hemocione.com.br), desenvolvido com Nuxt 3. Permite que instituições solicitem visitas de coleta a hemocentros próximos, e que os próprios hemocentros gerenciem sua agenda, equipes, coberturas geográficas e restrições de doação.

---

## 📋 Índice

- [Sobre o projeto](#-sobre-o-projeto)
- [Tecnologias](#-tecnologias)
- [Pré-requisitos](#-pré-requisitos)
- [Configuração e instalação](#-configuração-e-instalação)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Executando localmente](#-executando-localmente)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)

---

## 🔍 Sobre o projeto

O **Hemocione Coleta** é uma aplicação web full-stack que conecta instituições (empresas, universidades etc.) a hemocentros para facilitar o agendamento de coletas externas de sangue.

### Funcionalidades principais

**Para instituições (área pública `/agendar`):**
- Localiza hemocentros ativos próximos com base na geolocalização
- Exibe restrições de doação configuradas pelo hemocentro
- Permite solicitar datas disponíveis com até 3 opções de preferência
- Acompanha o status da solicitação (pendente, aceita, rejeitada)

**Para hemocentros (área administrativa autenticada):**
- Calendário de datas disponíveis e slots de horário
- Gerenciamento de equipes de coleta
- Definição de área de cobertura geográfica (polígono no mapa)
- Lista de restrições personalizáveis para doadores
- Gestão completa das solicitações de coleta (aceitar/rejeitar com justificativa)
- Dashboard com visão geral das solicitações

A autenticação é feita via **Hemocione ID**, o sistema SSO centralizado do Hemocione.

---

## 🛠 Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework principal | [Nuxt 3](https://nuxt.com) (Vue 3, SSR desabilitado — SPA) |
| Linguagem | TypeScript |
| UI | [@nuxt/ui](https://ui.nuxt.com) (v3) + [Tailwind CSS](https://tailwindcss.com) v4 |
| Estado global | [Pinia](https://pinia.vuejs.org) |
| Banco de dados | [MongoDB](https://www.mongodb.com) via [Mongoose](https://mongoosejs.com) |
| Mapas | [MapLibre GL](https://maplibre.org) + [Mapbox GL Draw](https://github.com/mapbox/mapbox-gl-draw) |
| Geocodificação | [@turf/turf](https://turfjs.org) |
| Validação | [Zod](https://zod.dev) |
| Datas | [Day.js](https://day.js.org) |
| Autenticação | JWT via Hemocione ID |
| Monitoramento de erros | [Bugsnag](https://www.bugsnag.com) |
| Testes E2E | [Playwright](https://playwright.dev) |
| Deploy | [Vercel](https://vercel.com) |

---

## ✅ Pré-requisitos

- **Node.js** v22 (recomendado: use [`nvm`](https://github.com/nvm-sh/nvm) e rode `nvm use`)
- **Yarn** (gerenciador de pacotes)
- **MongoDB** v8+ (local ou remoto)
- **Docker** e **Docker Compose** (opcional, para rodar o MongoDB em container)
- Conta no GitHub com acesso ao repositório
- Acesso ao ambiente Hemocione ID para autenticação

---

## ⚙️ Configuração e instalação

### 1. Clone o repositório

```bash
git clone https://github.com/hemocione/hemocione-coleta.git
cd hemocione-coleta
```

### 2. Use a versão correta do Node

```bash
nvm use
```

### 3. Instale as dependências

```bash
yarn install
```

### 4. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com base nas variáveis descritas na seção [Variáveis de ambiente](#-variáveis-de-ambiente).

### 5. Suba o MongoDB (se for usar local com Docker)

```bash
docker-compose up -d
```

---

## 🔐 Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto. Abaixo estão todas as variáveis suportadas:

```env
# === Banco de dados ===
# URI de conexão com o MongoDB
MONGO_URI=mongodb://localhost:27017/coleta?authSource=admin&directConnection=true

# Nome do banco de dados
DB_NAME=coleta

# === Autenticação ===
# Segredo genérico para uso interno
SECRET=dev-secret

# Chave do cookie de autenticação do Hemocione ID
HEMOCIONE_AUTH_COOKIE_KEY=devHemocioneId

# Chave secreta do JWT do Hemocione ID (para verificação de tokens)
HEMOCIONE_ID_JWT_SECRET_KEY=secret

# Segredo de integração com o Hemocione ID
HEMOCIONE_ID_INTEGRATION_SECRET=secret

# === URLs de serviços ===
# API do Hemocione ID (validação de tokens e dados do usuário)
HEMOCIONE_ID_API_URL=https://hemocione-id-dev.cpt.hemocione.com.br

# URL do portal do Hemocione ID (redirecionamento de login)
HEMOCIONE_ID_URL=https://id.d.hemocione.com.br

# URL do sistema de eventos do Hemocione
EVENTOS_HEMOCIONE=https://eventos.d.hemocione.com.br/

# === Monitoramento ===
# API Key do Bugsnag para rastreamento de erros (deixe em branco para desabilitar)
BUGSNAG_API_KEY=
```

> **Nota:** As variáveis sem valor padrão marcado como obrigatórias devem ser configuradas para o funcionamento completo da aplicação. Para desenvolvimento local, os valores padrão embutidos no `nuxt.config.ts` já cobrem o básico.

---

## 🚀 Executando localmente

### Servidor de desenvolvimento

```bash
yarn dev
```

A aplicação estará disponível em `http://localhost:3000`.

### Build de produção

```bash
yarn build
```

### Preview do build

```bash
yarn preview
```

### Gerar site estático

```bash
yarn generate
```

---

## 📁 Estrutura do projeto

```
hemocione-coleta/
├── app.vue                  # Componente raiz da aplicação
├── nuxt.config.ts           # Configuração principal do Nuxt
├── docker-compose.yaml      # MongoDB local via Docker
├── playwright.config.ts     # Configuração dos testes E2E
│
├── assets/                  # CSS global, temas e estilos
├── composables/             # Composables Vue (ex: useFetchWithAuth)
├── layouts/                 # Layouts de página (default, agendamento)
├── middleware/              # Guards de rota client-side
├── pages/                   # Rotas da aplicação (file-based routing)
│   ├── [bloodbankSlug]/     # Área administrativa do hemocentro
│   │   ├── index.vue        #   Dashboard
│   │   ├── calendario/      #   Calendário de datas disponíveis
│   │   ├── coletas/         #   Solicitações de coleta
│   │   ├── cobertura/       #   Área de cobertura (mapa)
│   │   ├── equipes/         #   Gerenciamento de equipes
│   │   └── restricoes/      #   Restrições de doação
│   └── agendar/             # Área pública de agendamento
│       ├── index.vue        #   Busca de hemocentros próximos
│       └── [bloodbankSlug]/ #   Fluxo de solicitação de coleta
│
├── plugins/                 # Plugins Nuxt (auth, iframe control)
├── public/                  # Arquivos estáticos
├── scripts/                 # Scripts utilitários
├── stores/                  # Stores Pinia (user, bloodbank, scheduling)
├── types/                   # Definições de tipos TypeScript
├── utils/                   # Funções auxiliares (datas, geocodificação, etc.)
│
└── server/                  # Backend Nuxt (Nitro)
    ├── api/                 # Endpoints REST
    │   ├── v1/              #   API pública/autenticada
    │   │   ├── bloodbank/   #     Gestão de hemocentros
    │   │   ├── bloodbanks/  #     Listagem e busca por localização
    │   │   ├── institutions/#     Instituições e solicitações
    │   │   └── me/          #     Dados do usuário autenticado
    │   └── backoffice/      #   Operações internas
    ├── middleware/          # Middleware de autenticação server-side
    ├── models/              # Modelos Mongoose (BloodBank, CollectionRequest, etc.)
    ├── plugins/             # Plugin de conexão com MongoDB
    ├── services/            # Lógica de negócio (auth, agendamento, geocoding...)
    └── types.d.ts           # Tipos do servidor
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Siga os passos abaixo:

1. Faça um fork do repositório
2. Crie uma branch descritiva:
   ```bash
   git checkout -b feat/minha-funcionalidade
   ```
3. Implemente suas alterações seguindo o estilo do código existente (TypeScript, Composition API, Zod para validações)
4. Certifique-se de que o build não quebra:
   ```bash
   yarn build
   ```
5. Abra um Pull Request descrevendo o que foi feito e por quê

### Convenção de commits

Use o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

- `feat:` nova funcionalidade
- `fix:` correção de bug
- `docs:` documentação
- `refactor:` refatoração sem mudança de comportamento
- `chore:` tarefas auxiliares (configs, deps)

---

## 📄 Licença

Este projeto é mantido pelo time do [Hemocione](https://hemocione.com.br). Consulte o repositório para informações sobre licenciamento.

---

<div align="center">
  Feito com ❤️ pelo time Hemocione para salvar vidas 🩸
</div>
