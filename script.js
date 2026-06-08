const CMS = {
  spreadsheetId: "1meud5tcE8JCNIfu5nHkaexqyHtUc61w7orIMY05nors",
  gids: {
    meta: "641468156",
    items: "1293424779",
    compare: "2099863132",
    suggestions: "1559585072",
    alphabet: "679225347",
    kerning: "512332723",
    alphabetTape: "694504731",
  },
  imageJsonUrls: ["./images.json"],
  suggestPostUrl:
    "https://script.google.com/macros/s/AKfycbzttDgp5OToo5lI4-7CKFQnMWG8QqZke5cDMLQUM-TjCcMYhmICESPeOfybQthc1VOa/exec",
};

const csvUrl = (gid) =>
  `https://docs.google.com/spreadsheets/d/${CMS.spreadsheetId}/export?format=csv&gid=${gid}`;

const body = document.body;
function setBodyMode(mode) {
  body.classList.remove(
    "mode-intro",
    "mode-opening",
    "mode-open",
    "mode-compare",
    "mode-suggest",
  );
  body.classList.add(mode);
}
const topS = document.getElementById("topSection");
const bCompS = document.getElementById("bottomCompareSection");
const bSuggS = document.getElementById("bottomSuggestSection");
const msgInput = document.getElementById("msgInput");

const topTape = document.getElementById("topTape");
const compareTape = document.getElementById("compareTape");
const suggestTape = document.getElementById("suggestTape");
const alphabetTape = document.getElementById("alphabetTape");
const categoryWordOverlay = document.getElementById(
  "categoryWordOverlay",
);
const cameraToggle = document.getElementById("cameraToggle");
const cameraBackground = document.getElementById("cameraBackground");
const imageBackground = document.getElementById("imageBackground");

let META = {};
let introHasPlayed = false;
let introIsFinishing = false;
let introScrollAnimation = null;
let alphabetIntroSpeed = 1.4;
let alphabetIntroBoost = 0;
let alphabetIntroX = 0;
let cachedAlphabetTapeRows = [];
let cachedAlphabetPatternMap = {};
let cachedKerningMap = {};
let cachedImageMap = {};
let categoryRevealTimer = null;
let categoryWordTimer = null;
let cameraStream = null;
let holeMaskIdCounter = 0;
function createHoleMaskSvg(maskItems, width = 46, height = 450) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  const maskId = `hole-mask-${holeMaskIdCounter++}`;
  const x = width / 2;
  const centers = [41, 87, 133, 179, 225, 271, 317, 363, 409];

  const normalizedItems = (maskItems || []).map((item) => {
    if (typeof item === "number") {
      return { index: item, classes: [], opacity: 1, mode: "circle" };
    }

    return {
      index: item.index,
      classes: item.classes || [],
      opacity: item.opacity ?? 1,
      mode: item.mode || "circle",
    };
  });

  svg.setAttribute("class", "hole-mask-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const defs = document.createElementNS(svgNS, "defs");
  const mask = document.createElementNS(svgNS, "mask");
  mask.setAttribute("id", maskId);
  mask.setAttribute("maskUnits", "userSpaceOnUse");

  const maskRect = document.createElementNS(svgNS, "rect");
  maskRect.setAttribute("x", "0");
  maskRect.setAttribute("y", "0");
  maskRect.setAttribute("width", String(width));
  maskRect.setAttribute("height", String(height));
  maskRect.setAttribute("fill", "white");
  mask.appendChild(maskRect);

  normalizedItems.forEach((item) => {
    if (!Number.isFinite(item.index)) return;

    const cy = centers[item.index] || 0;
    const r = item.index === 3 ? 6 : 11;
    let maskShape;

    if (item.mode === "half") {
      maskShape = document.createElementNS(svgNS, "path");
      maskShape.setAttribute(
        "d",
        `M ${x} ${cy - r} A ${r} ${r} 0 0 0 ${x} ${cy + r} L ${x} ${cy - r} Z`,
      );
    } else if (item.mode === "outline") {
      maskShape = document.createElementNS(svgNS, "circle");
      maskShape.setAttribute("cx", String(x));
      maskShape.setAttribute("cy", String(cy));
      maskShape.setAttribute("r", String(r));
      maskShape.setAttribute("fill", "none");
      maskShape.setAttribute("stroke", "black");
      maskShape.setAttribute("stroke-width", "3");
      maskShape.setAttribute("stroke-dasharray", "3 3");
      maskShape.setAttribute("stroke-linecap", "round");
    } else {
      maskShape = document.createElementNS(svgNS, "circle");
      maskShape.setAttribute("cx", String(x));
      maskShape.setAttribute("cy", String(cy));
      maskShape.setAttribute("r", String(r));
      maskShape.setAttribute("fill", "black");
    }

    if (item.mode !== "outline") {
      const alpha = Math.max(0, Math.min(1, item.opacity));
      const gray = Math.round(255 * (1 - alpha));
      maskShape.setAttribute("fill", `rgb(${gray}, ${gray}, ${gray})`);
    }

    if (item.classes.includes("move-horizontal")) {
      maskShape.classList.add("mask-hole-move-horizontal");
    }
    if (item.classes.includes("move-down")) {
      maskShape.classList.add("mask-hole-move-down");
    }
    if (item.classes.includes("move-up")) {
      maskShape.classList.add("mask-hole-move-up");
    }
    if (item.classes.includes("blink-hole")) {
      maskShape.classList.add("mask-hole-blink");
    }

    mask.appendChild(maskShape);
  });

  defs.appendChild(mask);

  const rect = document.createElementNS(svgNS, "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", String(width));
  rect.setAttribute("height", String(height));
  rect.setAttribute("fill", "#dedede");
  rect.setAttribute("mask", `url(#${maskId})`);

  svg.appendChild(defs);
  svg.appendChild(rect);

  return svg;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const cleanRows = rows.filter((r) =>
    r.some((c) => String(c).trim() !== ""),
  );

  const headers = cleanRows[0].map((h) => h.trim());

  return cleanRows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] || "").trim();
    });
    return obj;
  });
}

