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
    system: "1121970842",
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

function buildSystemMap(rows) {
  const map = {};

  rows.forEach((row) => {
    const key =
      row.key ||
      row.id ||
      row.name ||
      row.term ||
      row.category ||
      row.type ||
      "";
    const normalizedKey = String(key).trim();

    if (!normalizedKey) return;
    map[normalizedKey] = row;
  });

  return map;
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

function getScreenDescription(text) {
  return String(text || "").split(/\r?\n/)[0] || "";
}

function formatPrintTitle(title) {
  const value = normalizePrintText(title)
    .trim()
    .replace(/\n{2,}/g, "\n");
  if (value.includes("\n")) {
    const lines = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const englishStart = lines.findIndex(
      (line, index) =>
        index > 0 && /[A-Za-z]/.test(line) && !/[가-힣]/.test(line),
    );

    if (englishStart > 0) {
      return [
        lines.slice(0, englishStart).join(" "),
        lines.slice(englishStart).join(" "),
      ].join("\n");
    }

    return lines.join("\n");
  }

  const match = value.match(/^(.+?)\s+([A-Za-z][A-Za-z0-9.,?!;:“”‘’\-\s]*)$/);
  if (!match) return value;

  return `${match[1].trim()}\n${match[2].trim()}`;
}

function getPrintOrder(row) {
  const raw =
    row.print_order ||
    row.printOrder ||
    row["print order"] ||
    row["Print Order"] ||
    "";
  const value = Number.parseFloat(String(raw).trim());

  return Number.isFinite(value) ? value : Infinity;
}

function getTrimWidth(pageNumber) {
  if (pageNumber === 44) return 297;
  return 137 + Math.floor((pageNumber - 1) / 2) * 7.5;
}

function createPrintEl(tag, className = "", text = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = normalizePrintText(text);
  return el;
}

function appendPrintTextRun(parent, text) {
  const normalized = normalizePrintText(text);
  const arialPattern = /[A-Za-z0-9.,?!;:“”‘’]+/g;
  let cursor = 0;
  let match;

  while ((match = arialPattern.exec(normalized))) {
    if (match.index > cursor) {
      parent.appendChild(
        document.createTextNode(normalized.slice(cursor, match.index)),
      );
    }

    const span = createPrintEl("span", "print-arial");
    span.textContent = match[0];
    parent.appendChild(span);
    cursor = match.index + match[0].length;
  }

  if (cursor < normalized.length) {
    parent.appendChild(document.createTextNode(normalized.slice(cursor)));
  }
}

function createPrintSvg(className, viewBox, width, height) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");

  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("aria-hidden", "true");

  return svg;
}

function setPrintText(el, text) {
  el.textContent = "";
  appendPrintTextRun(el, text);
}

function normalizePrintText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
}

function getRecordText(record, field) {
  if (!record) return "";
  return normalizePrintText(record[field] || record[field.toLowerCase()] || "");
}

function getKoEn(record) {
  const ko = getRecordText(record, "ko");
  const en = getRecordText(record, "en");
  return [ko, en].filter(Boolean).join(" ");
}

function getMetaLowercase(key) {
  const explicit = META[`${key}_lowcase`];
  const fallback = META[key];

  return explicit || String(fallback || "").toLowerCase();
}

function getMetaTitleCase(key) {
  const value = String(META[key] || "").trim();
  if (!value) return "";

  return value.replace(/\S+/g, (word) => {
    const firstLetter = word.search(/[A-Za-z]/);
    if (firstLetter < 0) return word;

    return (
      word.slice(0, firstLetter) +
      word.charAt(firstLetter).toUpperCase() +
      word.slice(firstLetter + 1).toLowerCase()
    );
  });
}

function appendPrintLines(parent, className, lines) {
  const box = createPrintEl("div", className);

  lines.forEach((line) => {
    const item = createPrintEl("div", line.className || "");
    setPrintText(item, line.text || "");
    box.appendChild(item);
  });

  parent.appendChild(box);

  return box;
}

function createPrintBindingHoles(pageNumber) {
  const holes = createPrintEl("div", "print-binding-holes");

  for (let i = 0; i < 20; i++) {
    holes.appendChild(createPrintEl("span", "print-binding-hole"));
  }

  return holes;
}

function createPrintTrimLine() {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  const line = document.createElementNS(svgNS, "line");

  svg.setAttribute("class", "print-trim-line");
  svg.setAttribute("viewBox", "0 0 1 210");
  svg.setAttribute("width", "1mm");
  svg.setAttribute("height", "210mm");
  svg.setAttribute("aria-hidden", "true");

  line.setAttribute("x1", "0.5");
  line.setAttribute("y1", "0");
  line.setAttribute("x2", "0.5");
  line.setAttribute("y2", "210");
  line.setAttribute("stroke", "#000000");
  line.setAttribute("stroke-width", "0.0706");
  line.setAttribute("stroke-dasharray", "1 1");
  line.setAttribute("vector-effect", "non-scaling-stroke");

  svg.appendChild(line);

  return svg;
}

function createPrintFrontMarks() {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  const paths = [
    "M25.5 43.5 H33.5 M36.5 32.5 V40.5",
    "M176.5 43.5 H184.5 M173.5 32.5 V40.5",
    "M25.5 253.5 H33.5 M36.5 256.5 V264.5",
    "M176.5 253.5 H184.5 M173.5 256.5 V264.5",
  ];

  svg.setAttribute("class", "print-front-marks");
  svg.setAttribute("viewBox", "0 0 210 297");
  svg.setAttribute("width", "210mm");
  svg.setAttribute("height", "297mm");
  svg.setAttribute("aria-hidden", "true");

  paths.forEach((d) => {
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#000000");
    path.setAttribute("stroke-width", "0.0706");
    svg.appendChild(path);
  });

  return svg;
}

