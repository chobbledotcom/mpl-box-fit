/**
 * Generates OG image and favicon from source images.
 *
 * OG image: background cropped to 1200x630, logo overlaid at 90% opacity centered
 * Favicon: logo scaled to 32x32 as ICO
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const BG_IMAGE = join(root, "images", "gym-corridor-wide-new.jpg");
const LOGO_IMAGE = join(root, "images", "mpl-boxfit-logo.png");
const OG_OUTPUT = join(root, "assets", "og-image.jpg");
const FAVICON_DIR = join(root, "assets", "favicon");
const FAVICON_OUTPUT = join(FAVICON_DIR, "favicon.ico");

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const LOGO_MAX = 400;
const LOGO_OPACITY = 0.9;

const FAVICON_SIZES = [16, 32, 48];

const generateOgImage = async (sharp) => {
  const { data, info } = await sharp(LOGO_IMAGE)
    .resize(LOGO_MAX, LOGO_MAX, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Multiply alpha channel by LOGO_OPACITY
  for (let i = 3; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * LOGO_OPACITY);
  }

  const left = Math.round((OG_WIDTH - info.width) / 2);
  const top = Math.round((OG_HEIGHT - info.height) / 2);

  await sharp(BG_IMAGE)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "center" })
    .composite([
      {
        input: data,
        raw: { width: info.width, height: info.height, channels: 4 },
        left,
        top,
        blend: "over",
      },
    ])
    .jpeg({ quality: 90 })
    .toFile(OG_OUTPUT);

  console.log(`OG image written to ${OG_OUTPUT}`);
};

const writeIco = (bitmaps) => {
  const count = bitmaps.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffset = headerSize + dirEntrySize * count;

  const sizes = bitmaps.map((b) => b.length);
  const offsets = [];
  let offset = dataOffset;
  for (const size of sizes) {
    offsets.push(offset);
    offset += size;
  }

  const totalSize = offset;
  const buf = Buffer.alloc(totalSize);

  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);

  for (let i = 0; i < count; i++) {
    const entry = headerSize + i * dirEntrySize;
    const dim = FAVICON_SIZES[i];
    buf.writeUInt8(dim === 256 ? 0 : dim, entry);
    buf.writeUInt8(dim === 256 ? 0 : dim, entry + 1);
    buf.writeUInt8(0, entry + 2);
    buf.writeUInt8(0, entry + 3);
    buf.writeUInt16LE(1, entry + 4);
    buf.writeUInt16LE(32, entry + 6);
    buf.writeUInt32LE(bitmaps[i].length, entry + 8);
    buf.writeUInt32LE(offsets[i], entry + 12);
    bitmaps[i].copy(buf, offsets[i]);
  }

  return buf;
};

const generateFavicon = async (sharp) => {
  mkdirSync(FAVICON_DIR, { recursive: true });

  const pngBuffers = await Promise.all(
    FAVICON_SIZES.map((size) =>
      sharp(LOGO_IMAGE)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  );

  const ico = writeIco(pngBuffers);
  writeFileSync(FAVICON_OUTPUT, ico);
  console.log(`Favicon written to ${FAVICON_OUTPUT}`);
};

const main = async () => {
  const { default: sharp } = await import("sharp");
  await generateOgImage(sharp);
  await generateFavicon(sharp);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
