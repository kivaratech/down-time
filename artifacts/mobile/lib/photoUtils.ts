import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.75;

/**
 * Resize (only if wider than MAX_WIDTH) and re-compress a photo URI.
 * Returns the compressed URI along with final dimensions for logging.
 */
export async function compressPhotoForUpload(
  uri: string,
  originalWidth: number
): Promise<{ uri: string; width: number; height: number }> {
  let ctx = ImageManipulator.manipulate(uri);
  if (originalWidth > MAX_WIDTH) {
    ctx = ctx.resize({ width: MAX_WIDTH });
  }
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  ref.release();
  return { uri: result.uri, width: result.width, height: result.height };
}