function createPrintWebCircles() {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  const circles = [
    { d: 5, gapAfter: 2.1 },
    { d: 5, gapAfter: 2.1 },
    { d: 5, gapAfter: 2.95 },
    { d: 3.3, gapAfter: 2.95 },
    { d: 5, gapAfter: 2.1 },
    { d: 5, gapAfter: 2.1 },
    { d: 5, gapAfter: 2.1 },
    { d: 5, gapAfter: 2.1 },
    { d: 5, gapAfter: 0 },
  ];
  let cy = 14.75;

  svg.setAttribute("class", "print-web-circles");
  svg.setAttribute("viewBox", "0 0 8 80");
  svg.setAttribute("width", "8mm");
  svg.setAttribute("height", "80mm");
  svg.setAttribute("aria-hidden", "true");

  circles.forEach((item) => {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", "3.75");
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", String(item.d / 2 - 0.035));
    circle.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(circle);
    const next = circles[svg.childNodes.length];
    if (next) cy += item.d / 2 + item.gapAfter + next.d / 2;
  });

  return svg;
}

function setPrintWebCirclesFill(svg, fill) {
  svg.querySelectorAll("circle").forEach((circle) => {
    circle.setAttribute("fill", fill);
  });
}

function createPrintOddAssistCircles() {
  const svg = createPrintWebCircles();
  svg.classList.add("print-odd-assist-circles");
  setPrintWebCirclesFill(svg, "#1155CC");

  Array.from(svg.querySelectorAll("circle")).forEach((circle, index) => {
    if (index === 3) circle.remove();
  });

  return svg;
}

function createPrintPartialWebCircles() {
  const svg = createPrintWebCircles();
  svg.classList.add("print-web-circles-partial");
  setPrintWebCirclesFill(svg, "#ffffff");

  Array.from(svg.querySelectorAll("circle")).forEach((circle, index) => {
    if (index === 1 || index === 2) circle.remove();
  });

  return svg;
}

const PRINT_HOLE_SIZE = 5;
const PRINT_HOLE_GAP = 2.1;
const PRINT_HOLE_PITCH = PRINT_HOLE_SIZE + PRINT_HOLE_GAP;

function getHardcopyPattern(char, mode = "first") {
  const value = String(char || "").toUpperCase();
  const fallbackPatterns = {
    A: ["01110", "10001", "11111", "10001", "10001"],
    B: ["11110", "10001", "11110", "10001", "11110"],
    C: ["01111", "10000", "10000", "10000", "01111"],
    D: ["11110", "10001", "10001", "10001", "11110"],
    E: ["11111", "10000", "11110", "10000", "11111"],
    F: ["11111", "10000", "11110", "10000", "10000"],
    G: ["01111", "10000", "10011", "10001", "01111"],
    H: ["10001", "10001", "11111", "10001", "10001"],
    I: ["11111", "00100", "00100", "00100", "11111"],
    J: ["00111", "00010", "00010", "10010", "01100"],
    K: ["10001", "10010", "11100", "10010", "10001"],
    L: ["10000", "10000", "10000", "10000", "11111"],
    M: ["10001", "11011", "10101", "10001", "10001"],
    N: ["10001", "11001", "10101", "10011", "10001"],
    O: ["01110", "10001", "10001", "10001", "01110"],
    P: ["11110", "10001", "11110", "10000", "10000"],
    Q: ["01110", "10001", "10001", "10011", "01111"],
    R: ["11110", "10001", "11110", "10010", "10001"],
    S: ["01111", "10000", "01110", "00001", "11110"],
    T: ["11111", "00100", "00100", "00100", "00100"],
    U: ["10001", "10001", "10001", "10001", "01110"],
    V: ["10001", "10001", "10001", "01010", "00100"],
    W: ["10001", "10001", "10101", "11011", "10001"],
    X: ["10001", "01010", "00100", "01010", "10001"],
    Y: ["10001", "01010", "00100", "00100", "00100"],
    Z: ["11111", "00010", "00100", "01000", "11111"],
    0: ["11111", "10001", "10001", "10001", "11111"],
    1: ["00100", "01100", "00100", "00100", "01110"],
    2: ["11110", "00001", "11110", "10000", "11111"],
    3: ["11110", "00001", "01110", "00001", "11110"],
    4: ["10010", "10010", "11111", "00010", "00010"],
    5: ["11111", "10000", "11110", "00001", "11110"],
    6: ["01111", "10000", "11110", "10001", "01110"],
    7: ["11111", "00010", "00100", "01000", "01000"],
    8: ["01110", "10001", "01110", "10001", "01110"],
    9: ["01110", "10001", "01111", "00001", "11110"],
  };
  const selected = pickAlphabetPattern(
    value,
    cachedAlphabetPatternMap || {},
    mode,
  );

  if (selected?.pattern) return selected.pattern.split("/");
  return fallbackPatterns[value] || [];
}

function pickAlphabetPatternByLabel(letter, label) {
  const key = String(letter || "").toUpperCase();
  const targetLabel = String(label || "")
    .trim()
    .toUpperCase();
  const canonicalTargetLabel = targetLabel.replace(/[^A-Z0-9가-힣→]/g, "");
  const options = cachedAlphabetPatternMap[key] || [];

  return (
    options.find(
      (option) => {
        const optionLabel = String(option.label || "")
          .trim()
          .toUpperCase();
        const canonicalOptionLabel = optionLabel.replace(
          /[^A-Z0-9가-힣→]/g,
          "",
        );

        return (
          optionLabel === targetLabel ||
          canonicalOptionLabel === canonicalTargetLabel
        );
      },
    ) || null
  );
}

function getHardcopyGlyphColumns(glyphs) {
  const columns = [];

  glyphs.forEach((glyph, index) => {
    const selected = glyph.label
      ? pickAlphabetPatternByLabel(glyph.char, glyph.label)
      : pickAlphabetPattern(
          glyph.char,
          cachedAlphabetPatternMap || {},
          glyph.mode || "first",
        );
    const pattern =
      selected?.pattern?.split("/") || getHardcopyPattern(glyph.char);

    if (!pattern.length) return;
    columns.push(...pattern);
    if (index < glyphs.length - 1) columns.push("00000");
  });

  return columns;
}

