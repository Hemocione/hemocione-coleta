import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUserStore } from "~/stores/user";

const mocks = vi.hoisted(() => ({
  cookie: { value: "token-salvo" as string | null },
  redirectToID: vi.fn(),
}));

vi.mock("~/utils/redirectToID", () => ({
  redirectToID: mocks.redirectToID,
}));

beforeEach(() => {
  setActivePinia(createPinia());
  mocks.cookie.value = "token-salvo";
  mocks.redirectToID.mockReset();
  vi.stubGlobal("useCookie", vi.fn(() => mocks.cookie));
  vi.stubGlobal("useRoute", () => ({ fullPath: "/agendar" }));
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { authCookieKey: "auth-cookie" },
  }));
});

describe("store de usuário", () => {
  it("limpa user, token e cookie antes do redirecionamento no logout", async () => {
    const userStore = useUserStore();
    userStore.setUser({
      id: "user-1",
      givenName: "Teste",
      surName: "Usuário",
      bloodType: "O+",
      email: "teste@example.test",
      phone: "11999999999",
      document: "00000000000",
      birthDate: "1990-01-01",
      bloodBankRoles: [],
    });
    userStore.setToken("token-salvo");
    mocks.redirectToID.mockImplementation(() => {
      expect(userStore.user).toBeNull();
      expect(userStore.token).toBeNull();
      expect(mocks.cookie.value).toBeNull();
      return Promise.resolve();
    });

    await userStore.logOut();

    expect(userStore.user).toBeNull();
    expect(userStore.token).toBeNull();
    expect(mocks.cookie.value).toBeNull();
    expect(mocks.redirectToID).toHaveBeenCalledWith("/agendar");
  });
});