async function loadCSV(gid) {
    const res = await fetch(csvUrl(gid));

  if (!res.ok) {
    throw new Error(`CSV load failed: ${res.status}`);
  }

  const text = await res.text();
  return parseCSV(text);
}

function isConfiguredGid(gid) {
  return gid && !String(gid).includes("여기에_");
}

async function loadOptionalCSV(gid) {
  if (!isConfiguredGid(gid)) return [];
  return loadCSV(gid);
}

function normalizeImageMap(raw) {
  const normalized = {};

  if (!raw) return normalized;

  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      const id = String(item.id || item.item_id || "").trim();
      const urls = item.urls || item.images || item.image_urls || [];

      if (!id || !Array.isArray(urls)) return;
      normalized[id] = urls.filter(Boolean);
    });

    return normalized;
  }

  Object.entries(raw).forEach(([key, value]) => {
    const id = String(key).trim();

    if (Array.isArray(value)) {
      normalized[id] = value
        .map((item) => {
          if (typeof item === "string") return item;
          return item.image || item.url || item.thumbnail || "";
        })
        .filter(Boolean);
      return;
    }

    if (value && typeof value === "object") {
      const urls = value.urls || value.images || value.image_urls || [];

      if (Array.isArray(urls)) {
        normalized[id] = urls
          .map((item) => {
            if (typeof item === "string") return item;
            return item.image || item.url || item.thumbnail || "";
          })
          .filter(Boolean);
      }
    }
  });

  return normalized;
}

async function loadImageJSON() {
    for (const url of CMS.imageJsonUrls) {
    try {
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        console.warn(`Image JSON load skipped: ${url} / ${res.status}`);
        continue;
      }

      const raw = await res.json();
      const normalized = normalizeImageMap(raw);
      console.log("Image JSON loaded:", url, normalized);
      return normalized;
    } catch (err) {
      console.warn("Image JSON load skipped:", url, err);
    }
  }

  return {};
}

function isBlockedImageUrl(url) {
  const blockedPatterns = [
    "mydomaine.com/thmb/",
    "playtoearn.com/blog_images/",
    "media.licdn.com/dms/image/",
    "isrjournals.org/img/Open-access-journals.png",
    "slideplayer.com.br/slide/2761988/10/images/2/OpenGL+Open+Graphic+Library.jpg",
    "tc-ay.de/wp-content/uploads/2024/05/what-is-open-era-in-tennis.jpg",
    "newworldreport.digital/wp-content/uploads/2022/03/Open-Data.jpg",
    "blog.glassdoor.com/site-us/wp-content/uploads/sites/2/open-letter-1.png",
    "vpl.ca/sites/default/files/field/image/opendyslexicfont_2.jpg",
    "fast-report.com/uploads/blogpost/maps/osm_en/OpenStreetMap_02_en.png",
    "fast-report.com/uploads/blogpost/maps/osm_en/OpenStreetMap_03_en.png",
    "campusnews.fresnostate.edu/content/issues/20231211-december-11-2023/5-campus-open-forums-for-avp-for-strategic-enrollment-management-and-director-of-the-cross-cultural-and-gender-center/open-forum_cn.png",
  ];

  return blockedPatterns.some((pattern) => url.includes(pattern));
}

function toBool(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y";
}

function buildMeta(rows) {
  const meta = {};

  rows.forEach((row) => {
    if (!row.key) return;
    meta[row.key] = row.value || "";
  });

  return meta;
}

