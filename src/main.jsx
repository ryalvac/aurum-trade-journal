import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  ChartNoAxesCombined,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownUp,
  Upload,
  Download,
  Plus,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  Minus,
  Info,
  ShieldCheck,
  FileText,
  Settings2,
  X,
  BriefcaseBusiness,
  Ellipsis,
  CalendarDays,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ImportWizard from "./ImportWizard";
import { inspectFile } from "./importer";
import "./style.css";
const {
  parseCSV,
  summarize,
  normalize,
  risk,
  quality,
  order,
  optionalNumbers,
} = window.GoldAnalytics;
const KEY = "aurum-journal-v2";
const id = () => crypto.randomUUID();
const dateLabel = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (
      d &&
      Array.isArray(d.rows) &&
      Number(d.initial) > 0 &&
      ["USD", "TRY", "EUR"].includes(d.currency) &&
      d.rows.every(
        (r) =>
          r.id &&
          typeof r.date === "string" &&
          Number.isFinite(r.net_pnl) &&
          ["long", "short"].includes(r.side) &&
          ["yes", "no", "unknown"].includes(r.followed_plan),
      )
    )
      return d;
  } catch {}
  return null;
}
function App() {
  const [saved] = useState(restore);
  const [rows, setRows] = useState(saved?.rows || []);
  const [demo, setDemo] = useState(saved?.demo ?? true);
  const [loaded, setLoaded] = useState(!!saved);
  const [initial, setInitial] = useState(saved?.initial || 10000);
  const [currency, setCurrency] = useState(saved?.currency || "USD");
  const [pageView, setPageView] = useState("journal");
  const [strategy, setStrategy] = useState("");
  const [direction, setDirection] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "date", asc: false });
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState("");
  const [importData, setImportData] = useState(null);
  const file = useRef();
  useEffect(() => {
    if (saved) return;
    fetch("/sample.csv")
      .then((r) => {
        if (!r.ok) throw Error("Örnek dosya açılamadı.");
        return r.text();
      })
      .then((t) => {
        setRows(parseCSV(t).map((r) => ({ ...r, id: id(), note: "" })));
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ rows, demo, initial, currency }),
      );
    } catch {
      setError(
        "Tarayıcı kayıt alanına yazılamadı. Verilerini CSV olarak indir.",
      );
    }
  }, [rows, demo, initial, currency, loaded]);
  useEffect(() => setPage(1), [strategy, direction, from, to, search, sort]);
  const filtered = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            (!strategy || r.strategy === strategy) &&
            (!direction || r.side === direction) &&
            (!from || r.date >= from) &&
            (!to || r.date <= to) &&
            [r.symbol, r.strategy, r.note]
              .join(" ")
              .toLocaleLowerCase("tr")
              .includes(search.toLocaleLowerCase("tr")),
        )
        .sort(order),
    [rows, strategy, direction, from, to, search],
  );
  const stats = summarize(filtered, initial),
    dataQuality = quality(rows),
    money = (n) =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n),
    number = (n) =>
      new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n),
    pct = (n) => number(n) + "%";
  const winners = filtered.filter((r) => r.net_pnl > 0).length,
    losses = filtered.filter((r) => r.net_pnl < 0).length,
    followed = filtered.filter((r) => r.followed_plan === "yes").length;
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort.key],
      bv = b[sort.key];
    return (
      (typeof av === "number"
        ? av - bv
        : String(av).localeCompare(String(bv))) * (sort.asc ? 1 : -1)
    );
  });
  const pages = Math.max(1, Math.ceil(sorted.length / 8)),
    activePage = Math.min(page, pages),
    visible = sorted.slice((activePage - 1) * 8, activePage * 8);
  const curve = [
    { label: "Başlangıç", equity: initial },
    ...filtered.map((r, i) => ({
      label: dateLabel(r.date) + " · " + (i + 1),
      equity: stats.curve[i + 1],
    })),
  ];
  function resetFilters() {
    setStrategy("");
    setDirection("");
    setFrom("");
    setTo("");
    setSearch("");
  }
  async function upload(e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = await inspectFile(f);
      setImportData(data);
      setModal("import");
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      e.target.value = "";
    }
  }
  function download(all = false) {
    const headers = [
      "date",
      "time",
      "symbol",
      "side",
      "net_pnl",
      "strategy",
      "followed_plan",
      ...optionalNumbers,
      "note",
    ];
    const cell = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    const csv =
      "\uFEFF" +
      [
        headers.join(","),
        ...(all === true ? rows : filtered).map((r) =>
          headers.map((k) => cell(r[k])).join(","),
        ),
      ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `aurum-${demo ? "ornek" : "islemler"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function add() {
    if (demo) {
      setModal("start");
      return;
    }
    openTrade();
  }
  function openTrade(r) {
    setEditing(r?.id || null);
    setForm(
      r
        ? { ...r }
        : {
            date: new Date().toLocaleDateString("en-CA"),
            symbol: "XAUUSD",
            side: "long",
            net_pnl: "",
            strategy: "",
            followed_plan: "unknown",
            note: "",
            time: "",
            risk_amount: "",
            entry: "",
            exit: "",
            stop: "",
            lot: "",
            tick_size: "",
            tick_value: "",
          },
    );
    setFormError("");
    setModal("trade");
  }
  function submit(e) {
    e.preventDefault();
    try {
      const parsed = normalize(form);
      const next = { ...parsed, id: editing || id() };
      setRows((prev) =>
        editing
          ? prev.map((r) => (r.id === editing ? next : r))
          : [...prev, next],
      );
      setModal(null);
      setError("");
    } catch (e) {
      setFormError(e.message);
    }
  }
  function sortBy(key) {
    setSort((v) => ({ key, asc: v.key === key ? !v.asc : true }));
  }
  const title =
    pageView === "reports"
      ? "Performans raporu"
      : pageView === "settings"
        ? "Günlük ayarları"
        : pageView === "quality"
          ? "Veri kalitesi"
          : "İşlem günlüğü";
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <ChartNoAxesCombined size={19} />
          </span>
          aurum
          <span
            style={{
              fontSize: 9,
              color: "#9aa3aa",
              alignSelf: "flex-start",
              marginTop: 2,
            }}
          >
            BETA
          </span>
        </div>
        <div className="workspace">
          <span className="avatar">KG</span>
          <div>
            Kişisel günlük
            <small>{demo ? "Örnek hesap" : "Bu cihazda kayıtlı"}</small>
          </div>
        </div>
        <div className="nav-label">ÇALIŞMA ALANI</div>
        <nav>
          {[
            ["journal", BookOpen, "İşlem günlüğü"],
            ["reports", ChartNoAxesCombined, "Performans"],
            ["quality", ShieldCheck, "Veri kalitesi"],
            ["settings", Settings2, "Ayarlar"],
          ].map(([key, Icon, label]) => (
            <button
              key={key}
              onClick={() => setPageView(key)}
              className={"nav-button " + (pageView === key ? "active" : "")}
            >
              <Icon size={16} strokeWidth={1.6} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <ShieldCheck size={14} /> Veriler bu cihazda
          </div>
          İşlem verileri sunucuya gönderilmez. Düzenli olarak CSV yedeği al.
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            Çalışma alanı
            <ChevronRight size={12} />
            <strong>{title}</strong>
          </div>
          <div className="top-right">
            <span>
              <i className="dot" />
              {demo ? "Örnek hesap" : "Yerel kayıt"}
            </span>
            <span className="avatar" style={{ width: 25, height: 25 }}>
              KG
            </span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p>
                {pageView === "journal"
                  ? "Kapanmış işlemlerini kaydet, sonuçlarını ve işlem disiplinini takip et."
                  : pageView === "reports"
                    ? "Seçili işlemler üzerinden strateji ve disiplin karşılaştırması."
                    : pageView === "quality" ? "Eksik alanları ve olası tekrarları incele." : "Hesap bakiyesi, para birimi ve yerel verilerini yönet."}
              </p>
            </div>
            <div className="heading-actions">
              <Button variant="outline" onClick={() => file.current.click()}>
                <Upload size={14} /> Dosya içe aktar
              </Button>
              <Button onClick={add}>
                <Plus size={15} /> İşlem ekle
              </Button>
            </div>
          </div>
          <input
            type="file"
            accept=".csv,.tsv,.xlsx,.html,.htm,text/csv"
            ref={file}
            hidden
            onChange={upload}
          />
          {error && (
            <div className="toast" role="alert">
              {error}
            </div>
          )}
          {demo && (
            <div className="demo-banner">
              <span>
                <Info size={14} /> Örnek hesap · {rows.length} kurgusal işlem.
                Gösterilen sonuçlar gerçek performans değildir.
              </span>
              <button onClick={() => setModal("start")}>
                Kendi günlüğünü oluştur <span aria-hidden>↗</span>
              </button>
            </div>
          )}
          {!["settings", "quality"].includes(pageView) && (
            <>
              <div className="toolbar">
                <label>
                  <CalendarDays size={14} />
                  <input
                    type="date"
                    aria-label="Başlangıç tarihi"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      if (to && e.target.value > to) setTo("");
                    }}
                  />
                </label>
                <span style={{ color: "#a4adb4" }}>—</span>
                <input
                  type="date"
                  aria-label="Bitiş tarihi"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                />
                <select
                  aria-label="Strateji"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                >
                  <option value="">Tüm stratejiler</option>
                  {[...new Set(rows.map((r) => r.strategy))].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select
                  aria-label="İşlem yönü"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                >
                  <option value="">Tüm yönler</option>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
                {(from || to || strategy || direction || search) && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <X size={12} /> Temizle
                  </Button>
                )}
                <span
                  className="push"
                  style={{ fontSize: 10, color: "#929aa1" }}
                >
                  {filtered.length} işlem · {currency}
                </span>
              </div>
              <section className="stats">
                {[
                  [
                    "Net kâr / zarar",
                    money(stats.net),
                    `${winners} kazanç · ${losses} kayıp · ${filtered.length - winners - losses} başa baş`,
                    stats.net >= 0 ? "green" : "red",
                  ],
                  [
                    "Kazanma oranı",
                    pct(stats.winRate),
                    `${winners} / ${filtered.length} işlem`,
                    "",
                  ],
                  [
                    "Kâr faktörü",
                    stats.profitFactor === null
                      ? "—"
                      : number(stats.profitFactor),
                    "Toplam kazanç / toplam kayıp",
                    "",
                  ],
                  [
                    "Maksimum düşüş",
                    money(stats.maxDrawdown),
                    "Kapanış bakiyesine göre",
                    "",
                  ],
                ].map(([label, value, foot, color]) => (
                  <div className="stat" key={label}>
                    <div className="stat-label">
                      {label}
                      <Info size={12} color="#b4bbc0" aria-hidden />
                    </div>
                    <div className={"stat-value " + color}>{value}</div>
                    <div className="stat-foot">{foot}</div>
                  </div>
                ))}
              </section>
            </>
          )}
          {pageView === "journal" && (
            <>
              <div className="chart-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Bakiye gelişimi</h2>
                      <p>Gerçekleşmiş net sonuç · {currency}</p>
                    </div>
                    <span
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <i className="dot" /> Kapanış bakiyesi
                    </span>
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={curve}
                        margin={{ top: 10, right: 15, bottom: 5, left: 3 }}
                      >
                        <defs>
                          <linearGradient
                            id="equityFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#688d75"
                              stopOpacity={0.16}
                            />
                            <stop
                              offset="100%"
                              stopColor="#688d75"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 4"
                          vertical={false}
                          stroke="#e9edef"
                        />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          minTickGap={45}
                          tick={{ fontSize: 10, fill: "#929ca5" }}
                          tickMargin={12}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: "#929ca5" }}
                          width={62}
                          tickFormatter={number}
                        />
                        <Tooltip
                          formatter={(v) => [money(v), "Bakiye"]}
                          contentStyle={{
                            fontSize: 11,
                            borderRadius: 5,
                            border: "1px solid #e4e8eb",
                            boxShadow: "0 2px 8px #00000008",
                          }}
                        />
                        <ReferenceLine
                          y={initial}
                          stroke="#bbc6bf"
                          strokeDasharray="4 4"
                        />
                        <Area
                          type="linear"
                          dataKey="equity"
                          stroke="#60836c"
                          strokeWidth={2}
                          fill="url(#equityFill)"
                          activeDot={{ r: 4 }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-footer">
                    <span>
                      Başlangıç{" "}
                      <b
                        style={{
                          color: "#505e68",
                          fontWeight: 500,
                          marginLeft: 6,
                        }}
                      >
                        {money(initial)}
                      </b>
                    </span>
                    <span>
                      Son bakiye{" "}
                      <b
                        style={{
                          color: "#505e68",
                          fontWeight: 500,
                          marginLeft: 6,
                        }}
                      >
                        {money(initial + stats.net)}
                      </b>
                    </span>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>İşlem özeti</h2>
                    <Ellipsis size={16} color="#98a2ab" />
                  </div>
                  <div className="mini-stats">
                    {[
                      [
                        "İşlem başına net",
                        filtered.length
                          ? money(stats.net / filtered.length)
                          : "—",
                      ],
                      [
                        "Ortalama R",
                        stats.averageR === null
                          ? "—"
                          : number(stats.averageR) +
                            " R (" +
                            stats.rCount +
                            " işlem)",
                      ],
                      [
                        "En iyi işlem",
                        filtered.length
                          ? money(Math.max(...filtered.map((r) => r.net_pnl)))
                          : "—",
                      ],
                      [
                        "En kötü işlem",
                        filtered.length
                          ? money(Math.min(...filtered.map((r) => r.net_pnl)))
                          : "—",
                      ],
                    ].map(([k, v]) => (
                      <div className="mini-row" key={k}>
                        <span>{k}</span>
                        <b>{v}</b>
                      </div>
                    ))}
                  </div>
                  <div className="discipline">
                    <div className="discipline-head">
                      <span>Plana uyum</span>
                      <strong style={{ fontWeight: 500 }}>
                        {filtered.length
                          ? pct((followed / filtered.length) * 100)
                          : "—"}
                      </strong>
                    </div>
                    <div className="progress">
                      <div
                        style={{
                          width: `${filtered.length ? (followed / filtered.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p>
                      {followed} / {filtered.length} işlemde plana uyuldu.
                    </p>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="table-heading">
                  <h2>
                    İşlemler <small>{filtered.length}</small>
                  </h2>
                  <div
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <div className="search">
                      <Search size={13} />
                      <input
                        aria-label="İşlemlerde ara"
                        placeholder="İşlem veya not ara…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <Button
                      aria-label="CSV dışa aktar"
                      title="Filtrelenmiş işlemleri CSV olarak indir"
                      variant="ghost"
                      size="icon"
                      onClick={download}
                    >
                      <Download size={15} />
                    </Button>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          ["date", "Tarih"],
                          ["symbol", "Ürün"],
                          ["side", "Yön"],
                          ["strategy", "Strateji"],
                          ["followed_plan", "Plana uyum"],
                          ["net_pnl", "Net sonuç"],
                        ].map(([key, label]) => (
                          <th
                            key={key}
                            aria-sort={
                              sort.key === key
                                ? sort.asc
                                  ? "ascending"
                                  : "descending"
                                : "none"
                            }
                          >
                            <button onClick={() => sortBy(key)}>
                              {label}
                              <ArrowDownUp size={10} />
                            </button>
                          </th>
                        ))}
                        <th>R</th>
                        <th>Not</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {new Date(r.date + "T12:00:00").toLocaleDateString(
                              "tr-TR",
                            )}
                          </td>
                          <td className="symbol">{r.symbol}</td>
                          <td>
                            <span className={"tag " + r.side}>
                              {r.side === "long" ? "↗ Long" : "↘ Short"}
                            </span>
                          </td>
                          <td>
                            <span className="tag">{r.strategy}</span>
                          </td>
                          <td>
                            <span className="plan-check">
                              {r.followed_plan === "yes" ? (
                                <Check size={12} color="#63876e" />
                              ) : (
                                <Minus size={12} color="#b4916b" />
                              )}
                              {r.followed_plan === "yes"
                                ? "Uyuldu"
                                : r.followed_plan === "no"
                                  ? "Plan dışı"
                                  : "Bilinmiyor"}
                            </span>
                          </td>
                          <td
                            className={r.net_pnl >= 0 ? "green" : "red"}
                            style={{ fontWeight: 600 }}
                          >
                            {r.net_pnl > 0 ? "+" : ""}
                            {money(r.net_pnl)}
                          </td>
                          <td>
                            {risk(r) ? number(r.net_pnl / risk(r)) + " R" : "—"}
                          </td>
                          <td>
                            <button
                              className="note-button"
                              title={r.note || "İşlemi düzenle"}
                              aria-label={`${r.date} işlemini düzenle`}
                              onClick={() => openTrade(r)}
                            >
                              <FileText size={14} />
                              {r.note && (
                                <span
                                  style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: "50%",
                                    background: "#6b8d75",
                                    marginLeft: 4,
                                  }}
                                />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visible.length && (
                    <div className="empty">
                      {rows.length
                        ? "Filtrelere uygun işlem bulunamadı."
                        : "Henüz işlem yok. İlk işlemini ekle veya CSV yükle."}
                    </div>
                  )}
                </div>
                <div className="table-footer">
                  <span>
                    {filtered.length
                      ? `${(activePage - 1) * 8 + 1}–${Math.min(activePage * 8, filtered.length)} / ${filtered.length} işlem`
                      : "0 işlem"}
                  </span>
                  <div className="pagination">
                    <span style={{ marginRight: 8 }}>
                      Sayfa {activePage} / {pages}
                    </span>
                    <button
                      aria-label="Önceki sayfa"
                      disabled={activePage <= 1}
                      onClick={() => setPage(activePage - 1)}
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      aria-label="Sonraki sayfa"
                      disabled={activePage >= pages}
                      onClick={() => setPage(activePage + 1)}
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
          {pageView === "reports" && (
            <div className="report-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Strateji karşılaştırması</h2>
                </div>
                <div className="table-scroll" style={{ marginTop: 20 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Strateji</th>
                        <th>İşlem</th>
                        <th>Kazanma</th>
                        <th>Net sonuç</th>
                        <th>Ort. R / n</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...new Set(filtered.map((r) => r.strategy))].map(
                        (k) => {
                          const s = summarize(
                            filtered.filter((r) => r.strategy === k),
                            initial,
                          );
                          return (
                            <tr key={k}>
                              <td>{k}</td>
                              <td>{s.count}</td>
                              <td>{pct(s.winRate)}</td>
                              <td className={s.net >= 0 ? "green" : "red"}>
                                {money(s.net)}
                              </td>
                              <td>
                                {s.averageR === null
                                  ? "—"
                                  : number(s.averageR) + " / " + s.rCount}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                  {!filtered.length && (
                    <div className="empty">Karşılaştırılacak işlem yok.</div>
                  )}
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Plana uyum ve ortalama sonuç</h2>
                </div>
                <div className="report-content">
                  {["yes", "no", "unknown"].map((k) => {
                    const rs = filtered.filter((r) => r.followed_plan === k),
                      s = summarize(rs, initial);
                    return (
                      <div className="report-line" key={k}>
                        <span>
                          {k === "yes"
                            ? "Plana uyulan"
                            : k === "no"
                              ? "Plan dışı"
                              : "Bilinmiyor"}{" "}
                          <small style={{ color: "#8b959d" }}>
                            ({rs.length} işlem)
                          </small>
                        </span>
                        <b style={{ fontWeight: 500 }}>
                          {rs.length ? money(s.net / rs.length) : "—"}
                        </b>
                      </div>
                    );
                  })}
                  <p style={{ marginTop: 20 }}>
                    İşlem başına net sonuç gösterilir. Bu gözlemsel
                    karşılaştırma neden-sonuç kanıtı değildir. Küçük örneklemler
                    genellenemez.
                  </p>
                </div>
              </section>
            </div>
          )}
          {pageView === "quality" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Veri kontrolü</h2>
                <span>Tüm günlük · {rows.length} işlem</span>
              </div>
              <div className="report-content">
                {[
                  [
                    "Olası tekrar",
                    dataQuality.duplicates,
                    "Aynı tarih, saat, ürün, yön, net sonuç, fiyat ve lota sahip kayıtlar. Ayrı işlemler de aynı değerlere sahip olabilir; otomatik silinmez.",
                  ],
                  [
                    "Risk bilgisi eksik",
                    dataQuality.missingRisk,
                    "Başlangıç riski bulunmayan işlemlerde R hesaplanmaz. Net sonuç analizde kalır.",
                  ],
                  [
                    "Plana uyum bilinmiyor",
                    dataQuality.unknownPlan,
                    "Eksik etiketler plan dışı kabul edilmez.",
                  ],
                  [
                    "Saat bilgisi eksik",
                    rows.filter((r) => !r.time).length,
                    "Saat olmayan aynı gün işlemleri dosya sırasını korur. Tüm saatler aracı kurum saatidir.",
                  ],
                ].map(([label, n, desc]) => (
                  <div className="quality-row" key={label}>
                    <div>
                      <h3>{label}</h3>
                      <p>{desc}</p>
                    </div>
                    <strong>{n}</strong>
                  </div>
                ))}
                <div className="quality-links">
                  <a href="/sample.csv" download>
                    Standart CSV şablonu
                  </a>
                  <a href="/mt5-example.csv" download>
                    Kurgusal pozisyon tablosu örneği
                  </a>
                  <a href="/mt5-guide.html" target="_blank" rel="noreferrer">
                    MT5 aktarım rehberi ↗
                  </a>
                </div>
              </div>
            </section>
          )}
          {pageView === "settings" && (
            <section className="panel" style={{ maxWidth: 640 }}>
              <div className="panel-heading">
                <h2>Hesap ayarları</h2>
              </div>
              <div className="report-content">
                <form
                  className="dialog-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget),
                      n = Number(fd.get("initial"));
                    if (!Number.isFinite(n) || n <= 0) {
                      setError("Başlangıç bakiyesi sıfırdan büyük olmalı.");
                      return;
                    }
                    setInitial(n);
                    setCurrency(fd.get("currency"));
                    setError("");
                    setPageView("journal");
                  }}
                >
                  <label>
                    Başlangıç bakiyesi
                    <input
                      name="initial"
                      type="number"
                      min="0.01"
                      step="any"
                      required
                      defaultValue={initial}
                    />
                  </label>
                  <label>
                    Para birimi
                    <select name="currency" defaultValue={currency}>
                      <option>USD</option>
                      <option>TRY</option>
                      <option>EUR</option>
                    </select>
                  </label>
                  <p className="wide" style={{ fontSize: 11 }}>
                    Para birimi yalnızca gösterim etiketidir; kur dönüşümü
                    yapılmaz. Tüm işlemler aynı para biriminde olmalıdır. Bakiye
                    yatırma/çekme hareketlerini içermez.
                  </p>
                  <div className="wide">
                    <Button type="submit">Ayarları kaydet</Button>
                  </div>
                </form>
                <hr
                  style={{
                    margin: "25px 0",
                    border: 0,
                    borderTop: "1px solid #e7ecef",
                  }}
                />
                <h3 style={{ fontSize: 12, marginBottom: 10 }}>
                  Veri yönetimi
                </h3>
                <p style={{ fontSize: 11, marginBottom: 14 }}>
                  İşlemler bu tarayıcıda saklanır. Tarayıcı verilerini
                  temizlemek kayıtları siler. Önce CSV yedeğini indir.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <Button variant="outline" onClick={() => download(true)}>
                    <Download size={14} /> Tam CSV yedeği
                  </Button>
                  <Button variant="outline" onClick={() => setModal("clear")}>
                    Günlüğü sıfırla
                  </Button>
                </div>
              </div>
            </section>
          )}
          <div className="page-foot">
            <span>
              {filtered.length < 30 && pageView !== "settings"
                ? "Az sayıda işlem: sonuçları ön bulgu olarak değerlendir."
                : "Aurum · İşlem günlüğü v0.3"}
            </span>
            <span>
              Maksimum düşüş yalnızca kapanmış işlemleri kapsar. Açık pozisyon
              riski dahil değildir.
            </span>
          </div>
        </div>
      </main>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v) setModal(null);
        }}
      >
        <DialogContent
          className={
            modal === "import" ? "sm:max-w-[850px]" : "sm:max-w-[600px]"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {modal === "trade"
                ? editing
                  ? "İşlemi düzenle"
                  : "Yeni işlem"
                : modal === "import"
                  ? "Dosya içe aktar"
                  : modal === "clear"
                    ? "Günlüğü sıfırla"
                    : "Kendi günlüğünü oluştur"}
            </DialogTitle>
            <DialogDescription>
              {modal === "trade"
                ? "Kapanmış işlemin masraflar sonrası net sonucunu kaydet."
                : modal === "import"
                  ? `${importData?.name || ""} · Sütunları eşleştir ve önizlemeyi kontrol et.`
                  : "Önce mevcut işlemlerini CSV olarak yedekleyebilirsin."}
            </DialogDescription>
          </DialogHeader>
          {modal === "trade" ? (
            <form onSubmit={submit} className="dialog-form">
              {[
                ["date", "Kapanış tarihi", "date"],
                ["symbol", "Ürün", "text"],
                ["net_pnl", `Net sonuç (${currency})`, "number"],
                ["strategy", "Strateji", "text"],
              ].map(([key, label, type]) => (
                <label key={key}>
                  {label}
                  <input
                    type={type}
                    step={type === "number" ? "any" : undefined}
                    value={form[key] ?? ""}
                    required
                    maxLength={type === "text" ? 80 : undefined}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Kapanış saati (aracı kurum saati)
                <input
                  type="time"
                  step="1"
                  value={form.time || ""}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
              <label>
                Yön
                <select
                  value={form.side}
                  onChange={(e) => setForm({ ...form, side: e.target.value })}
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </label>
              <label>
                Plana uyum
                <select
                  value={form.followed_plan}
                  onChange={(e) =>
                    setForm({ ...form, followed_plan: e.target.value })
                  }
                >
                  <option value="unknown">Bilinmiyor</option>
                  <option value="yes">Uyuldu</option>
                  <option value="no">Plan dışı</option>
                </select>
              </label>
              <div className="wide risk-section">
                <h3>
                  Risk ve işlem ayrıntıları <small>İsteğe bağlı</small>
                </h3>
                <p>
                  R = net sonuç / başlangıç riski. Riski doğrudan gir veya
                  giriş, ilk stop, lot ve aracı kurumun tick değerlerini doldur.
                  Başlangıç stopu kullanılır; sonradan taşınan stop değil.
                </p>
                <div className="dialog-form">
                  {[
                    ["risk_amount", `Başlangıç riski (${currency})`],
                    ["entry", "Giriş fiyatı"],
                    ["exit", "Çıkış fiyatı"],
                    ["stop", "İlk stop fiyatı"],
                    ["lot", "Lot"],
                    ["tick_size", "Tick büyüklüğü"],
                    ["tick_value", `1 lot tick değeri (${currency})`],
                    ["gross_pnl", "Brüt sonuç"],
                    ["commission", "Komisyon (işaretli)"],
                    ["swap", "Swap (işaretli)"],
                    ["fee", "Ücret (işaretli)"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        min={
                          ["gross_pnl", "commission", "swap", "fee"].includes(
                            key,
                          )
                            ? undefined
                            : "0.00000001"
                        }
                        step="any"
                        value={form[key] ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <p>
                  R:{" "}
                  {risk(form)
                    ? number(Number(form.net_pnl || 0) / risk(form))
                    : "—"}{" "}
                  · Fiyat riski masraf ve kaymayı içermez. Doğrudan girilen risk
                  önceliklidir.
                </p>
              </div>
              <label className="wide">
                İşlem notu
                <textarea
                  rows={3}
                  maxLength={2000}
                  placeholder="Giriş gerekçesi, yapılan hata veya öğrendiğin…"
                  value={form.note || ""}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </label>
              {formError && (
                <p role="alert" className="wide red">
                  {formError}
                </p>
              )}
              <div
                className="wide"
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModal(null)}
                >
                  Vazgeç
                </Button>
                <Button type="submit">İşlemi kaydet</Button>
              </div>
            </form>
          ) : modal === "import" ? (
            <ImportWizard
              data={importData}
              currency={currency}
              onBackup={() => download(true)}
              onImport={(next) => {
                setRows(next.map((r) => ({ ...r, id: id() })));
                setDemo(false);
                resetFilters();
                setPage(1);
                setModal(null);
                setLoaded(true);
              }}
            />
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#65717a" }}>
                {modal === "clear"
                  ? "Bu tarayıcıdaki tüm işlemler kaldırılacak."
                  : "Örnek işlemler kaldırılacak ve boş bir günlük açılacak. Yeni kayıtların bu tarayıcıda saklanacak."}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <Button variant="outline" onClick={() => download(true)}>
                  Tam CSV yedeği indir
                </Button>
                <Button
                  onClick={() => {
                    setRows([]);
                    setDemo(false);
                    setLoaded(true);
                    resetFilters();
                    setPageView("journal");
                    setModal(null);
                  }}
                >
                  Boş günlük oluştur
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
