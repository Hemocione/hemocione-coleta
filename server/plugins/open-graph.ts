import { getRequestURL } from "h3";
import { getPublicBaseUrl } from "~/utils/publicUrl";
import { getOpenGraphMetadata } from "~/utils/openGraph";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] || character
  );
}

function renderMeta(name: string, content: string): string {
  return `<meta name="${name}" content="${escapeHtml(content)}">`;
}

function renderProperty(property: string, content: string): string {
  return `<meta property="${property}" content="${escapeHtml(content)}">`;
}

function renderOpenGraphTags(metadata: ReturnType<typeof getOpenGraphMetadata>) {
  if (!metadata) return [];

  return [
    renderProperty("og:title", metadata.title),
    renderProperty("og:description", metadata.description),
    renderProperty("og:type", "website"),
    renderProperty("og:url", metadata.canonicalUrl),
    renderProperty("og:site_name", metadata.siteName),
    renderProperty("og:image", metadata.imageUrl),
    renderProperty("og:image:url", metadata.imageUrl),
    renderProperty("og:image:secure_url", metadata.imageUrl),
    renderProperty("og:image:type", metadata.imageType),
    renderProperty("og:image:width", String(metadata.imageWidth)),
    renderProperty("og:image:height", String(metadata.imageHeight)),
    renderProperty("og:image:alt", metadata.imageAlt),
    renderMeta("twitter:card", "summary_large_image"),
    renderMeta("twitter:title", metadata.title),
    renderMeta("twitter:description", metadata.description),
    renderMeta("twitter:image", metadata.imageUrl),
    `<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}">`,
  ];
}

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("render:html", (html, { event }) => {
    const metadata = getOpenGraphMetadata(
      getRequestURL(event).pathname,
      getPublicBaseUrl()
    );

    html.head.push(...renderOpenGraphTags(metadata));
  });
});
