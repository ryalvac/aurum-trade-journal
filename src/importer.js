import readXlsxFile from "read-excel-file/browser";
const A = window.GoldAnalytics;
export const fields = [
  ["date", "Kapanış tarihi *"],
  ["time", "Kapanış saati"],
  ["symbol", "Ürün *"],
  ["side", "İşlem yönü *"],
  ["net_pnl", "Net sonuç"],
  ["gross_pnl", "Brüt kâr"],
  ["commission", "Komisyon (işaretli)"],
  ["swap", "Swap (işaretli)"],
  ["fee", "Ücret (işaretli)"],
  ["strategy", "Strateji"],
  ["followed_plan", "Plana uyum"],
  ["entry", "Giriş fiyatı"],
  ["exit", "Çıkış fiyatı"],
  ["stop", "İlk stop fiyatı"],
  ["lot", "Lot"],
  ["risk_amount", "Başlangıç riski (hesap para birimi)"],
  ["tick_size", "Tick büyüklüğü"],
  ["tick_value", "1 lot tick değeri (hesap para birimi)"],
  ["note", "Not"],
];
export async function inspectFile(file) {
  if (file.size > 2 * 1024 * 1024) throw Error("Dosya en fazla 2 MB olabilir.");
  let matrix;
  if (/\.xlsx$/i.test(file.name)) matrix = await readXlsxFile(file);
  else {
    let text = await file.text();
    if (/\.html?$/i.test(file.name)) {
      const doc = new DOMParser().parseFromString(text, "text/html");
      const tables = [...doc.querySelectorAll("table")].map((t) =>
        [...t.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())),
      );
      matrix = tables.sort((a, b) => b.length - a.length)[0] || [];
    } else matrix = A.table(text);
  }
  if (matrix.length > 10001)
    throw Error("En fazla 10.000 satır destekleniyor.");
  if (matrix.length < 2) throw Error("Tablo ve veri satırı bulunamadı.");
  // Report header/account details can precede the actual table. User confirms the row.
  let headerRow = matrix.findIndex(
    (row) =>
      row.some((c) =>
        /^(date|close time|time|kapanış zamanı|zaman|kapanış tarihi)$/i.test(
          String(c).trim(),
        ),
      ) && row.some((c) => /^(symbol|ürün|sembol)$/i.test(String(c).trim())),
  );
  if (headerRow < 0) headerRow = 0;
  return { matrix, headerRow, name: file.name };
}
const aliases = {
  date: [
    "date",
    "close time",
    "closing time",
    "kapanış tarihi",
    "kapanış zamanı",
    "time",
    "zaman",
  ],
  time: ["time", "time_of_day", "close_time_only", "saat"],
  symbol: ["symbol", "sembol", "ürün"],
  side: ["side", "type", "tip", "tür"],
  net_pnl: ["net_pnl", "net profit", "net result", "net sonuç"],
  gross_pnl: ["gross_pnl", "profit", "kâr", "kar", "brüt kâr"],
  commission: ["commission", "komisyon"],
  swap: ["swap"],
  fee: ["fee", "fees", "ücret"],
  entry: ["entry", "open price", "giriş fiyatı"],
  exit: ["exit", "close price", "çıkış fiyatı"],
  stop: ["stop", "initial stop", "ilk stop"],
  lot: ["lot", "volume", "hacim"],
  strategy: ["strategy", "strateji"],
  followed_plan: ["followed_plan", "plana uyum"],
  risk_amount: ["risk_amount", "initial risk"],
  tick_size: ["tick_size"],
  tick_value: ["tick_value"],
  note: ["note", "comment", "not", "açıklama"],
};
export function guessMapping(headers) {
  const norm = headers.map((x) =>
    String(x ?? "")
      .trim()
      .toLocaleLowerCase("tr"),
  );
  const mapping = Object.fromEntries(
    fields.map(([key]) => [
      key,
      norm.findIndex((h) => (aliases[key] || [key]).includes(h)),
    ]),
  );
  if (mapping.time === mapping.date) mapping.time = -1;
  return mapping;
}
function dateValue(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  const m = s.match(
    /^(\d{4})[.\/-](\d{2})[.\/-](\d{2})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/,
  );
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s;
}
export function convertImport(
  inspected,
  headerRow,
  mapping,
  costMode = "signed",
) {
  const headers = inspected.matrix[headerRow] || [];
  if (
    headers.some((h) =>
      /^(entry|direction|giriş|yön)$/i.test(String(h).trim()),
    ) &&
    headers.some((h) => /^(deal|deal id|işlem no)$/i.test(String(h).trim()))
  )
    return {
      rows: [],
      issues: [
        "Ham MT5 deal tablosu algılandı. Açılış/kapanış, kısmi kapanış ve masraflar pozisyon bazında birleştirilmeden içe aktarılamaz. Kapanmış pozisyon raporunu kullanın.",
      ],
      duplicates: 0,
    };
  const rows = [],
    issues = [],
    seen = new Set();
  let duplicates = 0;
  for (let i = headerRow + 1; i < inspected.matrix.length; i++) {
    const source = inspected.matrix[i];
    if (!source.some((c) => c !== null && String(c).trim() !== "")) continue;
    try {
      const r = {};
      for (const [key] of fields) {
        const idx = Number(mapping[key]);
        if (idx >= 0) r[key] = source[idx] ?? "";
      }
      const dateRaw = r.date;
      r.date = dateValue(dateRaw);
      if (!r.time) {
        const match = String(dateRaw).match(/\s(\d{2}:\d{2}(?::\d{2})?)/);
        if (match) r.time = match[1];
      }
      if (r.time instanceof Date) r.time = r.time.toISOString().slice(11, 19);
      r.side =
        {
          buy: "long",
          sell: "short",
          alış: "long",
          satış: "short",
          long: "long",
          short: "short",
        }[String(r.side).trim().toLocaleLowerCase("tr")] || r.side;
      r.followed_plan =
        { yes: "yes", no: "no", evet: "yes", hayır: "no", unknown: "unknown" }[
          String(r.followed_plan || "")
            .trim()
            .toLocaleLowerCase("tr")
        ] || "unknown";
      r.strategy = String(r.strategy || "Etiketsiz").trim();
      if (costMode === "positive")
        for (const key of ["commission", "fee"])
          if (r[key] !== undefined && r[key] !== "")
            r[key] = -Math.abs(A.numeric(r[key]));
      if (r.net_pnl === undefined || r.net_pnl === "") {
        const gross = A.numeric(r.gross_pnl);
        if (gross === null) throw Error("Net sonuç veya brüt kâr eşleştirin.");
        r.net_pnl =
          gross +
          (A.numeric(r.commission) || 0) +
          (A.numeric(r.swap) || 0) +
          (A.numeric(r.fee) || 0);
      }
      const clean = A.normalize(r);
      const key = A.fingerprint(clean);
      if (seen.has(key)) duplicates++;
      seen.add(key);
      rows.push(clean);
    } catch (e) {
      issues.push(`${i + 1}. satır: ${e.message}`);
    }
  }
  return { rows: rows.sort(A.order), issues, duplicates };
}
