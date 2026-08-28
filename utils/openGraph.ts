export interface OpenGraphMetadata {
  title: string;
  description: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  imageType: "image/jpeg";
  imageUrl: string;
  canonicalUrl: string;
  siteName: "Hemocione Coleta";
}

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const SITE_NAME = "Hemocione Coleta" as const;
const RESERVED_FIRST_SEGMENTS = new Set([
  "agendar",
  "api",
  "favicon.ico",
  "sem-acesso",
  "termo",
]);

function normalizeSiteUrl(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

function buildImageMetadata(
  pathname: string,
  siteUrl: string,
  variant: "schedule" | "bloodbank"
): OpenGraphMetadata {
  const isSchedule = variant === "schedule";
  const imagePath = isSchedule
    ? "/og-images/agendar.jpg"
    : "/og-images/hemocentro.jpg";
  const baseUrl = normalizeSiteUrl(siteUrl);
  const canonicalUrl = new URL(pathname || "/", `${baseUrl}/`).toString();

  return {
    title: isSchedule
      ? "Agende uma coleta de sangue"
      : "Gestão do seu hemocentro",
    description: isSchedule
      ? "Encontre um hemocentro e escolha as melhores datas para a coleta da sua instituição."
      : "Organize agenda, equipes e solicitações de coleta em um só lugar.",
    imageAlt: isSchedule
      ? "Calendário, gota de sangue e células vermelhas em uma composição editorial."
      : "Painel de agenda, mapa e gota de sangue para gestão de um hemocentro.",
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    imageType: "image/jpeg",
    imageUrl: new URL(imagePath, `${baseUrl}/`).toString(),
    canonicalUrl,
    siteName: SITE_NAME,
  };
}

export function getOpenGraphMetadata(
  pathname: string,
  siteUrl: string
): OpenGraphMetadata | null {
  const normalizedPathname = pathname.split("?")[0] || "/";

  if (
    normalizedPathname === "/agendar" ||
    normalizedPathname.startsWith("/agendar/")
  ) {
    return buildImageMetadata(normalizedPathname, siteUrl, "schedule");
  }

  const firstSegment = normalizedPathname.split("/")[1];
  if (firstSegment && !RESERVED_FIRST_SEGMENTS.has(firstSegment)) {
    return buildImageMetadata(normalizedPathname, siteUrl, "bloodbank");
  }

  return null;
}
