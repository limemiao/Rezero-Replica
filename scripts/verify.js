const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const puppeteer = require("puppeteer-core");

const root = path.resolve(__dirname, "..");
const port = 4183;
const baseUrl = `http://127.0.0.1:${port}`;
const executablePath = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((candidate) => fs.existsSync(candidate));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  assert(executablePath, "No supported local browser was found.");

  const server = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"],
    });

    try {
      const page = await browser.newPage();
      const failedResources = [];
      const pageErrors = [];
      const searchResponses = [];

      page.on("response", (response) => {
        if (response.url().includes("searchindex")) {
          searchResponses.push(`${response.status()} ${response.url()}`);
        }
        if (response.status() >= 400) {
          failedResources.push(`${response.status()} ${response.url()}`);
        }
      });
      page.on("pageerror", (error) => {
        pageErrors.push(error.message);
      });

      await page.setViewport({ width: 1440, height: 1100 });
      await page.goto(baseUrl, { waitUntil: "networkidle0" });

      const desktop = await page.evaluate(() => {
        const sidebar = document.querySelector("#sidebar");
        const hero = document.querySelector('main img[src*="res/imgs/index/"]');
        return {
          title: document.title,
          rows: document.querySelectorAll("main table tbody tr").length,
          sidebarWidth: sidebar.getBoundingClientRect().width,
          sidebarHidden: sidebar.getAttribute("aria-hidden"),
          heroWidth: hero.naturalWidth,
        };
      });

      assert(desktop.title.includes("Re：从零开始的异世界生活"), "Unexpected page title.");
      assert(desktop.rows === 10, "Chapter table did not render all rows.");
      assert(desktop.sidebarWidth === 300, "Desktop sidebar width changed.");
      assert(desktop.sidebarHidden === "false", "Desktop sidebar should be visible.");
      assert(desktop.heroWidth === 2560, "Hero image failed to load.");

      await page.click("#theme-toggle");
      await page.click("#theme-list #navy");
      assert(
        (await page.evaluate(() => document.documentElement.className)) === "navy",
        "Theme switching failed.",
      );

      await page.click("#search-toggle");
      await page.type("#searchbar", "Re");
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const searchState = await page.evaluate((resourceErrors, scriptErrors, indexResponses) => ({
        results: document.querySelectorAll("#searchresults li").length,
        header: document.querySelector("#searchresults-header").textContent,
        errors: document.querySelector("#searchresults").textContent,
        markType: typeof Mark,
        lunrType: typeof elasticlunr,
        searchKeys: Object.keys(window.search || {}),
        failedResources: resourceErrors,
        pageErrors: scriptErrors,
        searchResponses: indexResponses,
      }), failedResources, pageErrors, searchResponses);
      assert(searchState.results > 0, `Search returned no results: ${JSON.stringify(searchState)}`);

      await page.goto(`${baseUrl}/markdown/ch/chapter010/01.html`, {
        waitUntil: "networkidle0",
      });
      const chapter = await page.evaluate(() => ({
        heading: document.querySelector(".content main h1")?.textContent || "",
        imageCount: document.querySelectorAll(".content main img").length,
      }));
      assert(chapter.heading.length > 0, "Chapter heading did not render.");
      assert(chapter.imageCount > 0, "Chapter illustrations did not render.");

      await page.goto(baseUrl, { waitUntil: "networkidle0" });
      await page.setViewport({ width: 390, height: 844 });
      await page.reload({ waitUntil: "networkidle0" });
      const mobile = await page.evaluate(() => ({
        sidebarHidden:
          document.querySelector("#sidebar").getAttribute("aria-hidden"),
        title: document.querySelector(".menu-title").textContent,
      }));

      assert(mobile.sidebarHidden === "true", "Mobile sidebar should start hidden.");
      assert(mobile.title.includes("Re：从零开始"), "Mobile title bar is missing.");
      assert(pageErrors.length === 0, `Page errors: ${pageErrors.join(", ")}`);
      assert(failedResources.length === 0, `Failed resources: ${failedResources.join(", ")}`);

      console.log("Verification passed: desktop, mobile, themes, and search.");
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
