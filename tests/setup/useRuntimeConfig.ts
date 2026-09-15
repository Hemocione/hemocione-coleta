import { vi } from "vitest";

vi.stubGlobal("useRuntimeConfig", () => ({
  public: {
    bugsnagApiKey: "",
    authCookieKey: "devHemocioneId",
    hemocioneIdApiUrl: "https://hemocione-id-dev.cpt.hemocione.com.br",
    hemocioneIdUrl: "https://id.d.hemocione.com.br",
    eventosHemocione: "https://eventos.d.hemocione.com.br/",
    institutionsUrl: "https://instituicoes.d.hemocione.com.br",
    siteUrl: "http://localhost:3000",
  },
  hemocioneIdJwtSecretKey: "secret",
  hemocioneIdIntegrationSecret: "secret",
  hemocioneDigitalEventUrl: "https://eventos.d.hemocione.com.br",
  coletaIntegrationSecret: "secret",
  ondedoarApiUrl: "",
  discordBloodBankInterestWebhookUrl: "",
}));
