const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const scope = {};
vm.createContext(scope);
vm.runInContext(fs.readFileSync("public/analytics.js", "utf8"), scope);
const A = scope.GoldAnalytics;
const base = {
  date: "2026-01-02",
  symbol: "XAUUSD",
  side: "long",
  net_pnl: 95,
  strategy: "test",
  followed_plan: "unknown",
};
test("broker tick specifications and explicit risk override", () => {
  const r = A.normalize({
    ...base,
    entry: 2600,
    stop: 2590,
    lot: 0.1,
    tick_size: 0.01,
    tick_value: 1,
  });
  assert.equal(A.risk(r), 100);
  assert.equal(A.summarize([r], 10000).averageR, 0.95);
  assert.equal(A.risk({ ...r, risk_amount: 50 }), 50);
});
test("missing risk does not become zero R", () => {
  const s = A.summarize([A.normalize(base)], 10000);
  assert.equal(s.rCount, 0);
  assert.equal(s.averageR, null);
});
test("net and signed cash flows reconcile", () => {
  A.normalize({ ...base, gross_pnl: 100, commission: -4, swap: -1, fee: 0 });
  assert.throws(
    () => A.normalize({ ...base, gross_pnl: 100, commission: 4, swap: 1 }),
    /uyuşmuyor/,
  );
});
test("reject non-finite, zero size, invalid stop and wrong time", () => {
  for (const v of [
    { risk_amount: 0 },
    { lot: -1 },
    { entry: 2600, stop: 2601 },
    { net_pnl: "Infinity" },
    { net_pnl: "0x10" },
    { time: "24:01" },
  ])
    assert.throws(() => A.normalize({ ...base, ...v }));
});
test("closure order and initial balance included in drawdown", () => {
  const rows = [
    { ...base, date: "2026-01-03", net_pnl: 50 },
    { ...base, net_pnl: -100 },
  ];
  assert.equal(A.summarize(rows, 1000).maxDrawdown, 100);
  assert.equal(A.summarize(rows, 1000).curve[1], 900);
});
test("unknown tags and possible repeats counted without deleting", () => {
  const r = A.normalize(base);
  const q = A.quality([r, r]);
  assert.equal(q.duplicates, 1);
  assert.equal(q.unknownPlan, 2);
  assert.equal(q.missingRisk, 2);
});
test("semicolon locale delimiter accepted with decimal points", () => {
  assert.equal(
    A.parseCSV(
      "date;symbol;side;net_pnl;strategy;followed_plan\n2026-01-02;XAUUSD;long;1.5;A;unknown",
    )[0].net_pnl,
    1.5,
  );
});
