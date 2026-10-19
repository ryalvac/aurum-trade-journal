CREATE TABLE IF NOT EXISTS trades (
 id INTEGER PRIMARY KEY,
 close_date TEXT NOT NULL,
 close_time TEXT,
 symbol TEXT NOT NULL,
 side TEXT NOT NULL CHECK(side IN ('long','short')),
 strategy TEXT NOT NULL,
 followed_plan TEXT NOT NULL CHECK(followed_plan IN ('yes','no','unknown')),
 net_pnl REAL NOT NULL,
 risk_amount REAL CHECK(risk_amount>0),
 r_multiple REAL,
 note TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trades_date ON trades(close_date,close_time);
