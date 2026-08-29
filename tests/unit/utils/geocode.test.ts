import { beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeCep } from "~/utils/geocode";

const fetchMock = vi.hoisted(() => vi.fn());

vi.stubGlobal("$fetch", fetchMock);

describe("geocodeCep", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("brasilapi.com.br")) {
        return Promise.resolve({
          street: "Rua Santa Justina",
          neighborhood: "Vila Olímpia",
          city: "São Paulo",
          state: "SP",
          location: {
            coordinates: {
              latitude: "-23.5475",
              longitude: "-46.63611",
            },
          },
        });
      }

      return Promise.resolve({
        logradouro: "Rua Santa Justina",
        bairro: "Vila Olímpia",
        localidade: "São Paulo",
        uf: "SP",
      });
    });
  });

  it("keeps city and state in their own fields", async () => {
    await expect(geocodeCep("04545-042")).resolves.toEqual({
      cep: "04545-042",
      address: "Rua Santa Justina, Vila Olímpia",
      city: "São Paulo",
      state: "SP",
      latitude: -23.5475,
      longitude: -46.63611,
    });
  });
});
