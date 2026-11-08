#!/usr/bin/env node
/**
 * Apple Museum — static build (zero dependencies).
 *
 *   node scripts/build.mjs
 *
 * Reads src/template.html + src/app.js + src/synth.js + src/data/*.json + src/i18n.json
 * and writes a fully static, pre-rendered site to dist/:
 *   dist/index.html      (English, x-default)
 *   dist/es/index.html   (Spanish)
 *   dist/img, dist/sounds, dist/og-*.jpg, robots.txt, sitemap.xml, _headers
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync, rmSync, statSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const read = p => readFileSync(join(ROOT, p), "utf8");
const json = p => JSON.parse(read(p));

const config = json("site.config.json");
const i18n = json("src/i18n.json");
const template = read("src/template.html");
const appJs = read("src/app.js");
const synthJs = read("src/synth.js");
const credits = existsSync(join(ROOT, "src/data/credits.json")) ? json("src/data/credits.json") : {};
const SITE = config.url.replace(/\/$/, "");
const BASE = config.base || "/";
const LANGS = ["en", "es"];

/* ---------- data ---------- */
const dataFiles = readdirSync(join(ROOT, "src/data")).filter(f => /^era\d+\.json$/.test(f)).sort();
const DB = dataFiles.flatMap(f => json(`src/data/${f}`)).sort((a, b) => a.year - b.year);

const problems = [];
const skipped = [];
const ids = new Set();
const hasPhoto = v => existsSync(join(ROOT, "img", `${v.img}.webp`)) && existsSync(join(ROOT, "img", `${v.img}-sm.webp`));
// Machines without a photo yet are left out (with a warning) and reappear as soon as img/<key>.webp exists.
for (const m of DB) {
  const missing = m.variants.filter(v => !hasPhoto(v));
  missing.forEach(v => skipped.push(`${m.year} ${v.name} → add img/${v.img}.webp`));
  m.variants = m.variants.filter(hasPhoto);
}
for (let i = DB.length - 1; i >= 0; i--) if (!DB[i].variants.length) DB.splice(i, 1);
for (const m of DB) {
  if (ids.has(m.id)) problems.push(`duplicate id ${m.id}`);
  ids.add(m.id);
  for (const v of m.variants) {
    if (!credits[v.img]) problems.push(`no photo credit for "${v.img}"`);
    if (!v.specs || v.specs.length !== 4) problems.push(`${m.id} / ${v.name}: expected 4 specs`);
  }
}
if (skipped.length) console.warn(`⚠ ${skipped.length} machines skipped (no photo yet):\n  ` + skipped.join("\n  "));
if (config.defaultMilestone && !DB.some(m => m.id === config.defaultMilestone)) problems.push(`defaultMilestone "${config.defaultMilestone}" not found`);
if (problems.length) {
  console.error("✗ Data problems:\n  " + problems.join("\n  "));
  process.exit(1);
}

// Project a bilingual value ({en, es}) to one language, recursively
const isLangObj = o => o && typeof o === "object" && !Array.isArray(o) && "en" in o && Object.keys(o).every(k => LANGS.includes(k));
const localize = (v, lang) =>
  isLangObj(v) ? (v[lang] ?? v.en)
  : Array.isArray(v) ? v.map(x => localize(x, lang))
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, localize(x, lang)]))
  : v;

/* ---------- sounds: any sounds/<chimeKey>.(m4a|mp3|ogg|wav) becomes a real recording ---------- */
const SOUNDS = {};
if (existsSync(join(ROOT, "sounds"))) {
  for (const f of readdirSync(join(ROOT, "sounds"))) {
    if ([".m4a", ".mp3", ".ogg", ".wav"].includes(extname(f).toLowerCase())) SOUNDS[basename(f, extname(f))] = `sounds/${f}`;
  }
}

