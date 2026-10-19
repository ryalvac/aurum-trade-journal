"""CSV validation, SQLite analysis and deterministic exploratory inference."""
import csv
import json
import math
import random
import sqlite3
from datetime import date, time
from pathlib import Path

REQUIRED = ('date', 'symbol', 'side', 'net_pnl', 'strategy', 'followed_plan')
OPTIONAL = ('entry', 'exit', 'stop', 'lot', 'tick_size', 'tick_value', 'risk_amount', 'gross_pnl', 'commission', 'swap', 'fee')

def numeric(v):
    if v is None or str(v).strip() == '':
        return None
    import re
    if not re.fullmatch(r'[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?', str(v).strip(), re.I):
        raise ValueError('Invalid number: use decimal point and no thousands separators')
    n = float(v)
    if not math.isfinite(n):
        raise ValueError('Non-finite number')
    return n

def validate(raw):
    r = dict(raw)
    for k in REQUIRED:
        if k not in r:
            raise ValueError(f'Missing column: {k}')
    if date.fromisoformat(r['date']).isoformat() != r['date']:
        raise ValueError('Invalid date')
    if r['side'] not in ('long', 'short') or r['followed_plan'] not in ('yes', 'no', 'unknown'):
        raise ValueError('Invalid direction or plan label')
    if not r['symbol'].strip() or not r['strategy'].strip():
        raise ValueError('Empty symbol/strategy')
    r['net_pnl'] = numeric(r['net_pnl'])
    if r['net_pnl'] is None:
        raise ValueError('Missing net result')
    for k in OPTIONAL:
        r[k] = numeric(r.get(k))
    for k in ('entry', 'exit', 'stop', 'lot', 'tick_size', 'tick_value', 'risk_amount'):
        if r[k] is not None and r[k] <= 0:
            raise ValueError(f'{k} must be positive')
    if r.get('time'):
        import re
        if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?', r['time']):
            raise ValueError('Invalid time')
        time.fromisoformat(r['time'])
    if r['entry'] is not None and r['stop'] is not None:
        if (r['side'] == 'long' and r['stop'] >= r['entry']) or (r['side'] == 'short' and r['stop'] <= r['entry']):
            raise ValueError('Initial stop is on wrong side')
    if r['gross_pnl'] is not None:
        derived = r['gross_pnl'] + (r['commission'] or 0) + (r['swap'] or 0) + (r['fee'] or 0)
        if abs(derived - r['net_pnl']) > .011:
            raise ValueError('Net/gross/cost reconciliation failed')
    r['note'] = r.get('note') or ''
    return r

def read_trades(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        if len(reader.fieldnames or []) != len(set(reader.fieldnames or [])):
            raise ValueError('Duplicate column names')
        out = []
        for line, r in enumerate(reader, 2):
            if None in r or any(v is None for v in r.values()):
                raise ValueError(f'Line {line}: wrong column count')
            try:
                out.append(validate(r))
            except (ValueError, TypeError) as e:
                raise ValueError(f'Line {line}: {e}') from e
    return sorted(out, key=lambda r: (r['date'], r.get('time') or ''))

def risk(r):
    if (r.get('risk_amount') or 0) > 0:
        return r['risk_amount']
    if all((r.get(k) or 0) > 0 for k in ('entry', 'stop', 'lot', 'tick_size', 'tick_value')):
        return abs(r['entry'] - r['stop']) / r['tick_size'] * r['tick_value'] * r['lot']
    return None

def summary(rows, initial=10000):
    net = 0
    peak = initial
    dd = 0
    dd_pct = 0
    curve = [initial]
    gains = []
    losses = []
    rs = []
    for r in sorted(rows, key=lambda r: (r['date'], r.get('time') or '')):
        n = r['net_pnl']
        net += n
        if n > 0:
            gains.append(n)
        elif n < 0:
            losses.append(-n)
        eq = initial + net
        peak = max(peak, eq)
        dd = max(dd, peak - eq)
        if peak > 0:
            dd_pct = max(dd_pct, (peak - eq) / peak * 100)
        curve.append(eq)
        rr = risk(r)
        if rr:
            rs.append(n / rr)
    return dict(count=len(rows), net=net, winRate=100*len(gains)/len(rows) if rows else 0,
                profitFactor=sum(gains)/sum(losses) if losses else None,
                payoff=(sum(gains)/len(gains))/(sum(losses)/len(losses)) if gains and losses else None,
                maxDrawdown=dd, maxDrawdownPct=dd_pct, curve=curve,
                averageR=sum(rs)/len(rs) if rs else None, rCount=len(rs))

def plan_bootstrap(rows, iterations=3000, seed=42):
    """Unpaired trade-level percentile bootstrap; dependence is NOT modelled."""
    a = [r['net_pnl'] for r in rows if r['followed_plan'] == 'yes']
    b = [r['net_pnl'] for r in rows if r['followed_plan'] == 'no']
    if len(a) < 2 or len(b) < 2:
        return {'n_yes':len(a), 'n_no':len(b), 'difference':None, 'ci95':None}
    rng = random.Random(seed)
    samples = sorted(sum(rng.choices(a, k=len(a)))/len(a) - sum(rng.choices(b, k=len(b)))/len(b) for _ in range(iterations))
    return {'n_yes':len(a), 'n_no':len(b), 'difference':sum(a)/len(a)-sum(b)/len(b),
            'ci95':[samples[int(iterations*.025)], samples[min(iterations-1,int(iterations*.975))]]}

def to_sqlite(rows, path):
    con = sqlite3.connect(path)
    con.executescript((Path(__file__).resolve().parents[2] / 'sql/schema.sql').read_text())
    # This is a derived analytical snapshot, not the application's primary storage.
    con.execute('DELETE FROM trades')
    for i, r in enumerate(rows):
        rr = risk(r)
        con.execute('INSERT INTO trades VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                    (i+1, r['date'], r.get('time') or None, r['symbol'], r['side'], r['strategy'],
                     r['followed_plan'], r['net_pnl'], rr, r['net_pnl']/rr if rr else None, r['note']))
    con.commit()
    return con

