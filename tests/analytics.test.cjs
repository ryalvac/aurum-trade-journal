const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const scope = {};
vm.createContext(scope);
vm.runInContext(
  fs.readFileSync(
    require("node:path").join(__dirname, "../public/analytics.js"),
    "utf8",
  ),
  scope,
);
const { parseCSV, summarize } = scope.GoldAnalytics;
const csv = fs.readFileSync(
  require("node:path").join(__dirname, "../public/sample.csv"),
  "utf8",
);
test("sample accounting and drawdown", () => {
  const r = parseCSV(csv),
    s = summarize(r, 10000);
  assert.equal(s.count, 12);
  assert.equal(s.net, 445);
  assert.equal(s.winRate, 50);
  assert.equal(s.maxDrawdown, 210);
  assert.equal(s.curve.at(-1), 10445);
  assert.equal(s.profitFactor, 915 / 470);
});
test("quoted commas and multiline values", () => {
  const r = parseCSV(
    'date,symbol,side,net_pnl,strategy,followed_plan\n2026-01-01,XAUUSD,long,5,"A, B\nC",yes',
  );
  assert.equal(r[0].strategy, "A, B\nC");
});
test("invalid rows rejected", () => {
  for (const [a, b] of [
    ["2026-09-01", "2026-02-30"],
    ["long", "buy"],
    ["125", "abc"],
    ["125", ""],
    ["yes", "maybe"],
  ])
    assert.throws(() => parseCSV(csv.replace(a, b)));
});
test("empty, all-loss and all-win cases", () => {
  assert.equal(summarize([], 100).winRate, 0);
  assert.equal(
    summarize([{ net_pnl: -15 }, { net_pnl: -10 }], 100).maxDrawdown,
    25,
  );
  assert.equal(summarize([{ net_pnl: 10 }], 100).profitFactor, null);
});