function createHardcopyHoleSvgFromColumns(
  columns,
  className = "print-hardcopy-code",
) {
  const svgNS = "http://www.w3.org/2000/svg";
  const normalizedColumns = columns.length ? columns : ["00000"];
  const width =
    normalizedColumns.length * PRINT_HOLE_SIZE +
    (normalizedColumns.length - 1) * PRINT_HOLE_GAP;
  const height = 5 * PRINT_HOLE_SIZE + 4 * PRINT_HOLE_GAP;
  const svg = createPrintSvg(
    className,
    `0 0 ${width} ${height}`,
    `${width}mm`,
    `${height}mm`,
  );

  normalizedColumns.forEach((bits, colIndex) => {
    String(bits || "00000")
      .padEnd(5, "0")
      .slice(0, 5)
      .split("")
      .forEach((bit, rowIndex) => {
        if (bit !== "1") return;
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute(
          "cx",
          String(colIndex * PRINT_HOLE_PITCH + PRINT_HOLE_SIZE / 2),
        );
        circle.setAttribute(
          "cy",
          String(rowIndex * PRINT_HOLE_PITCH + PRINT_HOLE_SIZE / 2),
        );
        circle.setAttribute("r", String(PRINT_HOLE_SIZE / 2));
        svg.appendChild(circle);
      });
  });

  svg.dataset.hardcopyWidth = String(width);
  svg.dataset.hardcopyHeight = String(height);

  return svg;
}

function createHardcopyHoleText(text, className = "print-hardcopy-code") {
  const columns = [];

  normalizePrintText(text)
    .split("")
    .forEach((char) => {
      if (char === "\n") return;
      if (char === " ") {
        columns.push("00000", "00000");
        return;
      }

      const pattern = getHardcopyPattern(char);
      if (!pattern.length) return;
      columns.push(...pattern, "00000");
    });

  if (columns.length && columns[columns.length - 1] === "00000") {
    columns.pop();
  }

  return createHardcopyHoleSvgFromColumns(columns, className);
}

function createHardcopyHoleGlyphs(glyphs, className = "print-hardcopy-code") {
  return createHardcopyHoleSvgFromColumns(
    getHardcopyGlyphColumns(glyphs),
    className,
  );
}

function createHardcopyArrow(className = "print-hardcopy-code") {
  const pattern = pickAlphabetPattern("→", cachedAlphabetPatternMap || {}, "first");
  if (!pattern?.pattern) return null;

  return createHardcopyHoleSvgFromColumns(pattern.pattern.split("/"), className);
}

const BACK_COVER_GLYPH_LABELS = {
  O: "O_1",
  P: "P_3",
  N: "N_2",
  R: "R_3",
  E: "E_2",
  S: "S_1",
  A: "A_3",
  C: "C_1",
  H: "H2",
};

function getBackCoverTokenPattern(token) {
  if (token === "→") {
    const selected = pickAlphabetPattern(
      "→",
      cachedAlphabetPatternMap || {},
      "first",
    );

    return {
      pattern: selected?.pattern?.split("/") || [],
      label: selected?.label || "→",
    };
  }

  const char = String(token || "").toUpperCase();
  const label = BACK_COVER_GLYPH_LABELS[char] || "";
  const selected = label ? pickAlphabetPatternByLabel(char, label) : null;

  return {
    pattern: selected?.pattern?.split("/") || getHardcopyPattern(char),
    label: selected?.label || label || char,
  };
}

function getBackCoverTokenColumns(tokens) {
  const columns = [];
  const selectedByIndex = [];

  tokens.forEach((token, index) => {
    if (token === " ") return;
    selectedByIndex[index] = getBackCoverTokenPattern(token);
  });

  tokens.forEach((token, index) => {
    if (token === " ") {
      columns.push("00000", "00000");
      return;
    }

    const selected = selectedByIndex[index];
    const nextSelected = selectedByIndex[index + 1];

    if (!selected?.pattern?.length) return;

    columns.push(...selected.pattern);

    const gapCount = getKerningGap(
      selected.label || "",
      nextSelected?.label || "",
      cachedKerningMap,
      1,
    );
    const normalizedPair = `${normalizeKerningLabel(
      selected.label,
    )}|${normalizeKerningLabel(nextSelected?.label)}`;
    const resolvedGapCount = normalizedPair === "R3|C1" ? 0 : gapCount;

    for (let i = 0; i < resolvedGapCount; i++) columns.push("00000");
  });

  return columns;
}

function createBackCoverHoleText(text, className = "print-back-cover-title") {
  const columns = [];

  normalizePrintText(text)
    .split("")
    .forEach((char, index, chars) => {
      if (char === "\n") return;
      if (char === " ") {
        columns.push("00000", "00000");
        return;
      }

      const pattern = getHardcopyPattern(char);
      if (!pattern.length) return;
      columns.push(...pattern);
      if (index < chars.length - 1) columns.push("00000");
    });

  while (columns[columns.length - 1] === "00000") columns.pop();

  return createHardcopyHoleSvgFromColumns(columns, className);
}

function createBackCoverEnglishWord(text, className = "") {
  return createHardcopyHoleSvgFromColumns(
    getBackCoverTokenColumns(text.split("")),
    `print-back-cover-title print-back-cover-title-en ${className}`.trim(),
  );
}

function appendBackCoverTitleLayer(trim, node, left, top) {
  node.style.left = `${left}mm`;
  node.style.top = `${top}mm`;
  trim.appendChild(node);
}

function appendPrintBackCoverTitles(trim) {
  const rows = [
    {
      ko: "오픈리서치",
      koX: 10,
      koY: 10,
      openX: 66.82,
      openY: 38.5,
      arrowX: 187.52,
      arrowY: 24.2,
      researchX: 10,
      researchY: 67,
    },
    {
      ko: "오픈 리서치",
      koX: 10,
      koY: 108.354,
      openX: 81.02,
      openY: 136.854,
      arrowX: 208.82,
      arrowY: 122.554,
      researchX: 10,
      researchY: 165.354,
    },
  ];

  rows.forEach((row) => {
    appendBackCoverTitleLayer(
      trim,
      createBackCoverHoleText(row.ko, "print-back-cover-title print-back-cover-title-ko"),
      row.koX,
      row.koY,
    );
    appendBackCoverTitleLayer(
      trim,
      createBackCoverEnglishWord("OPEN", "print-back-cover-title-open"),
      row.openX,
      row.openY,
    );
    appendBackCoverTitleLayer(
      trim,
      createBackCoverEnglishWord("→", "print-back-cover-title-arrow"),
      row.arrowX,
      row.arrowY,
    );
    appendBackCoverTitleLayer(
      trim,
      createBackCoverEnglishWord("RESEARCH", "print-back-cover-title-research"),
      row.researchX,
      row.researchY,
    );
  });
}

