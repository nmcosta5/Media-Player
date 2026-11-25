import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const root = process.cwd();
const source = path.join(root, "assets", "merci-player.svg");
const output = path.join(root, "build");
await fs.mkdir(output, { recursive: true });
const png = path.join(output, "icon.png");
const ico = path.join(output, "icon.ico");
await sharp(source, { density: 192 }).resize(1024, 1024).png().toFile(png);
await fs.writeFile(ico, await pngToIco(png));
console.log("Generated Merci Player Windows icon:", ico);
