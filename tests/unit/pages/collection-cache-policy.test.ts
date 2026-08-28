import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computed, reactive, defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";
import App from "~/app.vue";

const route = reactive<{ meta: { keepalive?: boolean } }>({
  meta: { keepalive: false },
});

vi.stubGlobal("useRoute", () => route);
vi.stubGlobal("computed", computed);
vi.stubGlobal("useRuntimeConfig", () => ({
  public: { siteUrl: "https://coleta.hemocione.com.br" },
}));
vi.stubGlobal("useHead", vi.fn());
vi.stubGlobal("useSeoMeta", vi.fn());

const NuxtPageStub = defineComponent({
  props: {
    keepalive: {
      type: Boolean,
      default: undefined,
    },
  },
  template:
    '<div data-testid="nuxt-page" :data-keepalive="String(keepalive)" />',
});

describe("política de cache das coletas", () => {
  it.each([
    { policy: false, expected: "false" },
    { policy: true, expected: "true" },
  ])("passa keepalive=$policy da rota para NuxtPage", ({ policy, expected }) => {
    route.meta.keepalive = policy;

    const wrapper = mount(App, {
      global: {
        stubs: {
          UApp: { template: "<div><slot /></div>" },
          NuxtLayout: { template: "<div><slot /></div>" },
          NuxtPage: NuxtPageStub,
        },
      },
    });

    expect(
      wrapper.find('[data-testid="nuxt-page"]').attributes("data-keepalive")
    ).toBe(expected);
  });

  it.each([
    "pages/[bloodbankSlug]/index.vue",
    "pages/[bloodbankSlug]/coletas/index.vue",
    "pages/[bloodbankSlug]/coletas/[requestId].vue",
    "pages/agendar/[bloodbankSlug]/index.vue",
    "pages/agendar/meus-agendamentos/index.vue",
    "pages/agendar/acompanhar/[token]/index.vue",
  ])("declara cache desativado em %s", (pagePath) => {
    const source = readFileSync(resolve(process.cwd(), pagePath), "utf8");

    expect(source).toMatch(/definePageMeta\([\s\S]*?keepalive:\s*false/);
  });
});
