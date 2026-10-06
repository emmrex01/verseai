// Renders raster brand assets from the source logo + vector mark. Run: node scripts/render-brand.mjs
import sharp from "sharp";
const ivory = { r: 250, g: 248, b: 243, alpha: 1 };
await sharp("public/brand/verse-logo-hero.webp")
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .jpeg({ quality: 86 })
  .toFile("src/app/opengraph-image.jpg");
const mark = await sharp("public/brand/verse-mark.svg", { density: 600 }).resize(400, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
const square = (size) =>
  sharp({ create: { width: size, height: size, channels: 4, background: ivory } })
    .composite([{ input: mark, gravity: "center" }])
    .png();
await sharp(await square(512).toBuffer()).resize(512).toFile("src/app/icon.png");
await sharp(await square(512).toBuffer()).resize(180).toFile("src/app/apple-icon.png");
console.log("brand assets rendered");
