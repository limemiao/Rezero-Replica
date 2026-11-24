const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const [, , url, output, widthArg = "1440", heightArg = "1100"] = process.argv;

if (!url || !output) {
  console.error("Usage: node scripts/capture.js <url> <output.png> [width] [height]");
  process.exit(1);
}

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

async function main() {
  const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
  if (!executablePath) {
    throw new Error("No supported local browser was found.");
  }

  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: Number(widthArg),
      height: Number(heightArg),
      deviceScaleFactor: 1,
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await page.screenshot({ path: outputPath, fullPage: true });
    console.log(outputPath);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
