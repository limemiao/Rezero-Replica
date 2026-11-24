const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const destination = path.join(root, process.env.OFFLINE_DIR || "site");
const manifestPath = path.join(root, process.env.OFFLINE_MANIFEST || "offline-manifest.json");
const sourcePrefix = "https://re0zero.top/mdbook/book/";
const sourceOrigin = "https://re0zero.top";
const sourcePathPrefix = "/mdbook/book/";
const concurrency = Number(process.env.SYNC_CONCURRENCY || 4);
const configuredMaxFiles = process.env.SYNC_MAX_FILES;
const maxFiles = configuredMaxFiles ? Number(configuredMaxFiles) : Number.POSITIVE_INFINITY;
const refresh = process.env.SYNC_REFRESH === "1";
const requestTimeoutMs = 90_000;

const seedUrls = [
  sourcePrefix + "index.html",
  sourcePrefix + "searchindex.json",
  sourcePrefix + "searchindex.js",
  sourcePrefix + "res/imgs/donate/wechat.png",
  sourcePrefix + "res/imgs/donate/alipay.png",
  sourcePrefix + "res/imgs/donate/kofi.png",
  sourcePrefix + "res/imgs/donate/opencollective.png",
];

const queued = new Set();
const completed = new Map();
const failed = new Map();
const queue = [];
const active = new Map();
let scheduledAt = Date.now();
let lastProgressAt = Date.now();
let totalBytes = 0;
let writtenSinceSave = 0;
let stopping = false;

function normalizeUrl(rawUrl, baseUrl) {
  if (!rawUrl || rawUrl.startsWith("#") || /^(?:data|mailto|tel|javascript):/i.test(rawUrl)) {
    return null;
  }

  let url;
  try {
    url = new URL(rawUrl.replace(/&amp;/g, "&"), baseUrl);
  } catch {
    return null;
  }

  if (url.origin !== sourceOrigin || !url.pathname.startsWith(sourcePathPrefix)) {
    return null;
  }

  url.hash = "";
  return url.href;
}

