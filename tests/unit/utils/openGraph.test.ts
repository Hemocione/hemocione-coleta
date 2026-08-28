import { describe, expect, it } from "vitest";
import { getOpenGraphMetadata } from "~/utils/openGraph";

const SITE_URL = "https://coleta.hemocione.com.br";

describe("getOpenGraphMetadata", () => {
  it("uses the scheduling image for the /agendar root route", () => {
    const metadata = getOpenGraphMetadata("/agendar", SITE_URL);

    expect(metadata).toMatchObject({
      imageUrl: `${SITE_URL}/og-images/agendar.jpg?v=2`,
      canonicalUrl: `${SITE_URL}/agendar`,
    });
  });

  it("uses the scheduling image for the /agendar root route with a slash", () => {
    const metadata = getOpenGraphMetadata("/agendar/", SITE_URL);

    expect(metadata).toMatchObject({
      imageUrl: `${SITE_URL}/og-images/agendar.jpg?v=2`,
      canonicalUrl: `${SITE_URL}/agendar/`,
    });
  });

  it("uses the scheduling image for every route inside /agendar", () => {
    const metadata = getOpenGraphMetadata(
      "/agendar/acompanhar/request-token?from=whatsapp",
      SITE_URL
    );

    expect(metadata).toMatchObject({
      title: "Agende uma coleta de sangue",
      imageUrl: `${SITE_URL}/og-images/agendar.jpg?v=2`,
      canonicalUrl: `${SITE_URL}/agendar/acompanhar/request-token`,
      imageWidth: 1200,
      imageHeight: 630,
      imageType: "image/jpeg",
    });
  });

  it("uses the blood center image for the dynamic blood center root route", () => {
    const metadata = getOpenGraphMetadata("/hemocentro-central", SITE_URL);

    expect(metadata).toMatchObject({
      imageUrl: `${SITE_URL}/og-images/hemocentro.jpg?v=2`,
      canonicalUrl: `${SITE_URL}/hemocentro-central`,
    });
  });

  it("uses the blood center image for every dynamic blood center route", () => {
    const metadata = getOpenGraphMetadata(
      "/hemocentro-central/calendario/configuracao-massa",
      SITE_URL
    );

    expect(metadata).toMatchObject({
      title: "Gestão do seu hemocentro",
      imageUrl: `${SITE_URL}/og-images/hemocentro.jpg?v=2`,
      canonicalUrl: `${SITE_URL}/hemocentro-central/calendario/configuracao-massa`,
    });
  });

  it("does not assign a group image to unrelated public routes", () => {
    expect(getOpenGraphMetadata("/termo/access-token", SITE_URL)).toBeNull();
    expect(getOpenGraphMetadata("/sem-acesso", SITE_URL)).toBeNull();
    expect(getOpenGraphMetadata("/", SITE_URL)).toBeNull();
  });
});
