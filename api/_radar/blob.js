import { put } from "@vercel/blob";

export const IMAGE_LIMIT = 3 * 1024 * 1024;

/** Comprueba la firma real del archivo; no se fía de la cabecera Content-Type. */
export function sniffImage(bytes) {
  const b = Buffer.from(bytes.subarray(0, 12));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
export const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Las fotos de Preview y Producción van a carpetas distintas aunque compartan almacén. */
export const imagePath = (environment, vehicleId, ext) => `radar/${environment}/vehicles/${vehicleId}/foto.${ext}`;

export function createBlobStore(env = process.env) {
  const token = env.RADAR_BLOB_READ_WRITE_TOKEN || "";
  return {
    configured: Boolean(token),
    async put(pathname, body, contentType) {
      const out = await put(pathname, body, { access: "public", contentType, addRandomSuffix: true, token });
      return { url: out.url };
    },
  };
}