function createHardcopyPageNumber(pageNumber) {
  const digits = String(pageNumber).split("");
  const svgNS = "http://www.w3.org/2000/svg";
  const columns = [];

  digits.forEach((digit, index) => {
    columns.push(...getHardcopyPattern(digit));
    if (index < digits.length - 1) {
      columns.push("00000");
    }
  });

  const width = columns.length * PRINT_HOLE_SIZE + (columns.length - 1) * PRINT_HOLE_GAP;
  const height = 5 * PRINT_HOLE_SIZE + 4 * PRINT_HOLE_GAP;
  const svg = createPrintSvg(
    "print-page-number-code",
    `0 0 ${width} ${height}`,
    `${width}mm`,
    `${height}mm`,
  );

  columns.forEach((bits, colIndex) => {
    String(bits)
      .padEnd(5, "0")
      .slice(0, 5)
      .split("")
      .forEach((bit, rowIndex) => {
        if (bit !== "1") return;
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute(
          "cx",
          String(colIndex * PRINT_HOLE_PITCH + PRINT_HOLE_SIZE / 2),
        );
        circle.setAttribute(
          "cy",
          String(rowIndex * PRINT_HOLE_PITCH + PRINT_HOLE_SIZE / 2),
        );
        circle.setAttribute("r", String(PRINT_HOLE_SIZE / 2));
        svg.appendChild(circle);
      });
  });

  return svg;
}

function appendPrintPageNumber(trim, pageNumber) {
  if (pageNumber < 3 || pageNumber % 2 === 0) return;

  const number = createHardcopyPageNumber(pageNumber);
  number.style.top = "12.5mm";
  number.style.left =
    pageNumber === 3 ? "134.5mm" : `${getTrimWidth(pageNumber) - 33}mm`;
  number.style.transform = "translateX(-100%)";
  trim.insertBefore(number, trim.firstChild);
}

function appendPrintOddAssistCircles(trim, pageNumber) {
  if (pageNumber <= 3 || pageNumber % 2 === 0 || pageNumber === 44) return;

  ["0mm", "95.5mm"].forEach((top) => {
    const circles = createPrintOddAssistCircles();
    circles.style.left = `${getTrimWidth(pageNumber) - 10.5}mm`;
    circles.style.top = top;
    circles.style.transform = "translateX(-100%)";
    trim.insertBefore(circles, trim.firstChild);
  });
}

function appendPrintCoverCode(trim, className = "print-hardcopy-code") {
  const text = META.hardcopy_title || META.title || "";
  if (!text) return;

  const code = createHardcopyHoleText(text, className);
  trim.appendChild(code);
}

function appendPrintCoverTitleMarks(trim) {
  const koTitle = createHardcopyHoleText("오픈", "print-cover-title-ko");
  koTitle.style.left = "20mm";
  koTitle.style.top = "12.5mm";
  trim.appendChild(koTitle);

  const enTitle = createHardcopyHoleGlyphs(
    [
      { char: "O", label: "O_1" },
      { char: "P", label: "P_1" },
      { char: "E", label: "E_1" },
      { char: "N", label: "N_1" },
    ],
    "print-cover-title-en",
  );
  enTitle.style.left = "10mm";
  enTitle.style.top = "131.852mm";
  trim.appendChild(enTitle);

  const arrow = createHardcopyArrow("print-cover-arrow");
  if (!arrow) return;

  const width = Number.parseFloat(arrow.dataset.hardcopyWidth || "0");
  const height = Number.parseFloat(arrow.dataset.hardcopyHeight || "0");
  arrow.style.left = `${127 - width}mm`;
  arrow.style.top = `${150.447 - height / 2}mm`;
  trim.appendChild(arrow);
}

function getQrFormatBits(mask) {
  const data = (1 << 3) | mask;
  let bits = data << 10;

  for (let i = 14; i >= 10; i--) {
    if (((bits >> i) & 1) === 1) bits ^= 0x537 << (i - 10);
  }

  return ((data << 10) | bits) ^ 0x5412;
}

function getQrErrorCorrection(dataCodewords, eccLength) {
  const exp = new Array(512);
  const log = new Array(256);
  let value = 1;

  for (let i = 0; i < 255; i++) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];

  const multiply = (a, b) => (a && b ? exp[log[a] + log[b]] : 0);
  let generator = [1];

  for (let degree = 0; degree < eccLength; degree++) {
    const next = new Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= multiply(coefficient, exp[degree]);
    });
    generator = next;
  }

  const result = new Array(eccLength).fill(0);
  dataCodewords.forEach((codeword) => {
    const factor = codeword ^ result.shift();
    result.push(0);
    generator.slice(1).forEach((coefficient, index) => {
      result[index] ^= multiply(coefficient, factor);
    });
  });

  return result;
}

