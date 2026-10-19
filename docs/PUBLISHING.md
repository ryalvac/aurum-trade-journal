# Yayınlama

## GitHub

Kaynaklar, testler, CI yapılandırması, veri sözleşmesi ve kurgusal veri hazır. Kullanıcının ryalvac hesabına erişim olmadan GitHub deposu oluşturulmuş veya yayınlanmış kabul edilmez. `private-data/`, hesap raporları ve erişim anahtarlarını yüklemeyin. Sites kaynak deposu, kullanıcının GitHub deposuyla aynı şey değildir.

## Kaggle

`notebooks/aurum-analysis.ipynb` tek başına çalışır: 12 kurgusal kaydı içerir, internet bağlantısı gerekmez, yalnızca Pandas kullanır. Kod hücreleri sıralı çalıştırılarak çıktıları kaydedilmiştir. Kaggle'da yeni notebook'a içe aktar ve Run All ile hedef ortamı doğrula. Başlıkta synthetic / kurgusal veri olduğunu belirt. Kaggle üzerinde yayınlandığı henüz doğrulanmadı.

## Hugging Face

Docker Space paketi `deploy/huggingface/` altında. Kök kaynağı yüklerken buradaki README ve Dockerfile dosyalarını Space köküne taşı. Nginx dosyası aynı konumda kalır. Docker burada çalıştırılmadı; Vite üretim çıktısı yerelde doğrulanır. Hesap erişimi ve canlı Space doğrulaması gerekir.

## Paylaşım öncesi veri kontrolü

Örnek raporlar yalnızca kurgusal veridir. Gerçek MT5 dosyası kullanıcı tarafından sağlanırsa yerelde analiz edilir; kamuya açık veri setine dönüştürülmez. Anonimleştirme bile işlem zamanları ve finansal sonuçların yeniden tanınmasını tamamen engellemez. Kamuya açık demo için kurgusal veri kullanın.
