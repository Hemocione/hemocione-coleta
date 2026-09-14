import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InstitutionBannerField from "~/components/InstitutionBannerField.vue";

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

let imageDimensions = { width: 1600, height: 400 };

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
  imageDimensions = { width: 1600, height: 400 };
  mocks.userStore.token = "jwt-token";
  mocks.fetchWithAuth.mockReset();
  mocks.fetchWithAuth.mockResolvedValue({
    url: "https://cdn.hemocione.com.br/events/dev/uploads/users/banner.png",
  });
  vi.stubGlobal("Image", FakeImage);
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:banner"),
    revokeObjectURL: vi.fn(),
  });
});

function mountBanner() {
  return mount(InstitutionBannerField, {
    props: { modelValue: null },
    global: {
      stubs: {
        UIcon: true,
        UButton: { template: "<button><slot /></button>" },
      },
    },
  });
}

describe("InstitutionBannerField", () => {
  it("uploads a wide image and emits the CDN URL", async () => {
    const wrapper = mountBanner();
    const input = wrapper.get('[data-testid="institution-banner-input"]');
    const file = new File([validPng], "banner.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file] });

    await input.trigger("change");

    expect(mocks.fetchWithAuth).toHaveBeenCalledWith(
      "/api/v1/me/institutions/banner",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) })
    );
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "https://cdn.hemocione.com.br/events/dev/uploads/users/banner.png",
    ]);
  });

  it("shows banner image requirements without requiring a square image", async () => {
    imageDimensions = { width: 512, height: 256 };
    const wrapper = mountBanner();
    const input = wrapper.get('[data-testid="institution-banner-input"]');
    const file = new File([validPng], "banner.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file] });

    await input.trigger("change");

    expect(wrapper.text()).toContain("PNG ou JPEG");
    expect(wrapper.text()).toContain("banner");
    expect(wrapper.text()).toContain("4 MB");
    expect(mocks.fetchWithAuth).toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("deve ser quadrada");
  });

  it("does not upload a file after logout", async () => {
    mocks.userStore.token = null;
    const wrapper = mountBanner();
    const input = wrapper.get('[data-testid="institution-banner-input"]');
    const file = new File([validPng], "banner.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file] });

    await input.trigger("change");

    expect(mocks.fetchWithAuth).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Entre para enviar o banner");
  });
});