function createQrMatrix(text) {
  const version = 5;
  const size = 17 + 4 * version;
  const dataCodewordCount = 108;
  const eccLength = 26;
  const bytes = Array.from(new TextEncoder().encode(String(text || ""))).slice(
    0,
    dataCodewordCount - 3,
  );
  const bits = [];
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  const pushBits = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  const setModule = (x, y, value, isReserved = true) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    matrix[y][x] = !!value;
    if (isReserved) reserved[y][x] = true;
  };
  const addFinder = (x, y) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        const active =
          dx >= 0 &&
          dy >= 0 &&
          dx <= 6 &&
          dy <= 6 &&
          (dx === 0 ||
            dx === 6 ||
            dy === 0 ||
            dy === 6 ||
            (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setModule(xx, yy, active);
      }
    }
  };

  addFinder(0, 0);
  addFinder(size - 7, 0);
  addFinder(0, size - 7);

  for (let i = 8; i < size - 8; i++) {
    setModule(i, 6, i % 2 === 0);
    setModule(6, i, i % 2 === 0);
  }

  [6, 30].forEach((cx) => {
    [6, 30].forEach((cy) => {
      if (
        (cx === 6 && cy === 6) ||
        (cx === 30 && cy === 6) ||
        (cx === 6 && cy === 30)
      ) {
        return;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setModule(
            cx + dx,
            cy + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          );
        }
      }
    });
  });

  setModule(8, size - 8, true);
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  bytes.forEach((byte) => pushBits(byte, 8));
  const maxBits = dataCodewordCount * 8;
  pushBits(0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8) bits.push(0);

  const dataCodewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    dataCodewords.push(Number.parseInt(bits.slice(i, i + 8).join(""), 2));
  }
  for (let pad = 0; dataCodewords.length < dataCodewordCount; pad++) {
    dataCodewords.push(pad % 2 ? 0x11 : 0xec);
  }

  const codewords = [
    ...dataCodewords,
    ...getQrErrorCorrection(dataCodewords, eccLength),
  ];
  const dataBits = codewords.flatMap((codeword) =>
    Array.from({ length: 8 }, (_, index) => (codeword >> (7 - index)) & 1),
  );
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let offset = 0; offset < size; offset++) {
      const y = upward ? size - 1 - offset : offset;
      for (let dx = 0; dx < 2; dx++) {
        const x = right - dx;
        if (reserved[y][x]) continue;
        const mask = (x + y) % 2 === 0;
        matrix[y][x] = Boolean((dataBits[bitIndex++] || 0) ^ mask);
      }
    }
    upward = !upward;
  }

  const formatBits = getQrFormatBits(0);
  for (let i = 0; i <= 5; i++) setModule(8, i, (formatBits >> i) & 1);
  setModule(8, 7, (formatBits >> 6) & 1);
  setModule(8, 8, (formatBits >> 7) & 1);
  setModule(7, 8, (formatBits >> 8) & 1);
  for (let i = 9; i < 15; i++) setModule(14 - i, 8, (formatBits >> i) & 1);
  for (let i = 0; i < 8; i++) setModule(size - 1 - i, 8, (formatBits >> i) & 1);
  for (let i = 8; i < 15; i++) setModule(8, size - 15 + i, (formatBits >> i) & 1);

  return matrix;
}

function createPrintQrCode(data, className = "print-qrcode") {
  const svgNS = "http://www.w3.org/2000/svg";
  const matrix = createQrMatrix(data);
  const size = matrix.length;
  const svg = createPrintSvg(className, `0 0 ${size} ${size}`, "20mm", "20mm");

  matrix.forEach((row, y) => {
    row.forEach((active, x) => {
      if (!active) return;
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", "1");
      rect.setAttribute("height", "1");
      svg.appendChild(rect);
    });
  });

  return svg;
}

function createPrintPage(pageNumber, type = "") {
  const page = createPrintEl("section", `print-page ${type}`);
  const trim = createPrintEl("div", "print-trim");

  page.dataset.page = String(pageNumber);
  page.style.setProperty("--trim-width", `${getTrimWidth(pageNumber)}mm`);
  page.classList.add(pageNumber % 2 ? "print-odd" : "print-even");

  if (pageNumber <= 2) {
    page.classList.add("print-front-page");
    trim.appendChild(createPrintEl("div", "print-front-bleed"));
    trim.appendChild(createPrintFrontMarks());
  }

  trim.appendChild(createPrintTrimLine());
  trim.appendChild(createPrintBindingHoles(pageNumber));
  if (pageNumber === 2) {
    trim.appendChild(createPrintPartialWebCircles());
  }
  if (pageNumber > 2 && pageNumber !== 44 && pageNumber % 2 === 0) {
    trim.appendChild(createPrintWebCircles());
    const bottomCircles = createPrintWebCircles();
    bottomCircles.classList.add("print-web-circles-bottom");
    trim.appendChild(bottomCircles);
  }
  page.appendChild(trim);
  appendPrintOddAssistCircles(trim, pageNumber);
  appendPrintPageNumber(trim, pageNumber);

  return { page, trim };
}

function appendPrintTextBox(parent, className, text) {
  const box = createPrintEl("div", className);
  setPrintText(box, text);
  parent.appendChild(box);

  return box;
}

function formatHardcopyTitleBlock(text) {
  return formatPrintTitle(text);
}

function splitPrintKoEnText(text) {
  const lines = normalizePrintText(text).split("\n");
  const englishStart = lines.findIndex((line, index) => {
    if (index === 0) return false;
    return /[A-Za-z]/.test(line) && !/[가-힣]/.test(line);
  });

  if (englishStart < 0) {
    return { ko: lines.join("\n"), en: "" };
  }

  return {
    ko: lines.slice(0, englishStart).join("\n").trimEnd(),
    en: lines.slice(englishStart).join("\n").trim(),
  };
}

function appendPrintDescriptionBox(parent, className, text) {
  const box = createPrintEl("div", className);
  const { ko, en } = splitPrintKoEnText(text);

  if (ko) {
    const koBox = createPrintEl("div", "print-description-ko");
    setPrintText(koBox, ko);
    box.appendChild(koBox);
  }

  if (en) {
    const enBox = createPrintEl("div", "print-description-en print-arial");
    setPrintText(enBox, en);
    box.appendChild(enBox);
  }

  parent.appendChild(box);

  return box;
}

function getPublicationDateText(date = new Date()) {
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}. ${mm}. ${dd}.\n${weekdays[date.getDay()]}`;
}

function getPublicationUrl() {
  const explicit = META.publication_url || META.site_url || META.website_url;
  const raw = explicit || window.location.href || "";

  const value = String(raw).trim();
  if (!value) return "";
  if (/^[a-z]+:\/\//i.test(value)) return value.replace(/^[a-z]+:\/\//i, "Https://");
  return `Https://${value}`;
}

function appendPrintPublicationInfo(trim) {
  appendPrintTextBox(
    trim,
    "print-publication-label print-arial",
    "Publication Date",
  );
  appendPrintTextBox(
    trim,
    "print-publication-date print-arial",
    getPublicationDateText(),
  );
  appendPrintTextBox(
    trim,
    "print-published-from print-arial",
    `Published from:\n${getPublicationUrl()}`,
  );
  if (META.qrcode_1) {
    trim.appendChild(createPrintQrCode(META.qrcode_1));
  }
}

function getPrintLineCount(text) {
  const normalized = normalizePrintText(text).trimEnd();
  if (!normalized) return 0;

  return normalized.split("\n").length;
}

function positionProjectDescriptionEn(box) {
  const koTop = 12.5;
  const lineHeightMm = 16.4 * 0.352778;
  const gap = 5.786 + lineHeightMm;
  const lineCount = getPrintLineCount(META.research_description || "");

  box.style.top = `${koTop + lineCount * lineHeightMm + gap}mm`;
}

