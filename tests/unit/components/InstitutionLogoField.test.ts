import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstitutionLogoField from "~/components/InstitutionLogoField.vue";

const mocks = vi.hoisted(() => ({
  fetchWithAuth: vi.fn(),
  userStore: { token: "jwt-token" as string | null },
}));

vi.mock("~/composables/useFetchWithAuth", () => ({
  fetchWithAuth: mocks.fetchWithAuth,
}));
vi.mock("~/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

let imageDimensions = { width: 512, height: 512 };

class FakeImage {
  width = imageDimensions.width;
  height = imageDimensions.height;
  naturalWidth = imageDimensions.width;
  naturalHeight = imageDimensions.height;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

const validPng = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
]);

beforeEach(() => {
  imageDimensions = { width: 512, height: 512 };
  mocks.userStore.token = "jwt-token";
  mocks.fetchWithAuth.mockReset();
  mocks.fetchWithAuth.mockResolvedValue({
    url: "https://cdn.hemocione.com.br/events/dev/uploads/users/logo.png",
  });
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:logo"),
    revokeObjectURL: vi.fn(),
  });
});

describe("InstitutionLogoField", () => {
  it("uploads a selected square image and emits the CDN URL", async () => {
    const wrapper = mount(InstitutionLogoField, {
      props: { modelValue: null },
      global: {
        stubs: {
          UIcon: true,
          UButton: { template: "<button><slot /></button>" },
        },
      },
    });
    const input = wrapper.get('[data-testid="institution-logo-input"]');
    const file = new File([validPng], "logo.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file] });

    await input.trigger("change");

    expect(mocks.fetchWithAuth).toHaveBeenCalledWith(
      "/api/v1/me/institutions/logo",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "https://cdn.hemocione.com.br/events/dev/uploads/users/logo.png",
    ]);
  });

  it("shows the square and size requirements", () => {
    const wrapper = mount(InstitutionLogoField, {
      props: { modelValue: null },
      global: {
        stubs: {
          UIcon: true,
          UButton: { template: "<button><slot /></button>" },
        },
      },
    });

    expect(wrapper.text()).toContain("PNG ou JPEG");
    expect(wrapper.text()).toContain("quadrada");
    expect(wrapper.text()).toContain("2 MB");
  });

  it("rejects a non-square image before calling the upload endpoint", async () => {
    imageDimensions = { width: 512, height: 256 };
    const wrapper = mount(InstitutionLogoField, {
      props: { modelValue: null },
      global: {
        stubs: {
          UIcon: true,
          UButton: { template: "<button><slot /></button>" },
        },
      },
    });
    const input = wrapper.get('[data-testid="institution-logo-input"]');
    const file = new File([validPng], "logo.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file] });

    await input.trigger("change");

    expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("A logo deve ser quadrada");
  });

  it("does not upload a file after logout", async () => {
    mocks.userStore.token = null;
    const wrapper = mount(InstitutionLogoField, {
      props: { modelValue: null },
      global: {
        stubs: {
          UIcon: true,
          UButton: { template: "<button><slot /></button>" },
        },
      },
    });
    const input = wrapper.get('[data-testid="institution-logo-input"]');
    const file = new File([validPng], "logo.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file] });

    await input.trigger("change");

    expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Entre para enviar a logo");
  });
});