function applyMeta(meta) {
  document.getElementById("nav-open").textContent =
    meta.nav_open || "오픈";
  document.getElementById("nav-compare").textContent =
    meta.nav_compare || "비교하기";
  document.getElementById("nav-suggest").textContent =
    meta.nav_suggest || "제안하기";

  document.getElementById("categoryLabel").textContent =
    meta.nav_category || "카테고리";

  renderCategoryMenu(
    String(meta.category_options || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

  const playlist = document.getElementById("playlistLink");
  playlist.textContent = meta.playlist_label || "▶ Playlist for OPEN";
  playlist.href = meta.playlist_url || "#";

  document.getElementById("currentDate").textContent =
    meta.last_update || "";

  const researchDescription = meta.research_description || "";

  const descriptionText = document.getElementById("descriptionText");
  descriptionText.textContent = researchDescription;

  document.title = meta.site_title || "**WELCOME TO OPEN**";
}

function getTopClassification(data) {
  const isOpen =
    data.openness &&
    data.sharing &&
    (data.contribution || data.collaboration);

  const isPublic = !isOpen && data.openness && data.sharing;
  const isNone = !isOpen && !isPublic;

  return { isOpen, isPublic, isNone };
}

function getTopNote(classification) {
  if (classification.isOpen) {
    return META.top_note_open || "개방+공유+기여 / 개방+공유+협업";
  }

  if (classification.isPublic) {
    return META.top_note_public || "개방+공유";
  }

  return META.top_note_none || "개방 혹은 공유 미포함";
}

function createHoles(states, data = null, mode = "default") {
  const holes = document.createElement("div");
  holes.className = "hole-area";

  const topKeys = [
    null,
    null,
    null,
    null,
    "openness",
    "sharing",
    "participation",
    "contribution",
    "collaboration",
  ];

  const maskItems = [];

  states.forEach((state, i) => {
    const h = document.createElement("div");
    h.className = `hole ${i === 3 ? "small" : "large"}`;

    if (state === true) {
      h.classList.add("active");
      maskItems.push({ index: i, classes: ["active"], opacity: 1 });
    }

    if (typeof state === "string") {
      h.classList.add(state);

      if (state === "half") {
        maskItems.push({
          index: i,
          classes: [state],
          opacity: 1,
          mode: "half",
        });
      }

      if (state === "stage-2") {
        maskItems.push({ index: i, classes: [state], opacity: 0.5 });
      }

      if (state === "blink-hole") {
        maskItems.push({ index: i, classes: [state], opacity: 1 });
      }

      if (state === "outline-hole") {
        maskItems.push({
          index: i,
          classes: [state],
          opacity: 1,
          mode: "outline",
        });
      }
    }

    if (Array.isArray(state)) {
      state.forEach((cls) => h.classList.add(cls));
      if (state.includes("active")) {
        maskItems.push({ index: i, classes: state, opacity: 1 });
      }
    }

    if (mode === "top" && i >= 4 && i <= 8 && data) {
      h.classList.add("clickable-hole");

      h.addEventListener("click", (e) => {
        e.stopPropagation();

        const key = topKeys[i];
        data[key] = !data[key];

        const oldCol = h.closest(".item-column");
        const wasExpanded = oldCol.classList.contains("expanded");
        const newCol = createTopCol(data);

        oldCol.replaceWith(newCol);

        if (wasExpanded) {
          newCol.classList.add("expanded");
        }
      });
    }

    holes.appendChild(h);
  });

  holes.prepend(createHoleMaskSvg(maskItems));

  return holes;
}

function createAlphabetCol(bits) {
  const li = document.createElement("li");
  li.className = "alphabet-column";

  const paddedBits = String(bits || "00000")
    .padEnd(5, "0")
    .slice(0, 5);

  const hStates = [
    false,
    false,
    false,
    true,
    paddedBits[0] === "1",
    paddedBits[1] === "1",
    paddedBits[2] === "1",
    paddedBits[3] === "1",
    paddedBits[4] === "1",
  ];

  li.appendChild(createHoles(hStates));

  return li;
}

function buildAlphabetPatternMap(rows) {
  const map = {};

  rows.forEach((row) => {
    const letter = String(row.letter || "")
      .trim()
      .toUpperCase();
    const pattern = String(row.pattern || "").trim();

    if (!letter || !pattern) return;
    if (!map[letter]) map[letter] = [];

    map[letter].push({
      pattern,

      label: row.label || "",
    });
  });

  return map;
}

function buildKerningMap(rows) {
  const map = {};

  rows.forEach((row) => {
    const leftLabel = String(row.left_label || "")
      .trim()
      .toUpperCase();

    const rightLabel = String(row.right_label || "")
      .trim()
      .toUpperCase();

    const value = parseInt(String(row.gap || "").trim(), 10);

    if (!leftLabel || !rightLabel || !Number.isFinite(value)) return;

    map[`${leftLabel}|${rightLabel}`] = value;
  });

  return map;
}

function getKerningGap(
  leftLabel,
  rightLabel,
  kerningMap,
  defaultGap = 1,
) {
  const left = String(leftLabel || "")
    .trim()
    .toUpperCase();
  const right = String(rightLabel || "")
    .trim()
    .toUpperCase();

  if (!left || !right) return 0;

  const key = `${left}|${right}`;
  const adjustment = kerningMap[key];

  if (!Number.isFinite(adjustment)) return defaultGap;

  return Math.max(0, defaultGap + adjustment);
}

function appendEmptyAlphabetCols(target, count) {
  for (let i = 0; i < count; i++) {
    target.appendChild(createAlphabetCol("00000"));
  }
}

function appendEmptyCategoryWordCols(target, count) {
  for (let i = 0; i < count; i++) {
    target.appendChild(createCategoryWordColumn("00000"));
  }
}

function pickAlphabetPattern(letter, patternMap, mode = "random") {
  const key = String(letter || "").toUpperCase();
  const options = patternMap[key];

  if (!options || !options.length) return null;
  if (mode === "first") return options[0];

  return options[Math.floor(Math.random() * options.length)];
}

const categoryWordKeyMap = {
  개념: "category_word_concept",
  기술: "category_word_technology",
  디지털: "category_word_digital",
  매체: "category_word_medium",
  장소: "category_word_place",
  행위: "category_word_action",
  기타: "category_word_etc",
};

const categoryWordFallbackMap = {
  개념: "CONCEPT",
  기술: "TECHNOLOGY",
  디지털: "DIGITAL",
  매체: "MEDIUM",
  장소: "PLACE",
  행위: "ACTION",
  기타: "ETC",
};

function getCategoryWord(categoryName) {
  const key = categoryWordKeyMap[categoryName] || "";
  return String(
    (key && META[key]) || categoryWordFallbackMap[categoryName] || "",
  )
    .trim()
    .toUpperCase();
}

function createCategoryWordColumn(bits) {
  const col = document.createElement("div");
  col.className = "category-word-column";

  const paddedBits = String(bits || "00000")
    .padEnd(5, "0")
    .slice(0, 5);

  paddedBits.split("").forEach((bit) => {
    const dotSlot = document.createElement("div");

    if (bit === "1") {
      dotSlot.className = "category-word-dot";
    } else {
      dotSlot.className = "category-word-gap";
    }

    col.appendChild(dotSlot);
  });

  return col;
}

function createScoreWordColumn(bits) {
  const col = document.createElement("div");
  col.className = "score-word-column";

  const paddedBits = String(bits || "00000")
    .padEnd(5, "0")
    .slice(0, 5);

  paddedBits.split("").forEach((bit) => {
    const dotSlot = document.createElement("div");
    dotSlot.className = bit === "1" ? "score-word-dot" : "score-word-gap";
    col.appendChild(dotSlot);
  });

  return col;
}

function appendEmptyScoreWordCols(target, count) {
  for (let i = 0; i < count; i++) {
    target.appendChild(createScoreWordColumn("00000"));
  }
}

function createScoreWordGrid(word, variant = "top", maxScale = Infinity) {
  const grid = document.createElement("div");
  grid.className =
    variant === "compare"
      ? "score-word-grid score-word-compare"
      : "score-word-grid";

  const chars = String(word || "")
    .toUpperCase()
    .split("");
  const selectedByIndex = [];

  chars.forEach((char, index) => {
    if (char === " ") return;
    selectedByIndex[index] = pickAlphabetPattern(
      char,
      cachedAlphabetPatternMap,
      "random",
    );
  });

  chars.forEach((char, index) => {
    if (char === " ") {
      appendEmptyScoreWordCols(grid, 5);
      return;
    }

    const selected = selectedByIndex[index];
    const nextSelected = selectedByIndex[index + 1];

    if (!selected) {
      grid.appendChild(createScoreWordColumn("00000"));
    } else {
      selected.pattern.split("/").forEach((bits) => {
        grid.appendChild(createScoreWordColumn(bits));
      });
    }

    const gapCount = getKerningGap(
      selected?.label || "",
      nextSelected?.label || "",
      cachedKerningMap,
      1,
    );

    appendEmptyScoreWordCols(grid, gapCount);
  });

  requestAnimationFrame(() => {
    const parent = grid.parentElement;
    if (!parent) return;

    const rect = grid.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const widthRatio = variant === "compare" ? 0.96 : 0.84;
    const heightRatio = variant === "compare" ? 0.82 : 0.62;
    const scaleX =
      rect.width > 0 ? (parentRect.width * widthRatio) / rect.width : 1;

    const scaleY =
      rect.height > 0
        ? (parentRect.height * heightRatio) / rect.height
        : 1;
    const scale = Math.min(scaleX, scaleY, maxScale);
    grid.style.transform = `scale(${scale})`;
  });

  return grid;
}

function getOpenStateWordFromColumn(col) {
  if (!col) return "NONE";
  const state = col.dataset.openState || "none";
  if (state === "open") return "OPEN";
  if (state === "public") return "PUBLIC";
  return "NONE";
}

function toggleScoreOverlay(id) {
  const columns = document.querySelectorAll(
    `.item-column[data-index="${id}"]`,
  );
  const shouldShow = !Array.from(columns).some((col) =>
    col.classList.contains("score-visible"),
  );

  columns.forEach((col) => {
    col.classList.toggle("score-visible", shouldShow);
  });

  document
    .querySelectorAll(
      `#compareTape .item-column[data-index="${id}"] .score-hole`,
    )
    .forEach((scoreHole) => {
      scoreHole.classList.toggle("score-active", shouldShow);
    });
}

function showAlphabetOverlayWord(
  word,
  duration = 2500,
  maxScale = Infinity,
) {
  const normalizedWord = String(word || "")
    .trim()
    .toUpperCase();

  if (!normalizedWord || !categoryWordOverlay) return;

  if (categoryWordTimer) {
    clearTimeout(categoryWordTimer);
    categoryWordTimer = null;
  }

  categoryWordOverlay.innerHTML = "";
  categoryWordOverlay.classList.remove("visible");

  const grid = document.createElement("div");
  grid.className = "category-word-grid";

  const chars = normalizedWord.split("");
  const selectedByIndex = [];

  chars.forEach((char, index) => {
    if (char === " ") return;

    selectedByIndex[index] = pickAlphabetPattern(
      char,
      cachedAlphabetPatternMap,
      "random",
    );
  });

  chars.forEach((char, index) => {
    if (char === " ") {
      appendEmptyCategoryWordCols(grid, 5);
      return;
    }

    const selected = selectedByIndex[index];
    const nextSelected = selectedByIndex[index + 1];

    if (!selected) {
      grid.appendChild(createCategoryWordColumn("00000"));
    } else {
      selected.pattern.split("/").forEach((bits) => {
        grid.appendChild(createCategoryWordColumn(bits));
      });
    }

    const gapCount = getKerningGap(
      selected?.label || "",
      nextSelected?.label || "",
      cachedKerningMap,
      1,
    );

    appendEmptyCategoryWordCols(grid, gapCount);
  });

  categoryWordOverlay.appendChild(grid);

  requestAnimationFrame(() => {
    const rect = grid.getBoundingClientRect();
    const horizontalPadding = 80;
    const verticalPadding = 120;
    const availableWidth = window.innerWidth - horizontalPadding;
    const availableHeight = window.innerHeight - verticalPadding;
    const scaleX = rect.width > 0 ? availableWidth / rect.width : 1;
    const scaleY = rect.height > 0 ? availableHeight / rect.height : 1;
    const scale = Math.min(scaleX, scaleY, maxScale);

    grid.style.transform = `scale(${scale})`;
    categoryWordOverlay.classList.add("visible");
  });

  categoryWordTimer = setTimeout(() => {
    categoryWordOverlay.classList.remove("visible");
    categoryWordOverlay.innerHTML = "";
    categoryWordTimer = null;
  }, duration);
}

function showCategoryWord(categoryName) {
  const word = getCategoryWord(categoryName);
  showAlphabetOverlayWord(word);
}

function getCostState(value) {
  const v = String(value || "").trim();

  if (v === "없음") return true;
  if (v === "있음") return false;
  if (v === "발생가능" || v === "발생 가능") return "half";
  if (v === "해당없음" || v === "해당 없음") return "outline-hole";

  return false;
}

function getDirectionalityState(value) {
  const v = String(value || "").trim();

  if (v === "⭤") return ["active", "move-horizontal"];
  if (v === "↓") return ["active", "move-down"];
  if (v === "↑") return ["active", "move-up"];
  if (v === "✕") return "hidden-hole";

  return false;
}

function getTemporalityState(value) {
  const v = String(value || "").trim();

  if (v === "상시 개방") return true;
  if (v === "한시적 개방") return "blink-hole";

  return false;
}

function getStageState(value) {
  const v = String(value || "").trim();

  if (v === "1단계") return false;
  if (v === "2단계") return "stage-2";
  if (v === "3단계") return true;

  return false;
}

function createTopCol(data) {
  const classification = getTopClassification(data);

  const li = document.createElement("li");
  li.className = "item-column";
  li.dataset.index = data.id;
  li.dataset.category = data.category || "";
  li.dataset.openState = classification.isOpen
    ? "open"
    : classification.isPublic
      ? "public"
      : "none";

  let locked = false;

  const hStates = [
    classification.isOpen,
    classification.isPublic,
    classification.isNone,
    !!data.category,
    data.openness,
    data.sharing,
    data.participation,
    data.contribution,
    data.collaboration,
  ];

  const holes = createHoles(hStates, data, "top");

  const frame = document.createElement("div");
  frame.className = "info-frame";

  frame.innerHTML = `
<div class="column-a">
  <div class="info-row ${classification.isOpen ? "open-blue" : "inactive"}">${META.top_label_open || "오픈"}</div>
  <div class="info-row ${classification.isPublic ? "" : "inactive"}">${META.top_label_public || "퍼블릭"}</div>
  <div class="info-row ${classification.isNone ? "" : "inactive"}">${META.top_label_none || "해당없음"}</div>
  <div class="info-row">${META.top_label_category || "카테고리"}</div>
  <div class="info-row">${META.top_label_openness || "개방"}</div>
  <div class="info-row">${META.top_label_sharing || "공유"}</div>
  <div class="info-row">${META.top_label_participation || "참여"}</div>
  <div class="info-row">${META.top_label_contribution || "기여"}</div>
  <div class="info-row">${META.top_label_collaboration || "협업"}</div>
</div>

<div class="column-b">
  <div class="info-row ${classification.isOpen ? "open-blue" : "inactive"}">${classification.isOpen ? getTopNote(classification) : ""}</div>
  <div class="info-row ${classification.isPublic ? "" : "inactive"}">${classification.isPublic ? getTopNote(classification) : ""}</div>
  <div class="info-row ${classification.isNone ? "" : "inactive"}">${classification.isNone ? getTopNote(classification) : ""}</div>
  <div class="info-row">${data.category || ""}</div>
  <div class="info-row ${classification.isOpen ? "open-blue" : ""}">${data.title || ""}</div>
  <div class="info-row title-desc-box top-description-box keep-all">${data.description || ""}</div>
</div>
    `;

  const topScoreOverlay = document.createElement("div");
  topScoreOverlay.className = "score-overlay";
  topScoreOverlay.appendChild(
    createScoreWordGrid(getOpenStateWordFromColumn(li)),
  );
  frame.querySelector(".column-b").appendChild(topScoreOverlay);

  li.appendChild(holes);
  li.appendChild(frame);

  li.addEventListener("mouseenter", () => {
    if (!locked) expandSync(data.id, true);
  });

  li.addEventListener("mouseleave", () => {
    if (!locked) expandSync(data.id, false);
  });

  li.addEventListener("click", (e) => {
    if (e.target.classList.contains("hole")) return;

    locked = !locked;

    expandSync(data.id, locked);
  });

  return li;
}

function createCompareImageStrip(data) {
  const strip = document.createElement("div");
  strip.className = "compare-image-strip";
  strip.dataset.query = data.image_query || "";

  const sheetImageUrls = String(data.image_urls || data.images || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  const jsonImageUrls = Array.isArray(cachedImageMap[String(data.id)])
    ? cachedImageMap[String(data.id)]
    : [];

  const imageUrls = (
    sheetImageUrls.length ? sheetImageUrls : jsonImageUrls
  ).filter((url) => !isBlockedImageUrl(url));

  strip.dataset.imageCount = String(imageUrls.length);

  if (imageUrls.length) {
    imageUrls.slice(0, 10).forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = data.image_query || data.title || "related image";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        img.remove();
      };
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!imageBackground) return;

        imageBackground.src = img.currentSrc || img.src;
        body.classList.add("image-mask-on");
      });
      strip.appendChild(img);
    });
  } else {
    ["wide", "xwide", "xwide", "narrow"].forEach((sizeClass) => {
      const placeholder = document.createElement("div");
      placeholder.className = `compare-image-placeholder ${sizeClass}`;
      strip.appendChild(placeholder);
    });
  }

  strip.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
      e.preventDefault();
      e.stopPropagation();
      strip.scrollLeft += e.deltaY;
    }
  });

  return strip;
}