function formatPrintKoEnLabel(text) {
  const value = normalizePrintText(text).trim();
  if (!value) return "";

  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines.join("\n");

  const match = value.match(/^(.+?)\s+([A-Za-z].*)$/);
  if (!match) return value;

  return `${match[1].trim()}\n${match[2].trim()}`;
}

function formatResearchDuration() {
  const label = formatPrintKoEnLabel(META.research_duration || "");
  const date = normalizePrintText(META.research_duration_date || "")
    .trim()
    .replace(/\s+—\s+/g, " —\n");

  return [label, date].filter(Boolean).join("\n");
}

function appendPrintProjectQr(trim, descriptionKey, qrKey, x) {
  appendPrintTextBox(
    trim,
    `print-project-qrcode-description print-project-qrcode-description-${qrKey} description keep-all`,
    META[descriptionKey] || "",
  );

  const description = trim.querySelector(
    `.print-project-qrcode-description-${qrKey}`,
  );
  if (description) description.style.left = `${x}mm`;

  if (!META[qrKey]) return;

  const qr = createPrintQrCode(
    META[qrKey],
    `print-qrcode print-project-qrcode print-project-${qrKey}`,
  );
  qr.style.left = `${x + 27.75}mm`;
  qr.style.top = "177.5mm";
  trim.appendChild(qr);
}

function appendPrintProjectDetails(trim) {
  appendPrintTextBox(
    trim,
    "print-research-duration description keep-all",
    formatResearchDuration(),
  );
  appendPrintTextBox(
    trim,
    "print-contact-ko description keep-all",
    META.contact_ko || "",
  );
  appendPrintTextBox(
    trim,
    "print-contact-en description keep-all print-arial",
    META.contact_en || "",
  );
  appendPrintProjectQr(trim, "qrcode_2_description", "qrcode_2", 10);
  appendPrintProjectQr(trim, "qrcode_3_description", "qrcode_3", 65.5);
}

function getItemImageUrls(data) {
  const sheetImageUrls = String(data.image_urls || data.images || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const jsonImageUrls = Array.isArray(cachedImageMap[String(data.id)])
    ? cachedImageMap[String(data.id)]
    : [];

  return (sheetImageUrls.length ? sheetImageUrls : jsonImageUrls).filter(
    (url) => !isBlockedImageUrl(url),
  );
}

const PRINT_IMAGE_HEIGHT_MM = 19;
const PRINT_IMAGE_GAP_MM = 3;
const PRINT_IMAGE_MAX_PER_ITEM = 10;
const PRINT_IMAGE_ASSUMED_RATIO = 1.35;
const PRINT_IMAGE_TARGET_WIDTH_PX = 480;

function getPrintImageCapacity(segments) {
  const totalWidth = segments.reduce(
    (sum, segment) => sum + Math.max(0, segment.right - segment.left),
    0,
  );
  const assumedWidth = PRINT_IMAGE_HEIGHT_MM * PRINT_IMAGE_ASSUMED_RATIO;
  const capacity = Math.floor(
    (totalWidth + PRINT_IMAGE_GAP_MM) / (assumedWidth + PRINT_IMAGE_GAP_MM),
  );

  return Math.max(1, Math.min(PRINT_IMAGE_MAX_PER_ITEM, capacity));
}

function getPrintOptimizedImageUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname.includes("images.pexels.com")) {
      parsed.searchParams.set("auto", "compress");
      parsed.searchParams.set("cs", "tinysrgb");
      parsed.searchParams.delete("dpr");
      parsed.searchParams.delete("h");
      parsed.searchParams.set("w", String(PRINT_IMAGE_TARGET_WIDTH_PX));
      return parsed.toString();
    }

    if (hostname.includes("images.unsplash.com")) {
      parsed.searchParams.set("auto", "format");
      parsed.searchParams.set("fit", "max");
      parsed.searchParams.set("q", "60");
      parsed.searchParams.set("w", String(PRINT_IMAGE_TARGET_WIDTH_PX));
      return parsed.toString();
    }

    if (hostname.includes("images.squarespace-cdn.com")) {
      parsed.searchParams.set("format", "500w");
      return parsed.toString();
    }

    if (
      hostname.includes("ctfassets.net") ||
      hostname.includes("contentful.com")
    ) {
      parsed.searchParams.set("fm", "webp");
      parsed.searchParams.set("q", "60");
      parsed.searchParams.set("w", String(PRINT_IMAGE_TARGET_WIDTH_PX));
      return parsed.toString();
    }

    if (hostname.includes("m.media-amazon.com")) {
      parsed.pathname = parsed.pathname.replace(
        /\._[^/]*?SL\d+_[^/]*?\./,
        "._AC_SL480_.",
      );
      return parsed.toString();
    }

    return url;
  } catch (err) {
    return url;
  }
}

function appendPrintSpreadItemImages(segments, item) {
  const urls = getItemImageUrls(item)
    .slice(0, getPrintImageCapacity(segments))
    .map(getPrintOptimizedImageUrl);
  const records = [];

  function layoutLoadedImages() {
    let segmentIndex = 0;
    let cursor = segments[0]?.left || 0;

    records.forEach((record) => {
      if (!record.loaded || !record.width) return;

      while (
        segments[segmentIndex] &&
        cursor + record.width > segments[segmentIndex].right
      ) {
        segmentIndex++;
        cursor = segments[segmentIndex]?.left || 0;
      }

      if (!segments[segmentIndex]) {
        record.container.remove();
        return;
      }

      if (record.container.parentElement !== segments[segmentIndex].trim) {
        segments[segmentIndex].trim.appendChild(record.container);
      }

      record.container.style.left = `${cursor}mm`;
      record.container.style.top = `${segments[segmentIndex].y}mm`;
      record.container.style.width = `${record.width}mm`;
      cursor += record.width + PRINT_IMAGE_GAP_MM;
    });
  }

  urls.forEach((url) => {
    const container = createPrintEl("div", "print-item-image-container");
    const img = document.createElement("img");
    const record = { container, loaded: false, width: 0 };

    container.style.left = `${segments[0]?.left || 0}mm`;
    container.style.top = `${segments[0]?.y || 0}mm`;
    container.style.width = "0mm";
    img.src = url;
    img.alt = item.image_query || item.title || "related image";
    img.loading = "eager";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => {
      container.remove();
    };
    img.onload = () => {
      const ratio = img.naturalWidth && img.naturalHeight
        ? img.naturalWidth / img.naturalHeight
        : 1;
      record.loaded = true;
      record.width = PRINT_IMAGE_HEIGHT_MM * ratio;
      layoutLoadedImages();
    };

    records.push(record);
    container.appendChild(img);
    if (segments[0]) segments[0].trim.appendChild(container);
  });
}

