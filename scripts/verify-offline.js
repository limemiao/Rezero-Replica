const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const siteRoot = path.join(root, "site");
const manifestPath = path.join(root, "offline-manifest.json");

function walk(directory) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function extractReferences(content, extension) {
  const references = [];

  if (extension === ".html") {
    for (const match of content.matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi)) {
      references.push(match[1]);
    }
    for (const match of content.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
      for (const candidate of match[1].split(",")) {
        references.push(candidate.trim().split(/\s+/)[0]);
      }
    }
  } else if (extension === ".css") {
    for (const match of content.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
      references.push(match[2].trim());
    }
    for (const match of content.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/gi)) {
      references.push(match[1]);
    }
  }

  return references;
}

function targetForReference(reference, sourceFile) {
  if (!reference || reference.startsWith("#") || /^(?:data|mailto|tel|javascript):/i.test(reference)) {
    return null;
  }

  const relativeSource = path.relative(siteRoot, sourceFile).replaceAll("\\", "/");
  const sourceUrl = new URL(relativeSource, "http://offline.local/");
  let resolved;

  try {
    resolved = new URL(reference.replace(/&amp;/g, "&"), sourceUrl);
  } catch {
    return null;
  }

  if (resolved.hostname !== "offline.local") {
    return null;
  }

  let relativeTarget = decodeURIComponent(resolved.pathname.slice(1));
  if (!relativeTarget || relativeTarget.endsWith("/")) {
    relativeTarget += "index.html";
  }

  return path.join(siteRoot, relativeTarget);
}

function sourceOfReference(file, reference) {
  return `${path.relative(siteRoot, file).replaceAll("\\", "/")} -> ${reference}`;
}

function main() {
  if (!fs.existsSync(siteRoot) || !fs.existsSync(manifestPath)) {
    throw new Error("Offline mirror is incomplete. Run `npm run sync` first.");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const files = walk(siteRoot);
  const htmlFiles = files.filter((file) => path.extname(file) === ".html");
  const knownBroken = new Set(
    Object.keys(manifest.failed || {}).map((url) =>
      decodeURIComponent(new URL(url).pathname.replace(/^\/mdbook\/book\//, "")),
    ),
  );
  const missing = new Map();
  const externalSourceReferences = new Set();

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (![".html", ".css"].includes(extension)) {
      continue;
    }

    const content = fs.readFileSync(file, "utf8");
    for (const reference of extractReferences(content, extension)) {
      if (reference.startsWith("https://re0zero.top/mdbook/book/")) {
        externalSourceReferences.add(reference);
        continue;
      }

      const target = targetForReference(reference, file);
      if (!target || fs.existsSync(target)) {
        continue;
      }

      const relativeTarget = path.relative(siteRoot, target).replaceAll("\\", "/");
      if (!knownBroken.has(relativeTarget) && !missing.has(relativeTarget)) {
        missing.set(relativeTarget, sourceOfReference(file, reference));
      }
    }
  }

  for (const record of Object.values(manifest.files || {})) {
    if (!fs.existsSync(path.join(siteRoot, record.path))) {
      missing.set(record.path, "Manifest entry is absent from disk");
    }
  }

  if (missing.size > 0) {
    console.error("Unresolved local references:");
    for (const [target, source] of missing) {
      console.error(`  ${target} <- ${source}`);
    }
    process.exitCode = 1;
    return;
  }

  const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
  const images = files.filter((file) => imageExtensions.has(path.extname(file).toLowerCase()));
  const bytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);

  console.log(
    `Offline audit passed: ${htmlFiles.length} HTML pages, ` +
      `${images.length} images, ${files.length} files, ` +
      `${(bytes / 1024 / 1024).toFixed(1)} MB.`,
  );

  if (knownBroken.size > 0) {
    console.log(`Source-site failures preserved: ${knownBroken.size}.`);
  }
  if (externalSourceReferences.size > 0) {
    console.log(`Absolute source references: ${externalSourceReferences.size}.`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