def write_report(rows, out, synthetic=False, initial=10000):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    s = summary(rows, initial)
    b = plan_bootstrap(rows)
    con = to_sqlite(rows, out/'analysis.sqlite')
    groups = con.execute('SELECT strategy, COUNT(*), ROUND(SUM(net_pnl),2), ROUND(AVG(net_pnl),2) FROM trades GROUP BY strategy ORDER BY SUM(net_pnl) DESC').fetchall()
    con.close()
    (out/'summary.json').write_text(json.dumps({'summary':s,'plan_comparison':b,'synthetic':synthetic},indent=2),encoding='utf-8')
    lines = ['# Aurum — Analiz raporu', '', '**KURGUSAL VERİ: Bu sonuçlar gerçek işlem performansı değildir.**' if synthetic else 'Kullanıcının yerel dosyasından üretildi. Paylaşmadan önce içeriği kontrol edin.', '',
             f"İşlem sayısı: {s['count']} · Net sonuç: {s['net']:.2f} hesap para birimi · Kazanma: %{s['winRate']:.2f}",
             f"Maksimum kapanış düşüşü: {s['maxDrawdown']:.2f} · R bilgisi olan: {s['rCount']}", '',
             '## Strateji özeti', '', '| Strateji | İşlem | Net | Ortalama |', '|---|---:|---:|---:|']
    lines += [f'| {name.replace(chr(124),chr(47))} | {n} | {net:.2f} | {mean:.2f} |' for name,n,net,mean in groups]
    lines += ['', '## Araştırma: Plana uyum ve sonuç', '', f"Uyulan: {b['n_yes']}, uyulmayan: {b['n_no']} işlem."]
    if b['ci95']:
        lines += [f"İşlem başına ortalama net sonuç farkı (uyulan − uyulmayan): {b['difference']:.2f}.",
                  f"Keşif amaçlı %95 bootstrap aralığı: [{b['ci95'][0]:.2f}, {b['ci95'][1]:.2f}]."]
    else:
        lines += ['İki grupta da en az iki işlem olmadığından aralık hesaplanmadı.']
    lines += ['', '## Sınırlar', '',
              'Bu karşılaştırma nedensellik göstermez. Strateji, işlem büyüklüğü ve piyasa koşulları karıştırıcı değişken olabilir. İşlem düzeyi bootstrap bağımsızlık varsayar; seri bağımlılığı ve gün içi kümelenmeyi modellemez. Küçük örneklemde aralık güvenilir olmayabilir. Aynı gün işlem sırası dosyadaki sıradır; saat varsa kapanış saatine göre sıralanır. Açık pozisyonlar ve para yatırma/çekme dahil değildir. R, başlangıç stopuna dayalı fiyat riskidir; masraf ve kayma içermez.',
              'Kurgusal veriyle elde edilen farklar bir stratejinin etkinliğine ilişkin kanıt değildir. Gerçek veride doğrulama ve işlem büyüklüğüne göre kontrol gerekir.']
    (out/'REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    return s