function getSystemCategoryRows(systemMap) {
  return [
    "category_type_concept",
    "category_type_tech",
    "category_type_digital",
    "category_type_media",
    "category_type_place",
    "category_type_action",
    "category_type_etc",
  ].map((key) => ({
    key,
    ko: getRecordText(systemMap[key], "ko"),
    en: getRecordText(systemMap[key], "en"),
  }));
}

function getItemCategoryLines(item, systemMap, lang = "ko") {
  const categoryRows = getSystemCategoryRows(systemMap);
  const rawCategories = String(item.category || "")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);

  return rawCategories
    .map((category) => {
      const row = categoryRows.find((entry) => entry.ko === category);
      return lang === "en" ? row?.en || "" : row?.ko || category;
    })
    .filter(Boolean)
    .join("\n");
}

function getCompareValues(item, lang = "ko") {
  const suffix = lang === "en" ? "_en" : "";

  return [
    item[`cost${suffix}`] || item.cost,
    item[`directionality${suffix}`] || item.directionality,
    item[`temporality${suffix}`] || item.temporality,
    item[`stage${suffix}`] || item.stage,
    item.open_score,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join("\n");
}

function appendPrintItemCategories(row, item, systemMap) {
  appendPrintTextBox(
    row,
    "print-item-category-ko description keep-all",
    getItemCategoryLines(item, systemMap, "ko"),
  );
  appendPrintTextBox(
    row,
    "print-item-category-en description keep-all",
    getItemCategoryLines(item, systemMap, "en"),
  );
}

function appendPrintCompareBoxes(trim, item, yClass) {
  const labelsKo = [
    META.compare_label_2 || "비용",
    META.compare_label_3 || "방향성",
    META.compare_label_4 || "시간성",
    META.compare_label_5 || "단계",
    META.compare_label_6 || "오픈 스코어",
  ].join("\n");
  const labelsEn = [
    META.compare_label_en_2 || "Cost",
    META.compare_label_en_3 || "Directionality",
    META.compare_label_en_4 || "Temporality",
    META.compare_label_en_5 || "Stage",
    META.compare_label_en_6 || "Open Score",
  ].join("\n");

  [
    ["print-compare-box-1", labelsKo],
    ["print-compare-box-2", getCompareValues(item, "ko")],
    ["print-compare-box-3", labelsEn],
    ["print-compare-box-4", getCompareValues(item, "en")],
  ].forEach(([className, text]) => {
    appendPrintTextBox(
      trim,
      `print-compare-box ${className} ${yClass} description keep-all`,
      text,
    );
  });
}

function renderPrintSystemPage(trim, systemMap) {
  const conceptKeys = [
    "openness",
    "sharing",
    "participation",
    "contribution",
    "collaboration",
  ];
  const conceptY = [18.286, 29.857, 41.428, 52.999, 64.57];
  const categoryRows = getSystemCategoryRows(systemMap);
  const scoreDescription = getRecordText(systemMap.score, "description")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  const directionalityRecord =
    systemMap.directionality || systemMap.dirctionality || {};

  appendPrintTextBox(
    trim,
    "print-system-dictionary description keep-all print-blue",
    getKoEn(systemMap.dictionary_definition),
  );

  const dots = createPrintEl("div", "print-system-dots");
  for (let i = 0; i < 5; i++) dots.appendChild(createPrintEl("span"));
  trim.appendChild(dots);

  conceptKeys.forEach((key, index) => {
    const record = systemMap[key] || {};
    const title = appendPrintTextBox(
      trim,
      "print-system-concept-title description keep-all",
      [getRecordText(record, "ko"), getRecordText(record, "en")]
        .filter(Boolean)
        .join("\n"),
    );
    title.style.top = `${conceptY[index]}mm`;

    const desc = appendPrintTextBox(
      trim,
      "print-system-concept-description description keep-all",
      getRecordText(record, "description"),
    );
    desc.style.top = `${conceptY[index]}mm`;
  });

  appendPrintLines(trim, "print-system-classification description keep-all", [
    {
      text: getKoEn(systemMap.classification),
      className: "print-blue",
    },
    {
      text: getRecordText(systemMap.classification_open, "ko"),
      className: "print-blue",
    },
    {
      text: getRecordText(systemMap.classification_open, "en"),
      className: "print-blue print-tight-openness",
    },
    { text: getRecordText(systemMap.classification_public, "ko") },
    { text: getRecordText(systemMap.classification_public, "en") },
    {
      text: getRecordText(systemMap.classification_na, "ko"),
      className: "print-gray",
    },
    {
      text: getRecordText(systemMap.classification_na, "en"),
      className: "print-gray",
    },
  ]);

  appendPrintTextBox(
    trim,
    "print-category-type-title keep-all print-blue",
    getKoEn(systemMap.category_type),
  );
  appendPrintTextBox(
    trim,
    "print-category-type-ko description keep-all",
    categoryRows.map((row) => row.ko).join("\n"),
  );
  appendPrintTextBox(
    trim,
    "print-category-type-en description keep-all",
    categoryRows.map((row) => row.en).join("\n"),
  );

  appendPrintLines(trim, "print-directionality description keep-all", [
    { text: getKoEn(directionalityRecord), className: "print-blue" },
    { text: getRecordText(directionalityRecord, "description") },
  ]);

  appendPrintLines(trim, "print-stage description keep-all", [
    { text: getKoEn(systemMap.stage), className: "print-blue" },
    { text: getRecordText(systemMap.stage, "description") },
  ]);

  appendPrintTextBox(
    trim,
    "print-score-title keep-all print-blue",
    getKoEn(systemMap.score),
  );
  appendPrintTextBox(
    trim,
    "print-score-description-left description keep-all",
    scoreDescription.slice(0, 2).join("\n"),
  );
  appendPrintTextBox(
    trim,
    "print-score-description-right description keep-all",
    scoreDescription.slice(2).join("\n"),
  );
}

function renderPrintLayout(items, systemMap = {}) {
  const root = document.getElementById("printRoot");
  if (!root) return;

  root.innerHTML = "";

  const cover = createPrintPage(1, "print-cover-page");
  appendPrintCoverTitleMarks(cover.trim);
  appendPrintTextBox(
    cover.trim,
    "print-cover-hardcopy-title description keep-all",
    formatHardcopyTitleBlock(META.hardcopy_title || ""),
  );
  appendPrintPublicationInfo(cover.trim);
  root.appendChild(cover.page);

  const project = createPrintPage(2, "print-project-page");
  appendPrintTextBox(
    project.trim,
    "print-hardcopy-title description keep-all",
    formatHardcopyTitleBlock(META.hardcopy_title || ""),
  );
  appendPrintTextBox(
    project.trim,
    "print-hardcopy-category-ko description keep-all",
    "개념\n디지털\n매체\n행위",
  );
  appendPrintTextBox(
    project.trim,
    "print-hardcopy-category-en description keep-all",
    [
      getMetaTitleCase("category_word_concept"),
      getMetaTitleCase("category_word_digital"),
      getMetaTitleCase("category_word_media"),
      getMetaTitleCase("category_word_ACTION") ||
        getMetaTitleCase("category_word_action"),
    ]
      .filter(Boolean)
      .join("\n"),
  );
  appendPrintTextBox(
    project.trim,
    "print-project-description description keep-all",
    META.research_description || "",
  );
  const projectDescriptionEn = appendPrintTextBox(
    project.trim,
    "print-project-description-en description keep-all print-arial",
    META.research_description_en || "",
  );
  positionProjectDescriptionEn(projectDescriptionEn);
  appendPrintProjectDetails(project.trim);
  root.appendChild(project.page);

  const book = createPrintPage(3, "print-book-page");
  renderPrintSystemPage(book.trim, systemMap);
  root.appendChild(book.page);

  const printItems = [...items]
    .filter((item) => Number.isFinite(item.printOrder))
    .sort((a, b) => a.printOrder - b.printOrder);

  for (let i = 0; i < printItems.length; i += 2) {
    const pageNumber = 4 + i;
    const itemPage = createPrintPage(pageNumber, "print-items-page");
    const list = createPrintEl("div", "print-items-list");

    const spreadItems = printItems.slice(i, i + 2);

    spreadItems.forEach((item) => {
      const row = createPrintEl("article", "print-item");
      row.classList.add(
        list.children.length === 0 ? "print-item-top" : "print-item-bottom",
      );
      appendPrintTextBox(
        row,
        "print-item-title keep-all",
        formatPrintTitle(item.title || ""),
      );
      appendPrintDescriptionBox(
        row,
        "print-item-description description keep-all",
        item.description || "",
      );
      appendPrintItemCategories(row, item, systemMap);
      list.appendChild(row);
    });

    itemPage.trim.appendChild(list);
    const comparePage = createPrintPage(pageNumber + 1, "print-compare-page");
    if (spreadItems[0]) {
      appendPrintCompareBoxes(comparePage.trim, spreadItems[0], "print-compare-top");
    }
    if (spreadItems[1]) {
      appendPrintCompareBoxes(
        comparePage.trim,
        spreadItems[1],
        "print-compare-bottom",
      );
    }
    if (spreadItems[0]) {
      appendPrintSpreadItemImages(
        [
          {
            trim: itemPage.trim,
            left: 10,
            right: getTrimWidth(pageNumber) - 20,
            y: 78.75,
          },
          {
            trim: comparePage.trim,
            left: 20,
            right: getTrimWidth(pageNumber + 1) - 10,
            y: 78.75,
          },
        ],
        spreadItems[0],
      );
    }
    if (spreadItems[1]) {
      appendPrintSpreadItemImages(
        [
          {
            trim: itemPage.trim,
            left: 10,
            right: getTrimWidth(pageNumber) - 20,
            y: 173.75,
          },
          {
            trim: comparePage.trim,
            left: 20,
            right: getTrimWidth(pageNumber + 1) - 10,
            y: 173.75,
          },
        ],
        spreadItems[1],
      );
    }
    root.appendChild(itemPage.page);
    root.appendChild(comparePage.page);
  }

  const backCover = createPrintPage(44, "print-back-cover-page");
  appendPrintBackCoverTitles(backCover.trim);
  root.appendChild(backCover.page);
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
    map[
      `${normalizeKerningLabel(leftLabel)}|${normalizeKerningLabel(rightLabel)}`
    ] = value;
  });

  return map;
}