function createCompareCol(data) {
  const li = document.createElement("li");
  li.className = "item-column compare-column";
  li.dataset.index = data.id;
  li.dataset.category = data.category || "";
  let locked = false;

  const hStates = [
    true,
    false,
    false,
    !!data.category,
    getCostState(data.cost),
    getDirectionalityState(data.directionality),
    getTemporalityState(data.temporality),
    getStageState(data.stage),
    data.open_score ? true : false,
  ];

  const holes = createHoles(hStates);
  // Add score-hole and overlay logic
  const scoreHole = holes.querySelector(".hole:last-child");
  if (scoreHole) {
    scoreHole.classList.add("score-hole");
    scoreHole.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleScoreOverlay(data.id);
    });
  }

  const frame = document.createElement("div");
  frame.className = "info-frame";

  frame.innerHTML = `
<div class="column-a">
  <div class="info-row">${META.compare_label_1 || "관련 이미지"}</div>
  <div class="info-row inactive"></div>
  <div class="info-row inactive"></div>
  <div class="info-row">${META.compare_label_category || "카테고리"}</div>
  <div class="info-row">${META.compare_label_cost || "비용"}</div>
  <div class="info-row">${META.compare_label_directionality || "방향성"}</div>
  <div class="info-row">${META.compare_label_temporality || "시간성"}</div>
  <div class="info-row">${META.compare_label_stage || "단계"}</div>
  <div class="info-row">${META.compare_label_open_score || "오픈 스코어"}</div>
</div>

<div class="column-b">
  <div class="info-row compare-image-row"></div>
  <div class="info-row inactive"></div>
  <div class="info-row inactive"></div>
  <div class="info-row">${data.category || ""}</div>
  <div class="info-row">${data.cost || ""}</div>
  <div class="info-row">${data.directionality || ""}</div>
  <div class="info-row">${data.temporality || ""}</div>
  <div class="info-row">${data.stage || ""}</div>
  <div class="info-row compare-open-score-value">${data.open_score || ""}</div>
</div>
    `;

  const imageRow = frame.querySelector(".compare-image-row");
  if (imageRow) {
    imageRow.appendChild(createCompareImageStrip(data));
  }

  const scoreOverlay = document.createElement("div");
  scoreOverlay.className = "score-overlay";
  const scoreValue =
    data.open_score || data.score || data.opening_score || "0";
  scoreOverlay.appendChild(createScoreWordGrid(scoreValue, "compare"));
  frame.querySelector(".column-b").appendChild(scoreOverlay);

  li.appendChild(holes);
  li.appendChild(frame);

  li.addEventListener("mouseenter", () => {
    if (!locked) expandSync(data.id, true);
  });

  li.addEventListener("mouseleave", () => {
    if (!locked) expandSync(data.id, false);
  });

  li.addEventListener("click", (e) => {
    if (e.target.classList.contains("hole")) return;
    locked = !locked;
    expandSync(data.id, locked);
  });

  return li;
}

