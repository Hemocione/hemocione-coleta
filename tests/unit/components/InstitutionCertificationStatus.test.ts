import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import InstitutionCertificationStatus from "~/components/InstitutionCertificationStatus.vue";

const globalStubs = {
  UBadge: {
    name: "UBadge",
    props: ["color", "variant", "size", "icon"],
    template: '<span data-testid="certification-badge"><slot /></span>',
  },
  UButton: {
    name: "UButton",
    inheritAttrs: false,
    props: {
      as: String,
      color: String,
      variant: String,
      size: String,
      icon: String,
      external: Boolean,
      href: String,
      target: String,
      rel: String,
    },
    template:
      '<a v-bind="$attrs" :href="href" :target="target" :rel="rel"><slot /></a>',
  },
};

function mountStatus(
  props: {
    certificationStatus?: "none" | "in_progress" | "certified";
    hasCollectionBadge?: boolean;
    showCta?: boolean;
  } = {}
) {
  return mount(InstitutionCertificationStatus, {
    props,
    global: { stubs: globalStubs },
  });
}

describe("InstitutionCertificationStatus", () => {
  it("mostra o selo para uma instituição certificada", () => {
    const wrapper = mountStatus({
      certificationStatus: "certified",
      hasCollectionBadge: true,
    });

    expect(wrapper.get('[data-testid="institution-certification-status"]').text()).toContain(
      "Instituição Certificada"
    );
    expect(wrapper.getComponent({ name: "UBadge" }).props()).toMatchObject({
      color: "success",
      variant: "solid",
      size: "sm",
      icon: "i-lucide-badge-check",
    });
    expect(wrapper.find('[data-testid="institution-certification-cta"]').exists()).toBe(
      false
    );
  });

  it("mostra o estado de certificação em andamento", () => {
    const wrapper = mountStatus({ certificationStatus: "in_progress" });

    expect(wrapper.text()).toContain("Certificação em andamento");
    expect(wrapper.getComponent({ name: "UBadge" }).props()).toMatchObject({
      color: "warning",
      variant: "subtle",
      size: "sm",
      icon: "i-lucide-clock-3",
    });
    expect(wrapper.find('[data-testid="institution-certification-cta"]').exists()).toBe(
      false
    );
  });

  it("mostra o CTA de certificação quando o processo não foi iniciado", () => {
    const wrapper = mountStatus({ certificationStatus: "none", showCta: true });
    const cta = wrapper.get('[data-testid="institution-certification-cta"]');
    const ctaButton = wrapper.getComponent({ name: "UButton" });

    expect(cta.text()).toBe("Iniciar processo de certificação");
    expect(ctaButton.props()).toMatchObject({
      as: "a",
      color: "primary",
      variant: "soft",
      size: "xs",
      icon: "i-lucide-arrow-up-right",
      external: true,
    });
    expect(cta.attributes("href")).toBe("https://instituicoes.hemocione.com.br");
    expect(cta.attributes("target")).toBe("_blank");
    expect(cta.attributes("rel")).toBe("noopener noreferrer");
  });

  it("mostra somente o indicador neutro sem CTA", () => {
    const wrapper = mountStatus({ certificationStatus: "none" });

    expect(wrapper.text()).toContain("Certificação não iniciada");
    expect(wrapper.getComponent({ name: "UBadge" }).props()).toMatchObject({
      color: "neutral",
      variant: "subtle",
      size: "sm",
      icon: "i-lucide-circle-help",
    });
    expect(wrapper.find('[data-testid="institution-certification-cta"]').exists()).toBe(
      false
    );
  });
});
