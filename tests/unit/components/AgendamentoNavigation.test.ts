import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AgendamentoNavigation from "~/components/AgendamentoNavigation.vue";

const globalStubs = {
  NuxtLink: {
    inheritAttrs: false,
    props: {
      to: {
        type: String,
        required: true,
      },
    },
    template: '<a :href="to" v-bind="$attrs"><slot /></a>',
  },
  UButton: {
    inheritAttrs: false,
    emits: ["click"],
    template:
      '<button type="button" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>',
  },
};

function mountNavigation(isLoggedIn = true) {
  return mount(AgendamentoNavigation, {
    props: {
      isLoggedIn,
      firstName: "Ana",
    },
    global: {
      stubs: globalStubs,
    },
  });
}

describe("AgendamentoNavigation", () => {
  it("exposes Agendar at the public root alongside the appointments link", () => {
    const wrapper = mountNavigation();

    const agendarLinks = wrapper.findAll('[data-testid="agendar-link"]');

    expect(agendarLinks).toHaveLength(1);
    expect(agendarLinks[0].attributes("href")).toBe("/agendar");
    expect(
      wrapper.find('[data-testid="meus-agendamentos-link"]').attributes("href")
    ).toBe("/agendar/meus-agendamentos");
  });

  it("opens a mobile menu with both scheduling destinations and closes after navigation", async () => {
    const wrapper = mountNavigation();
    const trigger = wrapper.find('[data-testid="mobile-menu-trigger"]');

    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.attributes("aria-label")).toBe("Abrir menu");

    await trigger.trigger("click");

    expect(trigger.attributes("aria-expanded")).toBe("true");
    expect(trigger.attributes("aria-label")).toBe("Fechar menu");
    expect(trigger.attributes("aria-controls")).toBe("agendamento-mobile-menu");

    const mobileMenu = wrapper.find('[data-testid="mobile-menu"]');
    expect(mobileMenu.exists()).toBe(true);
    expect(mobileMenu.find('[data-testid="agendar-link"]').attributes("href")).toBe(
      "/agendar"
    );
    expect(
      mobileMenu.find('[data-testid="meus-agendamentos-link"]').attributes("href")
    ).toBe("/agendar/meus-agendamentos");

    await mobileMenu.find('[data-testid="agendar-link"]').trigger("click");

    expect(wrapper.find('[data-testid="mobile-menu"]').exists()).toBe(false);
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });

  it("does not show institutional appointments to logged-out users", async () => {
    const wrapper = mountNavigation(false);

    expect(wrapper.find('[data-testid="meus-agendamentos-link"]').exists()).toBe(
      false
    );

    await wrapper.find('[data-testid="mobile-menu-trigger"]').trigger("click");

    const mobileMenu = wrapper.find('[data-testid="mobile-menu"]');
    expect(mobileMenu.find('[data-testid="meus-agendamentos-link"]').exists()).toBe(
      false
    );

    const loginButton = mobileMenu
      .findAll("button")
      .find((button) => button.text() === "Entrar");
    expect(loginButton).toBeDefined();
    await loginButton!.trigger("click");

    expect(wrapper.emitted("login")).toHaveLength(1);
    expect(wrapper.find('[data-testid="mobile-menu"]').exists()).toBe(false);
  });

  it("closes the mobile menu with Escape", async () => {
    const wrapper = mountNavigation();
    const trigger = wrapper.find('[data-testid="mobile-menu-trigger"]');

    await trigger.trigger("click");
    await wrapper.find("nav").trigger("keydown", { key: "Escape" });

    expect(wrapper.find('[data-testid="mobile-menu"]').exists()).toBe(false);
    expect(trigger.attributes("aria-expanded")).toBe("false");
  });
});