/* ---------- helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeJson = o => JSON.stringify(o).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, "");
const pageUrl = lang => `${SITE}${BASE}${lang === "en" ? "" : `${lang}/`}`;
const eraTheme = y => (y < 1983 ? "70s" : y < 1990 ? "80s" : y < 1998 ? "90s" : y < 2000 ? "think" : y < 2007 ? "00s" : y < 2013 ? "leopard" : y < 2020 ? "10s" : "20s");
const TOTAL = DB.reduce((n, m) => n + m.variants.length, 0);

function archiveHtml(db, s) {
  const byDecade = new Map();
  for (const m of db) {
    const d = `${Math.floor(m.year / 10) * 10}s`;
    if (!byDecade.has(d)) byDecade.set(d, []);
    byDecade.get(d).push(m);
  }
  let html = '<div class="archive-decades">';
  for (const [d, list] of byDecade) {
    const dn = parseInt(d, 10);
    html += `<div><h3>${esc(s.decadeLabel.replace("{d}", d).replace("{es}", dn < 2000 ? String(dn % 100) : String(dn)))}</h3><ol>`;
    for (const m of list) {
      html += `<li><a href="#${esc(m.id)}"><time datetime="${m.year}">${m.year}</time><span><strong>${esc(m.title)}</strong><small>${esc(m.variants.map(v => v.name).join(" · "))}</small></span></a></li>`;
    }
    html += "</ol></div>";
  }
  return html + "</div>";
}

function headHtml(lang, db, s) {
  const url = pageUrl(lang);
  const ogImage = `${SITE}${BASE}og-${lang}.jpg`;
  const first = db.find(m => m.id === config.defaultMilestone) || db[db.length - 1];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE}${BASE}#website`, name: config.siteName, url: `${SITE}${BASE}`, inLanguage: LANGS, author: { "@id": `${SITE}${BASE}#author` } },
      { "@type": "Person", "@id": `${SITE}${BASE}#author`, name: config.author.name, url: config.author.url, sameAs: config.author.sameAs },
      {
        "@type": "CollectionPage", "@id": url, url, name: s.seoTitle, description: s.seoDescription, inLanguage: lang,
        isPartOf: { "@id": `${SITE}${BASE}#website` }, author: { "@id": `${SITE}${BASE}#author` },
        datePublished: config.published, image: ogImage,
        mainEntity: {
          "@type": "ItemList", numberOfItems: db.length,
          itemListElement: db.map((m, i) => ({ "@type": "ListItem", position: i + 1, name: `${m.year} · ${m.title}`, url: `${url}#${m.id}` }))
        }
      }
    ]
  };
  return `<title>${esc(s.seoTitle)}</title>
  <meta name="description" content="${esc(s.seoDescription)}" />
  <meta name="author" content="${esc(config.author.name)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${pageUrl("en")}" />
  <link rel="alternate" hreflang="es" href="${pageUrl("es")}" />
  <link rel="alternate" hreflang="x-default" href="${pageUrl("en")}" />
  <meta name="theme-color" content="#f2f3f7" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${esc(config.siteName)}" />
  <meta property="og:title" content="${esc(s.ogTitle)}" />
  <meta property="og:description" content="${esc(s.ogDescription.replace("{n}", TOTAL))}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${esc(s.ogImageAlt)}" />
  <meta property="og:locale" content="${s.locale}" />
  <meta property="og:locale:alternate" content="${lang === "en" ? i18n.es.locale : i18n.en.locale}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(s.ogTitle)}" />
  <meta name="twitter:description" content="${esc(s.ogDescription.replace("{n}", TOTAL))}" />
  <meta name="twitter:image" content="${ogImage}" />
  <link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml" />
  <link rel="preload" as="image" href="${BASE}img/${first.variants[0].img}.webp" fetchpriority="high" />
  <script type="application/ld+json">${safeJson(ld)}</script>`;
}

/* ---------- render ---------- */
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const lang of LANGS) {
  const s = i18n[lang];
  const db = localize(DB, lang);
  const first = db.find(m => m.id === config.defaultMilestone) || db[db.length - 1];
  const ui = { ...s };
  const vars = {
    lang,
    initEra: eraTheme(first.year),
    initYear: String(first.year),
    initBrand: esc(first.topBrand),
    initBadge: esc(first.topBadge),
    initDate: esc(first.date),
    initOS: esc(first.os),
    initCounter: `${db.indexOf(first) + 1} ${esc(s.of)} ${db.length}`,
    initTitle: esc(first.title),
    initQuote: esc(`“${first.quote}”`),
    allMacsLabel: esc(s.allMacs.replace("{n}", TOTAL)),
    urlEn: `${BASE}`,
    urlEs: `${BASE}es/`,
    activeEn: lang === "en" ? "active" : "",
    activeEs: lang === "es" ? "active" : "",
    archiveIntro: esc(s.archiveIntro.replace("{n}", TOTAL).replace("{m}", db.length)),
    archiveHtml: archiveHtml(db, s)
  };
  const js = appJs
    .replace('/*__LANG__*/"en"', JSON.stringify(lang))
    .replace('/*__BASE__*/"/"', JSON.stringify(BASE))
    .replace("/*__DATA__*/[]", safeJson(db))
    .replace("/*__CREDITS__*/{}", safeJson(credits))
    .replace("/*__SOUNDS__*/{}", safeJson(SOUNDS))
    .replace("/*__UI__*/{}", safeJson(ui))
    .replace('/*__DEFAULT__*/""', JSON.stringify(first.id))
    .replace("/*__SYNTH__*/", synthJs);
  let html = template
    .replace("<!--__HEAD__-->", headHtml(lang, db, s))
    .replace("/*__APP__*/", () => js)
    .replace(/\{\{t\.(\w+)\}\}/g, (_, k) => {
      if (!(k in s)) throw new Error(`missing UI string "${k}" (${lang})`);
      return esc(s[k]);
    })
    .replace(/\{\{(\w+)\}\}/g, (_, k) => {
      if (!(k in vars)) throw new Error(`missing template var "${k}"`);
      return vars[k];
    });
  const out = lang === "en" ? DIST : join(DIST, lang);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.html"), html);
}

/* ---------- static assets ---------- */
cpSync(join(ROOT, "img"), join(DIST, "img"), { recursive: true });
if (existsSync(join(ROOT, "sounds"))) cpSync(join(ROOT, "sounds"), join(DIST, "sounds"), { recursive: true });
for (const f of readdirSync(join(ROOT, "public"))) cpSync(join(ROOT, "public", f), join(DIST, f), { recursive: true });

writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}${BASE}sitemap.xml\n`);
const lastmod = new Date().toISOString().slice(0, 10);
writeFileSync(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${LANGS.map(l => `  <url>
    <loc>${pageUrl(l)}</loc>
    <lastmod>${lastmod}</lastmod>
${LANGS.map(a => `    <xhtml:link rel="alternate" hreflang="${a}" href="${pageUrl(a)}" />`).join("\n")}
    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl("en")}" />
  </url>`).join("\n")}
</urlset>
`);

const size = p => (statSync(p).size / 1024).toFixed(0) + " KB";
console.log(`✓ Built ${DB.length} milestones · ${TOTAL} machines · ${Object.keys(SOUNDS).length} recorded sounds`);
console.log(`  dist/index.html ${size(join(DIST, "index.html"))} · dist/es/index.html ${size(join(DIST, "es/index.html"))}`);
