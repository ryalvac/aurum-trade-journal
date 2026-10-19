# Veri sözleşmesi v0.3

Her satır tek kapanmış pozisyon. Açılış/kapanış deal çiftleri ve kısmi kapanışlar bu sözleşmeye önceden dönüştürülmelidir. Net sonuç otoritatiftir; fiyat ve lot alanları net sonucu yeniden tahmin etmek için kullanılmaz.

| Alan | Tip | Kural |
|---|---|---|
| date | tarih | YYYY-MM-DD kapanış tarihi, zorunlu |
| time | metin | HH:MM[:SS], aracı kurum saati, isteğe bağlı |
| symbol | metin | Aracı kurumun sembolü, zorunlu |
| side | enum | long / short |
| net_pnl | sayı | Hesap para biriminde, masraflar sonrası, zorunlu |
| strategy | metin | Eksik eşleme: Etiketsiz |
| followed_plan | enum | yes / no / unknown; eksik: unknown |
| entry / exit / stop | pozitif sayı | Giriş / çıkış / ilk stop fiyatı |
| lot | pozitif sayı | Lot miktarı; sözleşme büyüklüğü varsayılmaz |
| tick_size | pozitif sayı | Minimum fiyat adımı |
| tick_value | pozitif sayı | 1 lot için tick değeri, hesap para biriminde |
| risk_amount | pozitif sayı | Başlangıç fiyat riski, hesap para biriminde; varsa tick formülüne göre öncelikli |
| gross_pnl | sayı | Masraflar öncesi sonuç; varsa net mutabakatı zorunlu |
| commission / swap / fee | sayı | İşaretli nakit akışları: gider negatif, gelir pozitif |
| note | metin | İsteğe bağlı işlem gerekçesi / gözlem |

Standart CSV UTF-8, virgül/sekme/noktalı virgül ayırıcılı olabilir; sayılar ondalık noktalı, binlik ayırıcısız olmalıdır. Python komut satırı standart virgüllü Aurum CSV bekler; tarayıcı dışa aktarımı bu formatı üretir. Ek bilinmeyen sütunlar analizde kullanılmaz.

R, fiyat riski bilgisi olan işlemler üzerinden ortalanır; kapsam sayısı her zaman verilir. Eksik R sıfıra çevrilmez. Kazanma oranının paydasına başa baş işlemler dahildir. Pozitif zarar yoksa kâr faktörü tanımsızdır. Düşüş, başlangıç bakiyesi dahil kapanış zirvesinden düşüş olarak hesaplanır.

Olası tekrar anahtarı: tarih, saat, ürün, yön, net sonuç, giriş, çıkış, lot. Aynı değerler farklı işlemlerde bulunabileceğinden kayıtlar sessizce silinmez. Yükleme önizlemesinde olası tekrarların kullanıcı tarafından onaylanması gerekir.
