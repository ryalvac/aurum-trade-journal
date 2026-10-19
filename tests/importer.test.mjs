import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const scope = {};
vm.createContext(scope);
vm.runInContext(fs.readFileSync("public/analytics.js", "utf8"), scope);
globalThis.window = { GoldAnalytics: scope.GoldAnalytics };
const { guessMapping, convertImport } = await import("../src/importer.js");
test("MT5-like flat position column mapping reconciles costs and preserves unknown tags", () => {
  const matrix = scope.GoldAnalytics.table(
    fs.readFileSync("public/mt5-example.csv", "utf8"),
  );
  const r = convertImport({ matrix }, 0, guessMapping(matrix[0]));
  assert.equal(r.issues.length, 0);
  assert.equal(r.rows[0].net_pnl, 125);
  assert.equal(r.rows[0].time, "10:15:00");
  assert.equal(r.rows[0].followed_plan, "unknown");
  assert.equal(r.rows[1].side, "short");
});
test("raw deal rows rejected", () => {
  const matrix = [
    ["Time", "Symbol", "Type", "Profit", "Entry", "Deal"],
    ["2026.01.01", "XAUUSD", "buy", 10, "in", 123],
  ];
  const r = convertImport({ matrix }, 0, guessMapping(matrix[0]));
  assert.ok(r.issues.length);
  assert.equal(r.rows.length, 0);
});
test("possible duplicates preserved and identified", () => {
  const matrix = scope.GoldAnalytics.table(
    fs.readFileSync("public/mt5-example.csv", "utf8"),
  );
  matrix.push([...matrix[1]]);
  const r = convertImport({ matrix }, 0, guessMapping(matrix[0]));
  assert.equal(r.duplicates, 1);
  assert.equal(r.rows.length, 3);
});
test("invalid rows reported instead of accepted silently", () => {
  const matrix = [
    ["date", "symbol", "side", "net_pnl"],
    ["2026-02-30", "XAUUSD", "long", 10],
  ];
  const r = convertImport({ matrix }, 0, guessMapping(matrix[0]));
  assert.equal(r.rows.length, 0);
  assert.equal(r.issues.length, 1);
});
test("positive expense mode subtracts commission but preserves positive swap", () => {
  const matrix = [
    ["date", "symbol", "side", "profit", "commission", "swap"],
    ["2026-01-02", "XAUUSD", "long", 100, 5, 2],
  ];
  const r = convertImport({ matrix }, 0, guessMapping(matrix[0]), "positive");
  assert.equal(r.rows[0].net_pnl, 97);
});
test('normalized export roundtrip preserves explicit closing time and risk',()=>{const matrix=scope.GoldAnalytics.table(fs.readFileSync('public/sample.csv','utf8'));const result=convertImport({matrix},0,guessMapping(matrix[0]));assert.equal(result.issues.length,0);assert.equal(result.rows[0].time,'10:15:00');assert.equal(scope.GoldAnalytics.summarize(result.rows,10000).rCount,10);});
