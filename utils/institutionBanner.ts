import {
  INSTITUTION_IMAGE_MIME_TYPES,
  validateInstitutionImageData,
} from "./institutionImage";

export { isHemocioneCdnUrl } from "./institutionImage";

export const MAX_INSTITUTION_BANNER_BYTES = 4 * 1024 * 1024;
export const INSTITUTION_BANNER_MIME_TYPES = INSTITUTION_IMAGE_MIME_TYPES;

type InstitutionBannerMimeType =
  (typeof INSTITUTION_BANNER_MIME_TYPES)[number];

export function validateInstitutionBannerData(
  data: Uint8Array,
  declaredMimeType: string
) {
  return validateInstitutionImageData(data, declaredMimeType, {
    maxBytes: MAX_INSTITUTION_BANNER_BYTES,
    maxSizeMessage: "O banner deve ter no máximo 4 MB.",
    invalidMimeTypeMessage: "O banner deve ser um arquivo PNG ou JPEG.",
    dimensionsMessage: "Não foi possível ler as dimensões do banner.",
  }) as { mimeType: InstitutionBannerMimeType; width: number; height: number };
}
