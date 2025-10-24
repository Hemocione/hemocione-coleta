import { parse as uuidParse } from "uuid";

/**
 * Converts a UUID string into MongoDB Base64 UUID (subtype 4)
 * @param {string} uuidStr - UUID string (e.g. "27a5eff1-e25b-4ad7-972e-0000bcc8f6d7")
 * @returns {string} Base64 representation (e.g. "J6Xv8eJbSteXLgAAvMj21w==")
 */
function uuidToMongoBase64(uuidStr) {
  const bytes = uuidParse(uuidStr); // 16-byte array
  return Buffer.from(bytes).toString("base64");
}

// Example usage:
const uuid = "27a5eff1-e25b-4ad7-972e-bcc8f6d7e4db";
const base64 = uuidToMongoBase64(uuid);
console.log(base64);
