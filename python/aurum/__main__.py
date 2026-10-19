import argparse
from pathlib import Path
from .analysis import read_trades, write_report
p=argparse.ArgumentParser(description='Validate a normalized Aurum CSV and create a local SQLite/report snapshot.')
p.add_argument('input',type=Path)
p.add_argument('--out',type=Path,default=Path('private-data/analysis'))
p.add_argument('--initial',type=float,default=10000)
p.add_argument('--synthetic',action='store_true')
a=p.parse_args()
import math
if not math.isfinite(a.initial) or a.initial<=0:
    p.error('--initial must be finite and positive')
s=write_report(read_trades(a.input),a.out,a.synthetic,a.initial)
print(f"Validated {s['count']} trades. Report: {a.out/'REPORT.md'}")