function createSuggestGuestbookCol(data) {
  const li = document.createElement("li");
  li.className = "suggest-column";

  const holes = document.createElement("div");
  holes.className = "suggest-hole-area";

  const holePattern = [
    "large",
    "large",
    "large",
    "large",
    "large",
    "small",
    "large",
    "large",
    "large",
  ];

  holePattern.forEach((type) => {
    const h = document.createElement("div");
    h.className = `hole ${type} active`;
    holes.appendChild(h);
  });

  holes.prepend(createHoleMaskSvg([0, 1, 2, 3, 4, 5, 6, 7, 8], 54, 450));

  const content = document.createElement("div");
  content.className = "suggest-content";

  content.innerHTML = `
    <div class="guest-name">${data.name || ""}</div>
    <div class="guest-message keep-all">${data.message || ""}</div>
    <div class="guest-time">${data.time || ""}</div>
    <div class="guest-reply-name">${data.replyName || ""}</div>
    <div class="guest-reply keep-all">${data.reply || ""}</div>
    <div class="guest-reply-time">${data.replyTime || ""}</div>
  `;

  li.appendChild(holes);
  li.appendChild(content);

  return li;
}
const suggestFixedHoleArea = document.querySelector(
  ".suggest-fixed-hole-area",
);
if (suggestFixedHoleArea) {
  suggestFixedHoleArea.prepend(
    createHoleMaskSvg([0, 1, 2, 3, 4, 5, 6, 7, 8], 54, 450),
  );
}

