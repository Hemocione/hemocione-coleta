import {
  INSTITUTION_IMAGE_MIME_TYPES,
  validateInstitutionImageData,
} from "./institutionImage";

export { isHemocioneCdnUrl } from "./institutionImage";

export const MAX_INSTITUTION_LOGO_BYTES = 2 * 1024 * 1024;
export const INSTITUTION_LOGO_MIME_TYPES = INSTITUTION_IMAGE_MIME_TYPES;

type InstitutionLogoMimeType = (typeof INSTITUTION_LOGO_MIME_TYPES)[number];

export function validateInstitutionLogoData(
  data: Uint8Array,
  declaredMimeType: string
) {
  return validateInstitutionImageData(data, declaredMimeType, {
    maxBytes: MAX_INSTITUTION_LOGO_BYTES,
    maxSizeMessage: "A logo deve ter no máximo 2 MB.",
    invalidMimeTypeMessage: "A logo deve ser um arquivo PNG ou JPEG.",
    dimensionsMessage: "Não foi possível ler as dimensões da logo.",
    squareMessage: "A logo deve ser quadrada.",
  }) as { mimeType: InstitutionLogoMimeType; width: number; height: number };
}
