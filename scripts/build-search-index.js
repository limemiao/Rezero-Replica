const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sandbox = { window: {} };

vm.runInNewContext(
  fs.readFileSync(path.join(root, "elasticlunr.min.js"), "utf8"),
  sandbox,
);

const elasticlunr = sandbox.elasticlunr || sandbox.window.elasticlunr;
const index = elasticlunr(function () {
  this.setRef("id");
  this.addField("title");
  this.addField("body");
});

const decodeHtml = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const titleMatches = [
  ...source.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g),
];
const docs = [];
const seenTitles = new Set();

for (const [, href, rawTitle] of titleMatches) {
  if (
    href.startsWith("http") ||
    href.startsWith("#") ||
    href.endsWith(".js") ||
    href.endsWith(".css")
  ) {
    continue;
  }

  const title = decodeHtml(rawTitle).trim();
  if (!title || title === "Link" || seenTitles.has(title)) {
    continue;
  }

  seenTitles.add(title);
  docs.push({
    id: `doc-${docs.length}`,
    title,
    body: `${title} Re：从零开始的异世界生活 WEB版`,
  });
}

docs.unshift({
  id: "home",
  title: "导读",
  body: "RE0：从零开始的异世界生活 WEB版 死亡回归 菜月昴 爱蜜莉雅 雷姆 拉姆",
});

for (const doc of docs) {
  index.addDoc(doc);
}

const docUrls = Object.fromEntries(docs.map((doc) => [doc.id, "index.html"]));
const config = {
  index: index.toJSON(),
  doc_urls: docUrls,
  searchbar_outer: "",
  search_options: {
    bool: "AND",
    expand: true,
    fields: {
      title: { boost: 1 },
      body: { boost: 1 },
    },
  },
  results_options: {
    teaser_word_count: 30,
    limit_results: 30,
  },
};
const json = JSON.stringify(config);

fs.writeFileSync(path.join(root, "searchindex.json"), json);
fs.writeFileSync(
  path.join(root, "searchindex.js"),
  `window.search = ${json};\n`,
);

console.log(`Indexed ${docs.length} entries.`);