function localPathFor(urlString) {
  const url = new URL(urlString);
  let relativePath = decodeURIComponent(url.pathname.slice(sourcePathPrefix.length));

  if (!relativePath || relativePath.endsWith("/")) {
    relativePath += "index.html";
  }

  const target = path.resolve(destination, relativePath);
  const relative = path.relative(destination, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe mirror path for ${urlString}`);
  }

  return target;
}

function enqueue(rawUrl, baseUrl) {
  const url = normalizeUrl(rawUrl, baseUrl || sourcePrefix);
  if (!url || queued.has(url) || completed.has(url) || failed.has(url)) {
    return;
  }

  queued.add(url);
  queue.push(url);
}

function discoverHtml(content, pageUrl) {
  const matches = content.matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi);
  for (const match of matches) {
    enqueue(match[1], pageUrl);
  }

  const srcsetMatches = content.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi);
  for (const match of srcsetMatches) {
    for (const candidate of match[1].split(",")) {
      const src = candidate.trim().split(/\s+/)[0];
      enqueue(src, pageUrl);
    }
  }
}

function discoverCss(content, stylesheetUrl) {
  const urlMatches = content.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi);
  for (const match of urlMatches) {
    enqueue(match[2].trim(), stylesheetUrl);
  }

  const importMatches = content.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/gi);
  for (const match of importMatches) {
    enqueue(match[1], stylesheetUrl);
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, {
      headers: {
        "User-Agent": "ReZeroOfflineArchive/1.0 (personal offline mirror)",
        Accept: "text/html,application/xhtml+xml,application/json,text/css,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadFile(url) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const targetPath = localPathFor(url);
      const targetDirectory = path.dirname(targetPath);
      const temporaryPath = `${targetPath}.part`;
      const contentType = response.headers.get("content-type") || "";
      const extension = path.extname(new URL(url).pathname).toLowerCase();

      await fs.promises.mkdir(targetDirectory, { recursive: true });
      await fs.promises.writeFile(temporaryPath, buffer);
      await fs.promises.rename(temporaryPath, targetPath);

      if (contentType.includes("text/html") || extension === ".html") {
        discoverHtml(buffer.toString("utf8"), url);
      } else if (contentType.includes("text/css") || extension === ".css") {
        discoverCss(buffer.toString("utf8"), url);
      }

      const record = {
        path: path.relative(destination, targetPath).replaceAll("\\", "/"),
        bytes: buffer.length,
        contentType,
      };
      completed.set(url, record);
      totalBytes += buffer.length;
      writtenSinceSave += 1;
      return record;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
      }
    }
  }

  failed.set(url, lastError?.message || String(lastError));
}

function writeManifest(state = "running") {
  const entries = {};
  for (const [url, record] of completed) {
    entries[url] = record;
  }

  const manifest = {
    source: sourcePrefix,
    generatedAt: new Date().toISOString(),
    state,
    files: entries,
    queued: [...queue, ...active.keys()],
    fileCount: completed.size,
    failedCount: failed.size,
    failed: Object.fromEntries(failed),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  writtenSinceSave = 0;
}

function reportProgress(force = false) {
  const now = Date.now();
  if (!force && now - lastProgressAt < 10_000) {
    return;
  }

  const elapsed = Math.max(1, Math.round((now - scheduledAt) / 1000));
  const rate = completed.size / elapsed;
  const megabytes = (totalBytes / 1024 / 1024).toFixed(1);
  console.log(
    `[mirror] ${completed.size} files | ${megabytes} MB | ` +
      `queue ${queue.length} | active ${active.size} | ${rate.toFixed(1)} files/s`,
  );
  lastProgressAt = now;
}

function installShutdownHandlers() {
  const stop = (signal) => {
    if (stopping) {
      return;
    }
    stopping = true;
    console.log(`[mirror] ${signal} received, saving progress...`);
    writeManifest("interrupted");
    process.exitCode = 130;
  };

  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
}

async function main() {
  if ((configuredMaxFiles && !Number.isFinite(maxFiles)) || maxFiles < 1) {
    throw new Error("SYNC_MAX_FILES must be a positive number when provided.");
  }

  installShutdownHandlers();
  await fs.promises.mkdir(destination, { recursive: true });

  if (!refresh && fs.existsSync(manifestPath)) {
    try {
      const previous = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
      for (const [url, record] of Object.entries(previous.files || {})) {
        const existingPath = path.join(destination, record.path);
        if (fs.existsSync(existingPath)) {
          completed.set(url, record);
          totalBytes += Number(record.bytes || 0);
        }
      }
      for (const url of previous.queued || []) {
        enqueue(url, sourcePrefix);
      }
      console.log(`[mirror] Resuming with ${completed.size} local files.`);
    } catch (error) {
      console.warn(`[mirror] Ignoring unreadable manifest: ${error.message}`);
    }
  }

  for (const url of seedUrls) {
    enqueue(url, sourcePrefix);
  }

  scheduledAt = Date.now();
  writeManifest();

  while ((queue.length > 0 || active.size > 0) && !stopping) {
    while (
      queue.length > 0 &&
      active.size < concurrency &&
      completed.size + active.size < maxFiles &&
      !stopping
    ) {
      const url = queue.shift();
      const task = downloadFile(url).finally(() => {
        active.delete(url);
      });
      active.set(url, task);
    }

    if (active.size === 0) {
      break;
    }

    await Promise.race(active.values());
    reportProgress();

    if (writtenSinceSave >= 25) {
      writeManifest();
    }
  }

  const finalState = stopping
    ? "interrupted"
    : queue.length > 0
      ? "limited"
      : "complete";
  writeManifest(finalState);
  reportProgress(true);

  if (stopping) {
    process.exitCode = 130;
    return;
  }

  if (failed.size > 0) {
    console.warn(`[mirror] Completed with ${failed.size} failed resources. See offline-manifest.json.`);
  } else {
    console.log(`[mirror] Offline mirror complete: ${destination}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
