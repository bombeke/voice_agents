import { Skia } from "@shopify/react-native-skia";
import type { ImageBuffer } from "react-native-executorch/cv";

/**
 * Decodes an image file (the AR view's screenshot) into the RGBA buffer the
 * executorch detector takes, scaled so its long side is at most `maxSide`.
 * Aspect is kept, so boxes map back onto the view with one scale factor.
 * Runs on a CPU raster surface: no GL context is needed on the JS thread.
 */
export async function decodeToImageBuffer(
  uri: string,
  maxSide: number,
): Promise<ImageBuffer | null> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) return null;
  const k = Math.min(1, maxSide / Math.max(image.width(), image.height()));
  const width = Math.max(1, Math.round(image.width() * k));
  const height = Math.max(1, Math.round(image.height() * k));
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  surface
    .getCanvas()
    .drawImageRect(
      image,
      { x: 0, y: 0, width: image.width(), height: image.height() },
      { x: 0, y: 0, width, height },
      Skia.Paint(),
    );
  surface.flush();
  // Make() surfaces are RGBA_8888, unpremultiplied.
  const pixels = surface.makeImageSnapshot().readPixels();
  if (!(pixels instanceof Uint8Array)) return null;
  return { data: pixels, width, height, format: "rgba", layout: "hwc" };
}
