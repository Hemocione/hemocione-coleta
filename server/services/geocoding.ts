import type { NitroFetchRequest } from "nitropack";

export interface GeocodeResult {
  cep: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

const BRASILAPI_URL = "https://brasilapi.com.br/api/cep/v2";
const VIACEP_URL = "https://viacep.com.br/ws";

async function fetchBrasilApi(cep: string): Promise<GeocodeResult> {
  const url = `${BRASILAPI_URL}/${cep.replace(/\D/g, "")}` as NitroFetchRequest;
  const data = await $fetch<any>(url);
  return {
    cep,
    address: [data.street, data.neighborhood, data.city]
      .filter(Boolean)
      .join(", "),
    city: data.city,
    state: data.state,
    latitude:
      typeof data.location?.coordinates?.latitude === "number"
        ? data.location.coordinates.latitude
        : undefined,
    longitude:
      typeof data.location?.coordinates?.longitude === "number"
        ? data.location.coordinates.longitude
        : undefined,
  };
}

async function fetchViaCep(cep: string): Promise<GeocodeResult> {
  const url = `${VIACEP_URL}/${cep.replace(
    /\D/g,
    ""
  )}/json/` as NitroFetchRequest;
  const data = await $fetch<any>(url);
  return {
    cep,
    address: [data.logradouro, data.bairro].filter(Boolean).join(", "),
    city: data.localidade,
    state: data.uf,
  };
}

export async function geocodeCep(cep: string): Promise<GeocodeResult> {
  try {
    const result = await Promise.race([fetchBrasilApi(cep), fetchViaCep(cep)]);
    return result;
  } catch (e) {
    // fallback sequentially
    try {
      return await fetchBrasilApi(cep);
    } catch (e2) {
      return await fetchViaCep(cep);
    }
  }
}
