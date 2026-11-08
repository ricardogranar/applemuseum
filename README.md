# Apple Museum — 50 Years of Mac (1976–2026)

An interactive, bilingual (English / Spanish) **Cover Flow museum of Apple computers**, from the hand-built Apple I to the 2026 touchscreen MacBook Pro. Every machine is a real photograph, background-removed and floating in a 3D Cover Flow, and the whole interface morphs into the operating system of each era: green-phosphor CRT, 1-bit System 1, Platinum, *Think different*, Aqua, Leopard's dark Cover Flow, flat Yosemite and Liquid Glass.

**Live:** https://applemuseum.ricardostudio.com · **ES:** https://applemuseum.ricardostudio.com/es/ · **Repo:** https://github.com/ricardogranar/applemuseum

Created by **[Ricardo Graña](https://ricardostudio.com)** · [LinkedIn](https://www.linkedin.com/in/ricardograna/)

## Features

- Cover Flow with keyboard (← →), trackpad/mouse wheel and touch swipe
- Era UI: 9 themes that restyle the whole page per period (toggle with **Era UI**)
- Full 1976–2026 year ruler, decade switcher, time-lapse mode
- Design story per machine: engineering milestones, archive note, 4 key specs, photo credit and Wikipedia link
- Startup sounds: Web Audio recreations, or real recordings if you add them (see below)
- Shareable deep links per machine (`/#1984-macintosh`, `/es/#1998-imac-g3`)
- SEO: pre-rendered HTML per language, `hreflang`, canonical, Open Graph/Twitter cards, JSON-LD (`CollectionPage` + `ItemList`), sitemap and robots
- Fast: no framework, about 45 KB gzipped HTML per language, about 30 KB per machine photo (WebP with alpha), lazy loading

## Project structure

```
src/
  template.html     page shell + CSS ({{placeholders}} are filled at build time)
  app.js            app logic (vanilla JS)
  synth.js          Web Audio startup-sound recreations
  i18n.json         UI strings (en / es)
  data/era*.json    the museum content, bilingual ({ "en": …, "es": … })
  data/credits.json photo author + license per image key
img/                <key>.webp (stage) + <key>-sm.webp (thumbnails)
sounds/             optional real startup recordings
public/             copied as-is (favicon, og images, _headers)
scripts/            build.mjs · serve.mjs · make-og.py
site.config.json    site URL, base path, author
```

## Develop

Requires Node 18+. No dependencies to install.

```bash
npm run dev        # build to dist/ and serve at http://127.0.0.1:4321
npm run build      # build only
```

The build fails loudly if a machine is missing its photo, its credit or its 4 specs.

## Adding the original startup sounds

Drop audio files into `sounds/` named after the chime key used in the data, then rebuild. The page automatically uses the recording instead of the recreation:

| File name (`.m4a` / `.mp3` / `.ogg` / `.wav`) | Machines |
|---|---|
| `apple2_1977` | Apple II family |
| `mac128k_1984` | Compact Macs (128K → Classic) |
| `macii_1987` | Macintosh II family, SE/30, LC, Color Classic… |
| `quadra_1991` | Quadra and 1991–1997 PowerBooks |
| `powermac_1994` | Power Macintosh 1994–1997 |
| `tam_1997` | Twentieth Anniversary Macintosh |
| `new_world_fsharp` | iMac G3 → 2007 |
| `intel_unibody_chime` | 2008–2015 |
| `silent_t2` | 2016–2019 (silent by default) |
| `apple_silicon_spatial` | 2020 → today |

A clean way to capture them yourself is to record the boot of the real ROMs in an emulator such as [Infinite Mac](https://infinitemac.org) or a real machine. Note: Apple's startup sounds are copyrighted, and the Mac chime is a registered sound trademark. Hosting them is your call.

## Deploy

Any static host works. Point it at this repo with:

- **Build command:** `node scripts/build.mjs`
- **Output directory:** `dist`

Recommended: **Cloudflare Pages** or **Netlify**, which also read `public/_headers` for long-lived image caching, or **Vercel**. Set your domain in `site.config.json` (`url`); it is used for canonical links, `hreflang`, the sitemap and social cards. If you host under a sub-path (e.g. GitHub Pages at `/apple-museum/`), set `"base": "/apple-museum/"`.

## Credits & licenses

- **Code:** MIT © 2026 Ricardo Graña. See `LICENSE`.
- **Photos:** real photographs from [Wikimedia Commons](https://commons.wikimedia.org), background-removed. Each keeps its original license (CC BY, CC BY-SA, CC0 or public domain). Authors and licenses are listed in `src/data/credits.json` and in the site's *Photo credits* panel. CC BY-SA derivatives are shared under the same license.
- Independent fan project, not affiliated with or endorsed by Apple Inc. Apple, Macintosh, Mac, iMac, MacBook, PowerBook, iBook and macOS are trademarks of Apple Inc.