function normalizeSuggestionRow(row) {
  return {
    id: row.id || "",
    name: row.name || "",
    message: row.message || "",
    time: row.time || "",
    replyName: row.reply_name || "",
    reply: row.reply || "",
    replyTime: row.reply_time || "",
    visible: String(row.visible || "TRUE")
      .trim()
      .toUpperCase(),
  };
}

function getCurrentTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}. ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

function expandSync(id, state) {
  document
    .querySelectorAll(`.item-column[data-index="${id}"]`)
    .forEach((el) => {
      if (el.closest("#bottomSuggestGroup")) return;
      state
        ? el.classList.add("expanded")
        : el.classList.remove("expanded");
    });
}

function clearTapes() {
  topTape.innerHTML = "";
  compareTape.innerHTML = "";
  suggestTape.innerHTML = "";
  alphabetTape.innerHTML = "";

  const alphabetPaper = document.querySelector(
    ".alphabet-section .punch-paper",
  );
  if (alphabetPaper) alphabetPaper.style.transform = "";

  if (introScrollAnimation) {
    cancelAnimationFrame(introScrollAnimation);
    introScrollAnimation = null;
  }
}

function renderAlphabetTape(tapeRows, patternMap, kerningMap = {}) {
  alphabetTape.innerHTML = "";

  const firstSpeed = parseFloat(tapeRows[0]?.speed || "0.5");

  alphabetIntroSpeed =
    Number.isFinite(firstSpeed) && firstSpeed > 0 ? firstSpeed * 6 : 3;

  tapeRows.forEach((tapeRow) => {
    const text = String(tapeRow.text || "");
    const mode = String(tapeRow.mode || "random")
      .trim()
      .toLowerCase();

    const chars = text.split("");

    const selectedByIndex = [];

    chars.forEach((char, index) => {
      if (char === " ") return;

      selectedByIndex[index] = pickAlphabetPattern(
        char,
        patternMap,
        mode,
      );
    });

    chars.forEach((char, index) => {
      if (char === " ") {
        appendEmptyAlphabetCols(alphabetTape, 5);
        return;
      }

      const selected = selectedByIndex[index];
      const nextSelected = selectedByIndex[index + 1];

      if (!selected) {
        alphabetTape.appendChild(createAlphabetCol("00000"));
      } else {
        selected.pattern.split("/").forEach((bits) => {
          alphabetTape.appendChild(createAlphabetCol(bits));
        });
      }

      const gapCount = getKerningGap(
        selected?.label || "",
        nextSelected?.label || "",
        kerningMap,
        1,
      );

      appendEmptyAlphabetCols(alphabetTape, gapCount);
    });

    appendEmptyAlphabetCols(alphabetTape, 3);
  });
}

function finishIntroSequence(alphabetPaper) {
  if (introIsFinishing) return;

  introIsFinishing = true;

  if (introScrollAnimation) {
    cancelAnimationFrame(introScrollAnimation);
    introScrollAnimation = null;
  }

  if (alphabetPaper) {
    alphabetPaper.style.transform = "";
  }

  setBodyMode("mode-opening");

  setTimeout(() => {
    setBodyMode("mode-open");
  }, 1420);
}

function playIntroSequence() {
  if (introHasPlayed || !alphabetTape.children.length) {
    setBodyMode("mode-open");
    return;
  }

  introHasPlayed = true;
  introIsFinishing = false;
  alphabetIntroBoost = 0;
  setBodyMode("mode-intro");

  const section = document.getElementById("alphabetSection");
  const alphabetPaper = document.querySelector(
    ".alphabet-section .punch-paper",
  );

  if (!alphabetPaper) {
    setBodyMode("mode-open");
    return;
  }

  section.scrollLeft = 0;
  alphabetIntroX = window.innerWidth;
  alphabetPaper.style.transform = `translateX(${alphabetIntroX}px)`;

  requestAnimationFrame(() => {
    const paperWidth = alphabetPaper.offsetWidth;
    const endX = -(paperWidth + 30);
    const speed = alphabetIntroSpeed;

    function step() {
      if (introIsFinishing) return;

      alphabetIntroX -= speed + alphabetIntroBoost;

      alphabetIntroBoost *= 0.92;

      if (alphabetIntroBoost < 0.05) {
        alphabetIntroBoost = 0;
      }

      alphabetPaper.style.transform = `translateX(${alphabetIntroX}px)`;

      if (alphabetIntroX <= endX) {
        finishIntroSequence(alphabetPaper);
        return;
      }

      introScrollAnimation = requestAnimationFrame(step);
    }

    introScrollAnimation = requestAnimationFrame(step);
  });
}

