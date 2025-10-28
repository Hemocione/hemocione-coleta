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
  const url = `${BRASILAPI_URL}/${cep.replace(/\D/g, "")}`;
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
        : typeof data.location?.coordinates?.latitude === "string"
        ? parseFloat(data.location.coordinates.latitude)
        : undefined,
    longitude:
      typeof data.location?.coordinates?.longitude === "number"
        ? data.location.coordinates.longitude
        : typeof data.location?.coordinates?.longitude === "string"
        ? parseFloat(data.location.coordinates.longitude)
        : undefined,
  };
}

async function fetchViaCep(cep: string): Promise<GeocodeResult> {
  const url = `${VIACEP_URL}/${cep.replace(/\D/g, "")}/json/`;
  const data = await $fetch<any>(url);
  return {
    cep,
    address: [data.logradouro, data.bairro].filter(Boolean).join(", "),
    city: data.localidade,
    state: data.uf,
  };
}

export async function geocodeCep(cep: string): Promise<GeocodeResult> {
  const [brResult, viaResult] = await Promise.allSettled([
    fetchBrasilApi(cep),
    fetchViaCep(cep),
  ]);

  const tryGet = (res: PromiseSettledResult<GeocodeResult>) =>
    res.status === "fulfilled" ? res.value : undefined;

  const br = tryGet(brResult);
  const vc = tryGet(viaResult);

  // Prefer result with coordinates
  if (
    br &&
    typeof br.latitude === "number" &&
    typeof br.longitude === "number"
  ) {
    return br;
  }
  if (
    vc &&
    typeof vc.latitude === "number" &&
    typeof vc.longitude === "number"
  ) {
    return vc;
  }
  // Merge best fields
  const merged: GeocodeResult = {
    cep,
    address: br?.address || vc?.address,
    city: br?.city || vc?.city,
    state: br?.state || vc?.state,
    latitude: br?.latitude || vc?.latitude,
    longitude: br?.longitude || vc?.longitude,
  };
  if (!merged.address && !merged.city && !merged.state) {
    // Fallback: throw to signal failure
    throw new Error("Failed to geocode CEP");
  }
  return merged;
}
