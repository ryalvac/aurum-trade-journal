(function (root) {
  "use strict";
  const required = [
    "date",
    "symbol",
    "side",
    "net_pnl",
    "strategy",
    "followed_plan",
  ];
  const optionalNumbers = [
    "entry",
    "exit",
    "stop",
    "lot",
    "tick_size",
    "tick_value",
    "risk_amount",
    "gross_pnl",
    "commission",
    "swap",
    "fee",
  ];
  function table(text, delimiter) {
    text = text.replace(/^\uFEFF/, "");
    if (!delimiter) {
      const line = text.split(/\r?\n/, 1)[0];
      delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    }
    const rows = [];
    let row = [],
      field = "",
      quoted = false,
      closed = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (quoted) {
          quoted = false;
          closed = true;
        } else if (field === "" && !closed) quoted = true;
        else throw Error("Geçersiz tırnak kullanımı.");
      } else if (c === delimiter && !quoted) {
        row.push(field);
        field = "";
        closed = false;
      } else if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
        field = "";
        closed = false;
      } else {
        if (closed && !/\s/.test(c))
          throw Error("Kapanan tırnaktan sonra ayırıcı bekleniyor.");
        field += c;
      }
    }
    if (quoted) throw Error("Kapanmamış tırnak var.");
    row.push(field);
    if (row.some((x) => x.trim())) rows.push(row);
    return rows;
  }
  function numeric(value) {
    if (value === null || value === undefined || String(value).trim() === "")
      return null;
    const n = String(value).trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(n))
      throw Error(
        "Sayı formatı hatalı; binlik ayırıcı kullanmayın, ondalık için nokta kullanın.",
      );
    const x = Number(n);
    if (!Number.isFinite(x)) throw Error("Sayı sonlu olmalı.");
    return x;
  }
  function normalize(o) {
    const r = { ...o };
    for (const k of required)
      if (r[k] === undefined) throw Error("Eksik sütun: " + k);
    const d = new Date(r.date + "T00:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
      !Number.isFinite(+d) ||
      d.toISOString().slice(0, 10) !== r.date
    )
      throw Error("Tarih YYYY-MM-DD olmalı.");
    r.net_pnl = numeric(r.net_pnl);
    if (r.net_pnl === null) throw Error("Net sonuç boş olamaz.");
    if (!["long", "short"].includes(r.side))
      throw Error("Yön long/short olmalı.");
    if (!["yes", "no", "unknown"].includes(r.followed_plan))
      throw Error("Plana uyum yes/no/unknown olmalı.");
    if (!String(r.symbol).trim() || !String(r.strategy).trim())
      throw Error("Ürün ve strateji boş olamaz.");
    for (const k of optionalNumbers) r[k] = numeric(r[k]);
    for (const k of [
      "entry",
      "exit",
      "stop",
      "lot",
      "tick_size",
      "tick_value",
      "risk_amount",
    ])
      if (r[k] !== null && r[k] <= 0)
        throw Error(k + " sıfırdan büyük olmalı.");
    if (r.time && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(r.time))
      throw Error("Saat HH:MM veya HH:MM:SS olmalı.");
    if (
      r.entry !== null &&
      r.stop !== null &&
      ((r.side === "long" && r.stop >= r.entry) ||
        (r.side === "short" && r.stop <= r.entry))
    )
      throw Error(
        "Başlangıç stopu long için girişin altında, short için üstünde olmalı.",
      );
    if (
      r.gross_pnl !== null &&
      Math.abs(
        r.net_pnl -
          (r.gross_pnl + (r.commission || 0) + (r.swap || 0) + (r.fee || 0)),
      ) > 0.011
    )
      throw Error(
        "Net sonuç, brüt + işaretli komisyon + swap + ücret ile uyuşmuyor.",
      );
    r.note = String(r.note || "");
    return r;
  }
  function parseCSV(text) {
    const rows = table(text);
    if (rows.length < 2) throw Error("Başlık ve en az bir işlem gerekli.");
    const headers = rows.shift().map((x) => x.trim());
    if (
      required.some((x) => !headers.includes(x)) ||
      new Set(headers).size !== headers.length
    )
      throw Error("Sütunlar şablonla eşleşmiyor.");
    return rows
      .map((r, i) => {
        if (r.length !== headers.length)
          throw Error(`${i + 2}. satır: sütun sayısı hatalı.`);
        try {
          return normalize(
            Object.fromEntries(headers.map((h, j) => [h, r[j].trim()])),
          );
        } catch (e) {
          throw Error(`${i + 2}. satır: ${e.message}`);
        }
      })
      .sort(order);
  }
  function order(a, b) {
    return (a.date + " " + (a.time || "")).localeCompare(
      b.date + " " + (b.time || ""),
    );
  }
  function risk(r) {
    if (r.risk_amount > 0) return Number(r.risk_amount);
    if (
      r.entry > 0 &&
      r.stop > 0 &&
      r.lot > 0 &&
      r.tick_size > 0 &&
      r.tick_value > 0
    ) {
      if (
        (r.side === "long" && r.stop >= r.entry) ||
        (r.side === "short" && r.stop <= r.entry)
      )
        return null;
      return (Math.abs(r.entry - r.stop) / r.tick_size) * r.tick_value * r.lot;
    }
    return null;
  }
  function fingerprint(r) {
    return JSON.stringify([
      r.date,
      r.time || "",
      r.symbol,
      r.side,
      r.net_pnl,
      r.entry ?? null,
      r.exit ?? null,
      r.lot ?? null,
    ]);
  }
  function summarize(input, initial) {
    const rows = [...input].sort(order);
    let sum = 0,
      peak = initial,
      maxDrawdown = 0,
      maxDrawdownPct = 0;
    const curve = [initial];
    let wins = 0,
      gain = 0,
      loss = 0,
      losers = 0;
    const rs = [];
    for (const r of rows) {
      sum += r.net_pnl;
      if (r.net_pnl > 0) {
        wins++;
        gain += r.net_pnl;
      }
      if (r.net_pnl < 0) {
        loss -= r.net_pnl;
        losers++;
      }
      const equity = initial + sum;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
      if (peak > 0)
        maxDrawdownPct = Math.max(
          maxDrawdownPct,
          ((peak - equity) / peak) * 100,
        );
      curve.push(equity);
      const rr = risk(r);
      if (rr) rs.push(r.net_pnl / rr);
    }
    return {
      count: rows.length,
      net: sum,
      winRate: rows.length ? (wins / rows.length) * 100 : 0,
      profitFactor: loss ? gain / loss : null,
      payoff: wins && losers ? gain / wins / (loss / losers) : null,
      maxDrawdown,
      maxDrawdownPct,
      curve,
      averageR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
      rCount: rs.length,
    };
  }
  function quality(rows) {
    const seen = new Set();
    let duplicates = 0,
      missingRisk = 0,
      unknownPlan = 0;
    for (const r of rows) {
      const k = fingerprint(r);
      if (seen.has(k)) duplicates++;
      seen.add(k);
      if (!risk(r)) missingRisk++;
      if (r.followed_plan === "unknown") unknownPlan++;
    }
    return { duplicates, missingRisk, unknownPlan };
  }
  const api = {
    parseCSV,
    summarize,
    table,
    normalize,
    risk,
    fingerprint,
    order,
    quality,
    optionalNumbers,
    numeric,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.GoldAnalytics = api;
})(typeof window !== "undefined" ? window : globalThis);
