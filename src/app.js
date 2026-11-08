    /* ==========================================================================
       Apple Museum — app logic (vanilla JS, no dependencies)
       Data, credits, sound manifest and UI strings are injected by scripts/build.mjs
       ========================================================================== */
    const LANG = /*__LANG__*/"en";
    const BASE = /*__BASE__*/"/";
    const MAC_TIMELINE_DB = /*__DATA__*/[];
    const PHOTO_CREDITS = /*__CREDITS__*/{};
    const SOUND_SAMPLES = /*__SOUNDS__*/{};
    const UI = /*__UI__*/{};

    // Localize a field: plain value, or { en, es } object
    const t = v => (v && typeof v === "object" && !Array.isArray(v)) ? (v[LANG] ?? v.en) : v;
    const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const FIRST_YEAR = 1976, LAST_YEAR = 2026;
    const TOTAL_MACHINES = MAC_TIMELINE_DB.reduce((n, m) => n + m.variants.length, 0);

    let currentIndex = MAC_TIMELINE_DB.length - 1; // starts on the newest milestone
    let currentVariantIdx = 0;
    let eraUiEnabled = true;
    let timeLapseTimer = null;
    let audioCtx = null;

    /* ---------- Era themes: the UI morphs to match the OS of each period ---------- */
    function eraTheme(y) {
      if (y < 1983) return "70s";      // Apple I / II — green phosphor CRT
      if (y < 1990) return "80s";      // System 1–6 — 1-bit Susan Kare desktop
      if (y < 1998) return "90s";      // System 7 / Mac OS 8 Platinum
      if (y < 2000) return "think";    // "Think different" — Bondi translucency
      if (y < 2007) return "00s";      // Mac OS X Aqua
      if (y < 2013) return "leopard";  // Leopard / Snow Leopard — dark Cover Flow
      if (y < 2020) return "10s";      // Yosemite → Catalina flat
      return "20s";                    // Big Sur → Liquid Glass
    }
    const decadeOf = y => `${Math.floor(y / 10) % 10}0s`;

    function photoUrl(key, size) {
      return `${BASE}img/${key}${size === "sm" ? "-sm" : ""}.webp`;
    }

    function creditText(key) {
      const c = PHOTO_CREDITS[key];
      return c ? `${UI.photo}: ${c.author} · ${c.license} · Wikimedia Commons` : "";
    }

    function findMilestoneByHash() {
      const h = decodeURIComponent(location.hash.slice(1));
      if (!h) return -1;
      let i = MAC_TIMELINE_DB.findIndex(m => m.id === h);
      if (i === -1 && /^\d{4}$/.test(h)) i = MAC_TIMELINE_DB.findIndex(m => m.year === +h);
      return i;
    }

    function initApp() {
      document.getElementById("allMacsCountLabel").textContent = UI.allMacs.replace("{n}", TOTAL_MACHINES);
      if (!/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) {
        // U+F8FF only exists in Apple fonts; elsewhere it renders as an empty box.
        document.querySelectorAll(".brand-apple-icon").forEach(el => el.style.display = "none");
      }
      buildCoverFlowItems();
      buildBottomYearRuler();
      buildPhotoCredits();
      const fromHash = findMilestoneByHash();
      if (fromHash !== -1) currentIndex = fromHash;
      selectMilestone(currentIndex, 0);
      const warmUp = () => document.querySelectorAll(".cf-machine img[data-src]").forEach(loadMachineImg);
      ("requestIdleCallback" in window) ? requestIdleCallback(warmUp, { timeout: 3000 }) : setTimeout(warmUp, 2000);
    }

    function loadMachineImg(img) {
      if (img.dataset.src) {
        img.src = img.dataset.src;
        delete img.dataset.src;
      }
    }

    function buildCoverFlowItems() {
      const track = document.getElementById("coverflowTrack");
      track.innerHTML = "";
      MAC_TIMELINE_DB.forEach((item, idx) => {
        const v0 = item.variants[0];
        const el = document.createElement("div");
        el.className = "cf-machine";
        el.dataset.index = idx;
        el.onclick = () => (currentIndex !== idx ? selectMilestone(idx, 0) : openStoryModal());
        el.innerHTML = `
          <div class="cf-floating-label">&bull; ${item.year} &middot; ${esc(t(item.shortLabel))}</div>
          <div class="cf-image-wrap">
            <img data-src="${photoUrl(v0.img)}" alt="${esc(v0.name)} (${item.year})" decoding="async" draggable="false" />
            <div class="hero-2026-pill ${item.is2026TouchHero ? "show-badge" : ""}">
              <span class="siri-dot"></span>
              <span>Dynamic Island &middot; PROLED XDR Touch</span>
            </div>
          </div>
          <div class="cf-floor-shadow"></div>`;
        track.appendChild(el);
      });
    }

    /* Year ruler: every year 1976–2026; years without a milestone are dimmed and jump to the nearest one */
    function buildBottomYearRuler() {
      const ruler = document.getElementById("rulerScrollTrack");
      ruler.innerHTML = "";
      for (let y = FIRST_YEAR; y <= LAST_YEAR; y++) {
        const has = MAC_TIMELINE_DB.some(m => m.year === y);
        const btn = document.createElement("button");
        btn.className = `ruler-tick-item${has ? "" : " is-empty"}${y % 5 === 0 ? " is-major" : ""}`;
        btn.dataset.year = y;
        btn.setAttribute("aria-label", String(y));
        btn.innerHTML = `<span>${y}</span><span class="ruler-tick-line"></span>`;
        btn.onclick = () => jumpToYear(y);
        ruler.appendChild(btn);
      }
    }

    function jumpToYear(y) {
      const sameYear = MAC_TIMELINE_DB.map((m, i) => (m.year === y ? i : -1)).filter(i => i !== -1);
      if (sameYear.length) {
        // clicking the active year again cycles through that year's milestones (e.g. 2026)
        const pos = sameYear.indexOf(currentIndex);
        return selectMilestone(pos === -1 ? sameYear[0] : sameYear[(pos + 1) % sameYear.length], 0);
      }
      let best = 0;
      MAC_TIMELINE_DB.forEach((m, i) => { if (Math.abs(m.year - y) < Math.abs(MAC_TIMELINE_DB[best].year - y)) best = i; });
      selectMilestone(best, 0);
    }

    function selectMilestone(index, variantIndex = 0) {
      index = Math.max(0, Math.min(MAC_TIMELINE_DB.length - 1, index));
      currentIndex = index;
      const item = MAC_TIMELINE_DB[index];
      if (variantIndex >= item.variants.length) variantIndex = 0;
      currentVariantIdx = variantIndex;
      const v = item.variants[variantIndex];

      if (decodeURIComponent(location.hash.slice(1)) !== item.id) {
        history.replaceState(null, "", `#${item.id}`);
      }

      document.body.dataset.era = eraTheme(item.year);
      document.body.dataset.year = String(item.year);

      document.getElementById("topBrandTitle").textContent = eraUiEnabled ? item.topBrand : "Mac";
      document.getElementById("topEraBadge").textContent = eraUiEnabled ? t(item.topBadge) : UI.modernUi;
      const dec = decadeOf(item.year);
      document.querySelectorAll(".decade-pill-btn").forEach(b => b.classList.toggle("active", b.dataset.decade === dec));

      document.getElementById("heroDate").textContent = t(item.date);
      document.getElementById("heroOS").textContent = t(item.os);
      document.getElementById("heroCounter").textContent = `${index + 1} ${UI.of} ${MAC_TIMELINE_DB.length}`;
      document.getElementById("heroTitle").textContent = t(item.title);
      document.getElementById("heroQuote").textContent = `“${t(item.quote)}”`;

      const pillsRow = document.getElementById("submodelPillsRow");
      pillsRow.innerHTML = item.variants.map((vv, vi) => `
        <button class="submodel-pill ${vi === variantIndex ? "active" : ""}"
                onclick="${item.variants.length > 1 ? `selectMilestone(${index}, ${vi})` : "openStoryModal()"}">
          <img src="${photoUrl(vv.img, "sm")}" alt="" width="22" height="18" />
          <span>${esc(vv.name)}</span>
        </button>`).join("");

      document.getElementById("giantYearWatermark").textContent = item.year;

      document.querySelectorAll(".cf-machine").forEach((el, i) => {
        const offset = i - index;
        const abs = Math.abs(offset);
        const img = el.querySelector("img");
        if (abs <= 3) loadMachineImg(img);
        const wantSrc = photoUrl(offset === 0 ? v.img : MAC_TIMELINE_DB[i].variants[0].img);
        if (!img.dataset.src && !img.src.endsWith(wantSrc)) img.src = wantSrc;
        if (offset === 0) img.fetchPriority = "high";

        if (offset === 0) {
          el.classList.add("is-center");
          el.style.transform = "translateX(0px) translateZ(160px) rotateY(0deg) scale(1.08)";
          el.style.zIndex = 100;
          el.style.opacity = 1;
          el.style.pointerEvents = "auto";
        } else if (abs <= 4) {
          el.classList.remove("is-center");
          const dir = offset < 0 ? -1 : 1;
          const spread = Math.min(window.innerWidth / 1440, 1);
          el.style.transform = `translateX(${dir * (165 + abs * 115) * Math.max(spread, 0.55)}px) translateZ(${-abs * 85}px) rotateY(${-dir * 28}deg) scale(${Math.max(0.55, 0.86 - abs * 0.09)})`;
          el.style.zIndex = 90 - abs;
          el.style.opacity = Math.max(0.28, 0.92 - abs * 0.18);
          el.style.pointerEvents = "auto";
        } else {
          el.classList.remove("is-center");
          const dir = offset < 0 ? -1 : 1;
          el.style.transform = `translateX(${dir * 780}px) translateZ(-400px) scale(0.4)`;
          el.style.zIndex = 1;
          el.style.opacity = 0;
          el.style.pointerEvents = "none";
        }
      });

      document.getElementById("fourColSpecCard").innerHTML = v.specs.map(s => `
        <div class="spec-col">
          <div class="spec-col-label">${esc(t(s.label))}</div>
          <div class="spec-col-value">${esc(t(s.value))}</div>
        </div>`).join("");

      document.querySelectorAll(".ruler-tick-item").forEach(tick => {
        const active = +tick.dataset.year === item.year;
        tick.classList.toggle("active", active);
        if (active) {
          const track = tick.parentElement;
          track.scrollTo({ left: tick.offsetLeft - track.clientWidth / 2 + tick.clientWidth / 2, behavior: "smooth" });
        }
      });
    }

    function stepMilestone(delta) {
      selectMilestone(currentIndex + delta, 0);
    }

    function jumpToDecade(decade) {
      const cur = MAC_TIMELINE_DB[currentIndex];
      if (decadeOf(cur.year) === decade) {
        const next = currentIndex + 1;
        if (next < MAC_TIMELINE_DB.length && decadeOf(MAC_TIMELINE_DB[next].year) === decade) return selectMilestone(next, 0);
      }
      const first = MAC_TIMELINE_DB.findIndex(m => decadeOf(m.year) === decade);
      if (first !== -1) selectMilestone(first, 0);
    }

    function toggleEraUI() {
      eraUiEnabled = !eraUiEnabled;
      document.body.classList.toggle("era-ui-enabled", eraUiEnabled);
      document.getElementById("eraUiToggleBtn").classList.toggle("era-toggle-active", eraUiEnabled);
      selectMilestone(currentIndex, currentVariantIdx);
    }

    function toggleTimeLapse() {
      const btn = document.getElementById("timeLapseBtn");
      const icon = document.getElementById("timeLapseIcon");
      const txt = document.getElementById("timeLapseText");
      if (timeLapseTimer) {
        clearInterval(timeLapseTimer);
        timeLapseTimer = null;
        btn.classList.remove("timelapse-active");
        icon.innerHTML = "&#9654;";
        txt.textContent = UI.timeLapse;
      } else {
        btn.classList.add("timelapse-active");
        icon.innerHTML = "&#9208;";
        txt.textContent = UI.pause;
        timeLapseTimer = setInterval(() => {
          if (document.hidden) return;
          selectMilestone((currentIndex + 1) % MAC_TIMELINE_DB.length, 0);
        }, 2600);
      }
    }

    /* ---------- Modals ---------- */
    let lastFocus = null;
    function openModal(id) {
      lastFocus = document.activeElement;
      const m = document.getElementById(id);
      m.classList.add("open");
      m.querySelector(".modal-close-btn")?.focus({ preventScroll: true });
    }
    function closeModal(id) {
      const m = document.getElementById(id);
      if (!m.classList.contains("open")) return;
      m.classList.remove("open");
      lastFocus?.focus?.({ preventScroll: true });
    }

    function openStoryModal() {
      const item = MAC_TIMELINE_DB[currentIndex];
      const v = item.variants[currentVariantIdx];
      document.getElementById("modalWindowBarTitle").textContent = `${item.topBrand} — ${v.name} (${item.year})`;
      document.getElementById("modalEyebrow").textContent = `${t(item.date)} · ${t(item.os)}`;
      document.getElementById("modalTitle").textContent = t(item.title);
      const img = document.getElementById("modalPhoto");
      img.src = photoUrl(v.img);
      img.alt = v.name;
      document.getElementById("modalPhotoCredit").textContent =
        [t(v.photoNote), creditText(v.img)].filter(Boolean).join(" — ");
      const wikiLang = LANG === "es" && v.wikiEs ? "es" : "en";
      const wikiTitle = wikiLang === "es" ? v.wikiEs : v.wiki;
      document.getElementById("modalWikiLink").href = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`;
      document.getElementById("modalStoryText").textContent = t(item.story);
      const hl = t(item.highlights) || [];
      document.getElementById("modalHighlights").innerHTML = hl.length
        ? `<h3>${UI.highlightsTitle}</h3><ul>${hl.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : "";
      const note = t(item.archiveNote);
      document.getElementById("modalArchiveNote").innerHTML = note ? `<h3>${UI.archiveNoteTitle}</h3><p>${esc(note)}</p>` : "";
      document.getElementById("modalSpecsList").innerHTML = v.specs.map(s => `
        <div class="modal-spec">
          <div class="modal-spec-label">${esc(t(s.label))}</div>
          <div class="modal-spec-value">${esc(t(s.value))}</div>
        </div>`).join("");
      openModal("storyModal");
    }
    const closeStoryModal = () => closeModal("storyModal");

    function buildCatalogGrid() {
      const grid = document.getElementById("catalogGrid");
      if (grid.dataset.built) return;
      grid.dataset.built = "1";
      grid.innerHTML = MAC_TIMELINE_DB.flatMap((item, idx) => item.variants.map((v, vi) => `
        <a class="catalog-item" href="#${item.id}" onclick="event.preventDefault(); selectMilestone(${idx}, ${vi}); closeCatalogModal();">
          <img src="${photoUrl(v.img, "sm")}" alt="" loading="lazy" decoding="async" width="160" height="105" />
          <span class="catalog-year">${item.year}</span>
          <span class="catalog-name">${esc(v.name)}</span>
        </a>`)).join("");
    }
    function openCatalogModal() { buildCatalogGrid(); openModal("catalogModal"); }
    const closeCatalogModal = () => closeModal("catalogModal");
    function openCredits() {
      openCatalogModal();
      const d = document.querySelector(".photo-credits");
      d.open = true;
      setTimeout(() => d.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    }

    function buildPhotoCredits() {
      const list = document.getElementById("photoCreditsList");
      const used = [...new Set(MAC_TIMELINE_DB.flatMap(m => m.variants.map(v => v.img)))];
      list.innerHTML = used.filter(k => PHOTO_CREDITS[k]).map(k => {
        const c = PHOTO_CREDITS[k];
        const name = MAC_TIMELINE_DB.flatMap(m => m.variants).find(v => v.img === k).name;
        return `<li><a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.file)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a> — ${esc(c.author)} · ${esc(c.license)}</li>`;
      }).join("");
    }

    const isAnyModalOpen = () => !!document.querySelector(".modal-backdrop.open");

    /* ---------- Startup chimes: real recordings if present in /sounds, otherwise Web Audio recreation ---------- */
    const SYNTH_ALIAS = { macii_1987: "macse30_1989", quadra_1991: "pb100_1991", powermac_1994: "tam_1997", silent_t2: "intel_unibody_chime" };
    const sampleCache = {};

    async function playSample(key) {
      const url = SOUND_SAMPLES[key];
      if (!url) return false;
      try {
        if (!sampleCache[key]) {
          const res = await fetch(BASE + url);
          if (!res.ok) return false;
          sampleCache[key] = await audioCtx.decodeAudioData(await res.arrayBuffer());
        }
        const src = audioCtx.createBufferSource();
        src.buffer = sampleCache[key];
        src.connect(audioCtx.destination);
        src.start();
        return true;
      } catch (e) {
        return false;
      }
    }

    async function playCurrentChime() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const item = MAC_TIMELINE_DB[currentIndex];
      const label = UI.chimes[item.chime] || `${t(item.shortLabel)} (${item.year})`;
      if (await playSample(item.chime)) {
        showChimeHud(`${label} · ${UI.recording}`);
        return;
      }
      showChimeHud(`${label} · ${UI.recreation}`);
      synthChime(SYNTH_ALIAS[item.chime] || item.chime);
    }

/*__SYNTH__*/

    /* ---------- Input: keyboard, wheel/trackpad, touch, deep links ---------- */
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") { closeStoryModal(); closeCatalogModal(); return; }
      if (isAnyModalOpen()) return;
      if (e.target.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft") stepMilestone(-1);
      if (e.key === "ArrowRight") stepMilestone(1);
    });

    window.addEventListener("hashchange", () => {
      const i = findMilestoneByHash();
      if (i !== -1 && i !== currentIndex) {
        selectMilestone(i, 0);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    // Wheel / trackpad: accumulate delta and lock until inertia ends (no 5-machine jumps)
    const stageEl = document.getElementById("stageSection");
    let wheelAccum = 0, wheelLocked = false, wheelIdleTimer = null, wheelLockStart = 0;
    stageEl.addEventListener("wheel", e => {
      // let vertical scrolling pass through so the page (archive, footer) stays reachable
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5 && !e.shiftKey) return;
      e.preventDefault();
      const d = e.deltaX || e.deltaY;
      clearTimeout(wheelIdleTimer);
      wheelIdleTimer = setTimeout(() => { wheelLocked = false; wheelAccum = 0; }, 140);
      if (wheelLocked && performance.now() - wheelLockStart < 650) return;
      wheelAccum += d;
      if (Math.abs(wheelAccum) >= 30) {
        stepMilestone(wheelAccum > 0 ? 1 : -1);
        wheelAccum = 0;
        wheelLocked = true;
        wheelLockStart = performance.now();
      }
    }, { passive: false });

    let touchStartX = 0;
    stageEl.addEventListener("touchstart", e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    stageEl.addEventListener("touchend", e => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 35) stepMilestone(diff > 0 ? 1 : -1);
    }, { passive: true });

    // Language switch keeps the current machine
    document.querySelectorAll("[data-lang-link]").forEach(a => a.addEventListener("click", () => {
      a.href = a.getAttribute("href").split("#")[0] + location.hash;
    }));

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => selectMilestone(currentIndex, currentVariantIdx), 150);
    });

    if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", initApp);
    else initApp();
