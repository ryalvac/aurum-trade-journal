(function(root){
'use strict';
function parseCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted){quoted=false;}else if(field===''){quoted=true;}else throw Error('Geçersiz tırnak kullanımı.');}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('Kapanmamış tırnak var.');row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw Error('Başlık ve en az bir işlem gerekli.');
 const headers=rows.shift().map(x=>x.trim());const required=['date','symbol','side','net_pnl','strategy','followed_plan'];
 if(required.some(x=>!headers.includes(x))||new Set(headers).size!==headers.length)throw Error('Sütunlar şablonla eşleşmiyor. Örnek CSV dosyasını kullanın.');
 return rows.map((r,i)=>{if(r.length!==headers.length)throw Error(`${i+2}. satırdaki sütun sayısı hatalı.`);const o=Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));
 const d=new Date(o.date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(o.date)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==o.date)throw Error(`${i+2}. satır: tarih YYYY-MM-DD olmalı.`);
 if(!o.net_pnl||!Number.isFinite(Number(o.net_pnl)))throw Error(`${i+2}. satır: net_pnl sayı olmalı; ondalık için nokta kullanın.`);
 if(!['long','short'].includes(o.side)||!['yes','no'].includes(o.followed_plan)||!o.symbol||!o.strategy)throw Error(`${i+2}. satır: yön long/short, plana uyum yes/no olmalı; sembol ve strateji boş olamaz.`);
 return {...o,net_pnl:Number(o.net_pnl)};
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
function summarize(rows,initial){let sum=0,peak=initial,maxDrawdown=0;const curve=[initial];let wins=0,gain=0,loss=0,losers=0;
 for(const r of rows){sum+=r.net_pnl;if(r.net_pnl>0){wins++;gain+=r.net_pnl;}if(r.net_pnl<0){loss-=r.net_pnl;losers++;}const equity=initial+sum;peak=Math.max(peak,equity);maxDrawdown=Math.max(maxDrawdown,peak-equity);curve.push(equity);}
 return {count:rows.length,net:sum,winRate:rows.length?wins/rows.length*100:0,profitFactor:loss?gain/loss:null,payoff:wins&&losers?(gain/wins)/(loss/losers):null,maxDrawdown,curve};
}
const api={parseCSV,summarize};if(typeof module!=='undefined')module.exports=api;else root.GoldAnalytics=api;
})(typeof window!=='undefined'?window:globalThis);
