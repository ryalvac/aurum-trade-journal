-- Strategy comparison. Flat trades, not raw MT5 deals.
SELECT strategy, COUNT(*) AS n, SUM(net_pnl) AS net,
       AVG(net_pnl) AS expectancy,
       100.0*SUM(CASE WHEN net_pnl>0 THEN 1 ELSE 0 END)/COUNT(*) AS win_rate,
       AVG(r_multiple) AS average_r, COUNT(r_multiple) AS r_count
FROM trades GROUP BY strategy;

-- Daily realised performance (not open-position equity).
SELECT close_date, SUM(net_pnl) AS daily_net, COUNT(*) AS n
FROM trades GROUP BY close_date ORDER BY close_date;

-- Compare plan labels without conflating unknown with no.
SELECT followed_plan, COUNT(*) AS n, AVG(net_pnl) AS average_net, AVG(r_multiple) AS average_r
FROM trades GROUP BY followed_plan;

-- Cumulative net by closure order. The application adds its initial balance.
SELECT id, close_date, close_time, net_pnl,
       SUM(net_pnl) OVER (ORDER BY close_date, COALESCE(close_time,''), id ROWS UNBOUNDED PRECEDING) AS cumulative_net
FROM trades ORDER BY close_date, COALESCE(close_time,''), id;
