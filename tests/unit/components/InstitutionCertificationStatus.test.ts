import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import InstitutionCertificationStatus from "~/components/InstitutionCertificationStatus.vue";

const globalStubs = {
  UIcon: {
    props: ["name"],
    template: '<span data-testid="certification-icon" :data-icon="name" />',
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
    expect(wrapper.find('[data-testid="certification-icon"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="institution-certification-cta"]').exists()).toBe(
      false
    );
  });

  it("mostra o estado de certificação em andamento", () => {
    const wrapper = mountStatus({ certificationStatus: "in_progress" });

    expect(wrapper.text()).toContain("Certificação em andamento");
    expect(wrapper.find('[data-testid="institution-certification-cta"]').exists()).toBe(
      false
    );
  });

  it("mostra o CTA de certificação quando o processo não foi iniciado", () => {
    const wrapper = mountStatus({ certificationStatus: "none", showCta: true });
    const cta = wrapper.get('[data-testid="institution-certification-cta"]');

    expect(cta.text()).toBe("Iniciar processo de certificação");
    expect(cta.attributes("href")).toBe("https://instituicoes.hemocione.com.br");
    expect(cta.attributes("target")).toBe("_blank");
    expect(cta.attributes("rel")).toBe("noopener noreferrer");
  });

  it("mostra somente o indicador neutro sem CTA", () => {
    const wrapper = mountStatus({ certificationStatus: "none" });

    expect(wrapper.text()).toContain("Certificação não iniciada");
    expect(wrapper.find('[data-testid="institution-certification-cta"]').exists()).toBe(
      false
    );
  });
});