window.addEventListener(
  "wheel",
  (e) => {
    if (!body.classList.contains("mode-intro")) return;
    if (introIsFinishing) return;

    const alphabetPaper = document.querySelector(
      ".alphabet-section .punch-paper",
    );

    if (!alphabetPaper) return;

    const paperWidth = alphabetPaper.offsetWidth;
    const endX = -(paperWidth + 30);
    const wheelBoost = Math.abs(e.deltaY) * 0.09;

    alphabetIntroX -= wheelBoost;
    alphabetIntroBoost += Math.abs(e.deltaY) * 0.01;
    alphabetIntroBoost = Math.min(alphabetIntroBoost, 28);

    alphabetPaper.style.transform = `translateX(${alphabetIntroX}px)`;

    if (alphabetIntroX <= endX) {
      finishIntroSequence(alphabetPaper);
    }
  },
  { passive: true },
);

async function initCMS() {
  try {
    clearTapes();

    const [
      metaRows,
      itemRows,
      compareRows,
      suggestionRows,
      alphabetRows,
      kerningRows,
      alphabetTapeRows,
      imageMap,
    ] = await Promise.all([
      loadCSV(CMS.gids.meta),
      loadCSV(CMS.gids.items),
      loadCSV(CMS.gids.compare),
      loadCSV(CMS.gids.suggestions),
      loadOptionalCSV(CMS.gids.alphabet),
      loadOptionalCSV(CMS.gids.kerning),
      loadOptionalCSV(CMS.gids.alphabetTape),
      loadImageJSON(),
    ]);

    META = buildMeta(metaRows);
    applyMeta(META);
    cachedAlphabetTapeRows = alphabetTapeRows;
    cachedAlphabetPatternMap = buildAlphabetPatternMap(alphabetRows);
    cachedKerningMap = buildKerningMap(kerningRows);
    cachedImageMap = imageMap || {};
    renderAlphabetTape(
      cachedAlphabetTapeRows,
      cachedAlphabetPatternMap,
      cachedKerningMap,
    );

    const items = itemRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      openness: toBool(row.openness),
      sharing: toBool(row.sharing),
      participation: toBool(row.participation),
      contribution: toBool(row.contribution),
      collaboration: toBool(row.collaboration),
    }));

    const compareById = {};

    compareRows.forEach((row) => {
      compareById[row.id] = row;
    });

    items.forEach((item) => {
      topTape.appendChild(createTopCol(item));

      const compareData = {
        ...item,
        ...(compareById[item.id] || {}),
      };

      compareTape.appendChild(createCompareCol(compareData));
    });

    suggestionRows
      .map(normalizeSuggestionRow)
      .filter((entry) => {
        return String(entry.visible).trim().toUpperCase() === "TRUE";
      })
      .reverse()
      .forEach((entry) => {
        suggestTape.appendChild(createSuggestGuestbookCol(entry));
      });

    requestAnimationFrame(() => {
      bSuggS.scrollLeft = 0;
      playIntroSequence();
    });
  } catch (err) {
    console.error(err);
    topTape.innerHTML = `
  <div class="load-error">
    CMS 데이터를 불러오지 못했습니다. 시트 공유 설정, spreadsheetId, gid를 확인하세요.
  </div>
`;
  }
}

async function submitSuggestion() {
  const nameInput = document.getElementById("nameInput");
  const messageInput = document.getElementById("msgInput");

  const name = nameInput.value.trim();
  const message = messageInput.value.trim();

  if (!name || !message) return;

  const time = getCurrentTimestamp();

  const entry = {
    name,
    message,
    time,
    replyName: "",
    reply: "",
    replyTime: "",
  };

  const newGuestbook = createSuggestGuestbookCol(entry);
  suggestTape.insertBefore(newGuestbook, suggestTape.firstChild);

  requestAnimationFrame(() => {
    bSuggS.scrollTo({
      left: 0,
      behavior: "smooth",
    });
  });

  nameInput.value = "";
  messageInput.value = "";
  messageInput.style.height = "120px";
  messageInput.style.overflowY = "hidden";

  if (!CMS.suggestPostUrl || CMS.suggestPostUrl.includes("여기에_")) {
    console.warn(
      "CMS.suggestPostUrl이 아직 설정되지 않았습니다. 화면에는 추가됐지만 시트에는 저장되지 않았습니다.",
    );
    return;
  }

  try {
    await fetch(CMS.suggestPostUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        name,
        message,
        time,
      }),
    });
  } catch (err) {
    console.error("Suggestion save failed:", err);
  }
}

let isSyncing = false;

topS.addEventListener("scroll", () => {
  if (body.classList.contains("mode-compare") && !isSyncing) {
    isSyncing = true;
    bCompS.scrollLeft = topS.scrollLeft;
    isSyncing = false;
  }
});

bCompS.addEventListener("scroll", () => {
  if (body.classList.contains("mode-compare") && !isSyncing) {
    isSyncing = true;
    topS.scrollLeft = bCompS.scrollLeft;
    isSyncing = false;
  }
});

[topS, bCompS, bSuggS].forEach((s) => {
  s.addEventListener("wheel", (e) => {
    const verticalScrollTarget = e.target.closest(
      "#msgInput, .guest-message, .guest-reply, .title-desc-box",
    );

    if (
      verticalScrollTarget &&
      verticalScrollTarget.scrollHeight >
        verticalScrollTarget.clientHeight
    ) {
      e.stopPropagation();

      return;
    }

    if (e.deltaY !== 0) {
      e.preventDefault();

      s.scrollLeft += e.deltaY * 1.2;
    }
  });
});