function normalizeKerningLabel(label) {
  return String(label || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9가-힣→]/g, "");
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
  const canonicalKey = `${normalizeKerningLabel(left)}|${normalizeKerningLabel(
    right,
  )}`;
  const adjustment = kerningMap[key] ?? kerningMap[canonicalKey];

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
  매체: "category_word_media",
  장소: "category_word_place",
  행위: "category_word_action",
  기타: "category_word_etc",
};

const categoryWordFallbackMap = {
  개념: "CONCEPT",
  기술: "TECHNOLOGY",
  디지털: "DIGITAL",
  매체: "MEDIA",
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
  <div class="info-row title-desc-box top-description-box keep-all">${getScreenDescription(data.description)}</div>
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
      systemRows,
      imageMap,
    ] = await Promise.all([
      loadCSV(CMS.gids.meta),
      loadCSV(CMS.gids.items),
      loadCSV(CMS.gids.compare),
      loadCSV(CMS.gids.suggestions),
      loadOptionalCSV(CMS.gids.alphabet),
      loadOptionalCSV(CMS.gids.kerning),
      loadOptionalCSV(CMS.gids.alphabetTape),
      loadOptionalCSV(CMS.gids.system),
      loadImageJSON(),
    ]);

    META = buildMeta(metaRows);
    const systemMap = buildSystemMap(systemRows);
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
      printOrder: getPrintOrder(row),
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

    renderPrintLayout(
      items.map((item) => ({
        ...item,
        ...(compareById[item.id] || {}),
      })),
      systemMap,
    );

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
