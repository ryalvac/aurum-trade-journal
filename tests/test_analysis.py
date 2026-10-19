import unittest
import json
import sqlite3
import subprocess
import tempfile
from pathlib import Path
from aurum.analysis import read_trades,summary,risk,validate,plan_bootstrap,to_sqlite
ROOT=Path(__file__).resolve().parents[1]
class AnalysisTests(unittest.TestCase):
    def setUp(self):
        self.rows=read_trades(ROOT/'public/sample.csv')
    def test_expected_totals(self):
        s=summary(self.rows)
        self.assertEqual((s['count'],s['net'],s['maxDrawdown'],s['rCount']),(12,445,210,10))
    def test_python_browser_parity(self):
        script="const vm=require('node:vm'),fs=require('node:fs');const s={};vm.createContext(s);vm.runInContext(fs.readFileSync('public/analytics.js','utf8'),s);console.log(JSON.stringify(s.GoldAnalytics.summarize(s.GoldAnalytics.parseCSV(fs.readFileSync('public/sample.csv','utf8')),10000)))"
        js=json.loads(subprocess.check_output(['node','-e',script],cwd=ROOT,text=True))
        py=summary(self.rows)
        for k in js:
            if isinstance(js[k],list):self.assertEqual(js[k],py[k])
            elif js[k] is None:self.assertIsNone(py[k])
            else:self.assertAlmostEqual(js[k],py[k],places=10)
    def test_signed_cost_and_risk(self):
        r=dict(self.rows[0],risk_amount=None,entry=2600,stop=2590,lot=.1,tick_size=.01,tick_value=1)
        self.assertEqual(risk(validate(r)),100)
        with self.assertRaises(ValueError):validate(dict(r,stop=2601))
        with self.assertRaises(ValueError):validate(dict(r,commission=20))
    def test_sql_reconciliation(self):
        con=to_sqlite(self.rows,':memory:')
        self.assertEqual(con.execute('SELECT SUM(net_pnl) FROM trades').fetchone()[0],445)
        queries=(ROOT/'sql/queries.sql').read_text().split(';')
        for q in queries:
            if q.strip():con.execute(q).fetchall()
        con.close()
    def test_bootstrap_reproducibility_and_missing_groups(self):
        self.assertEqual(plan_bootstrap(self.rows),plan_bootstrap(self.rows))
        self.assertIsNone(plan_bootstrap([])['ci95'])
    def test_export_can_be_validated_again(self):
        for r in self.rows:validate(r)
if __name__=='__main__':unittest.main()