function setMode(m) {
  setBodyMode(body.classList.contains(m) ? "mode-open" : m);
  if (m === "mode-compare") bCompS.scrollLeft = topS.scrollLeft;
}

function closeImageMask() {
  if (!body.classList.contains("image-mask-on")) return;

  body.classList.remove("image-mask-on");
  if (imageBackground) imageBackground.removeAttribute("src");
}

document.addEventListener("click", (e) => {
  if (!body.classList.contains("image-mask-on")) return;
  if (e.target.closest(".compare-image-strip img")) return;

  closeImageMask();
});

document.getElementById("nav-open").onclick = () => {
  showAlphabetOverlayWord("OPEN", 1200, 1);

  setMode("mode-open");
};

document.getElementById("nav-compare").onclick = (e) => {
  e.stopPropagation();
  showAlphabetOverlayWord("COMPARE", 1200, 1);
  setMode("mode-compare");
};

document.getElementById("nav-suggest").onclick = (e) => {
  e.stopPropagation();
  showAlphabetOverlayWord("SUGGESTIONS", 1200, 1);
  setMode("mode-suggest");
};

const categoryDropdown = document.getElementById("categoryDropdown");
const categoryToggle = document.getElementById("categoryToggle");
const categoryMenu = document.getElementById("categoryMenu");

let activeCategory = "";

function renderCategoryMenu(options) {
  categoryMenu.innerHTML = `
    <div class="category-menu-start" aria-hidden="true"></div>
    ${options.map((option) => `<div class="category-option">${option}</div>`).join("")}
  `;
}

function toggleCategoryDropdown() {
  const isOpen = categoryDropdown.classList.toggle("open");
  categoryToggle.setAttribute("aria-expanded", String(isOpen));
  categoryMenu.setAttribute("aria-hidden", String(!isOpen));
}

function highlightCategory(categoryName) {
  const shouldClear = activeCategory === categoryName;
  activeCategory = shouldClear ? "" : categoryName;
  const isClearingCategory = shouldClear;

  if (categoryRevealTimer) {
    clearTimeout(categoryRevealTimer);
    categoryRevealTimer = null;
  }

  const targetColumns = document.querySelectorAll(
    "#topTape .item-column, #compareTape .item-column",
  );

  targetColumns.forEach((col) => {
    const category = col.dataset.category || "";
    const isMatch = !activeCategory || category.includes(activeCategory);

    col.classList.remove("category-muted");
    col.classList.remove("category-hidden");
    col.classList.remove("category-reveal");
    col.classList.remove("category-folding");
    col.classList.remove("category-unfold-refold");
    col.classList.remove("expanded");

    if (!isMatch) {
      col.classList.add("category-hidden");
      return;
    }

    if (activeCategory) {
      col.classList.add("category-folding");
    } else if (isClearingCategory) {
      col.classList.add("category-unfold-refold");
    }
  });

  if (activeCategory) {
    showCategoryWord(activeCategory);

    categoryRevealTimer = setTimeout(() => {
      targetColumns.forEach((col) => {
        col.classList.remove("category-folding");
      });
      categoryRevealTimer = null;
    }, 1420);
  } else if (isClearingCategory) {
    categoryRevealTimer = setTimeout(() => {
      targetColumns.forEach((col) => {
        col.classList.remove("category-unfold-refold");
      });
      categoryRevealTimer = null;
    }, 2220);
  }

  document.querySelectorAll(".category-option").forEach((option) => {
    const isActive = option.textContent.trim() === activeCategory;
    option.classList.toggle("active", isActive);
  });

  topS.scrollLeft = 0;
  bCompS.scrollLeft = 0;
}

categoryToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleCategoryDropdown();
});

categoryToggle.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggleCategoryDropdown();
  }
});

categoryMenu.addEventListener("click", (e) => {
  const option = e.target.closest(".category-option");
  if (!option) return;

  e.stopPropagation();
  highlightCategory(option.textContent.trim());
});

document.addEventListener("click", (e) => {
  if (!categoryDropdown.contains(e.target)) {
    categoryDropdown.classList.remove("open");
    categoryToggle.setAttribute("aria-expanded", "false");
    categoryMenu.setAttribute("aria-hidden", "true");
  }
});

document
  .getElementById("submitBtn")
  .addEventListener("click", submitSuggestion);

const SIDEBAR_H = 450;

msgInput.addEventListener("input", function () {
  this.style.height = "120px";
  const maxMsgH = SIDEBAR_H - 178;

  if (this.scrollHeight >= maxMsgH) {
    this.style.height = maxMsgH + "px";
    this.style.overflowY = "auto";
  } else {
    this.style.height = this.scrollHeight + "px";
    this.style.overflowY = "hidden";
  }
});

msgInput.onwheel = (e) => {
  if (msgInput.scrollHeight > msgInput.clientHeight) e.stopPropagation();
};

document.addEventListener("click", (e) => {
  if (!body.classList.contains("mode-intro")) return;
  if (!cachedAlphabetTapeRows.length) return;

  e.preventDefault();
  renderAlphabetTape(
    cachedAlphabetTapeRows,
    cachedAlphabetPatternMap,
    cachedKerningMap,
  );
  const alphabetPaper = document.querySelector(
    ".alphabet-section .punch-paper",
  );
  if (alphabetPaper) {
    alphabetPaper.style.transform = `translateX(${alphabetIntroX}px)`;
  }
});

async function enableCameraMask() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    cameraBackground.srcObject = null;
    body.classList.remove("camera-mask-on");
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    cameraBackground.srcObject = cameraStream;
    body.classList.add("camera-mask-on");
  } catch (err) {
    console.error("Camera permission failed:", err);
    alert("카메라 권한을 허용해야 마스크 모드를 사용할 수 있습니다.");
  }
}

cameraToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  showAlphabetOverlayWord("CAMERA", 1200, 1);
  enableCameraMask();
});

cameraToggle.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  e.stopPropagation();
  showAlphabetOverlayWord("CAMERA", 1200);
  enableCameraMask();
});

initCMS();
