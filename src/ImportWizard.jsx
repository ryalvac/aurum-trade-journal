import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { fields, guessMapping, convertImport } from "./importer";
export default function ImportWizard({ data, onImport, onBackup, currency }) {
  const [headerRow, setHeaderRow] = useState(data.headerRow);
  const [map, setMap] = useState(() =>
    guessMapping(data.matrix[data.headerRow]),
  );
  const [costMode, setCostMode] = useState("signed");
  const [confirm, setConfirm] = useState(false);
  const [keepDuplicates, setKeepDuplicates] = useState(false);
  const headers = data.matrix[headerRow] || [];
  const result = useMemo(
    () => convertImport(data, headerRow, map, costMode),
    [data, headerRow, map, costMode],
  );
  return (
    <>
      <p className="import-help">
        Kapanmış pozisyon veya standart Aurum tablosu kullan. Ham deal kayıtları
        desteklenmez. Eşleştirmeyi ve hesap para birimini kontrol et:{" "}
        <b>{currency}</b>.
      </p>
      <div className="import-config">
        <label>
          Başlık satırı
          <select
            value={headerRow}
            onChange={(e) => {
              const n = Number(e.target.value);
              setHeaderRow(n);
              setMap(guessMapping(data.matrix[n]));
              setConfirm(false);
            }}
          >
            {data.matrix.slice(0, 40).map((r, i) => (
              <option key={i} value={i}>
                {i + 1}: {r.slice(0, 3).join(" · ").slice(0, 90)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Komisyon / ücret gösterimi
          <select
            value={costMode}
            onChange={(e) => setCostMode(e.target.value)}
          >
            <option value="signed">İşaretli değerleri aynen kullan</option>
            <option value="positive">Pozitif komisyon/ücreti gider say</option>
          </select>
        </label>
      </div>
      <p className="import-help">
        Swap işareti aynen korunur. Pozitif swap gelir olabilir. Net sonuç zaten
        masrafları içeriyorsa tekrar düşülmez.
      </p>
      <div className="mapping-grid">
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <select
              value={map[key] ?? -1}
              onChange={(e) => {
                setMap({ ...map, [key]: Number(e.target.value) });
                setConfirm(false);
              }}
            >
              <option value={-1}>Eşleştirilmedi</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {i + 1}. {String(h || "(boş)")}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="import-preview">
        <b>
          Önizleme: {result.rows.length} geçerli · {result.issues.length} hatalı
          · {result.duplicates} olası tekrar
        </b>
        <p>
          Eksik strateji “Etiketsiz”, eksik plana uyum “Bilinmiyor” olarak
          saklanır. Risk alanı eksik işlemlerde R hesaplanmaz.
        </p>
        {result.issues.length > 0 && (
          <ul role="alert">
            {result.issues.slice(0, 6).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Ürün</th>
                <th>Yön</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.slice(0, 3).map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>{r.symbol}</td>
                  <td>{r.side}</td>
                  <td>{r.net_pnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {result.duplicates > 0 && (
        <label className="confirm-line">
          <input
            type="checkbox"
            checked={keepDuplicates}
            onChange={(e) => setKeepDuplicates(e.target.checked)}
          />
          Olası tekrarları inceledim; ayrı işlemler olarak tut.
        </label>
      )}
      <label className="confirm-line">
        <input
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        Her satırın tek kapanmış pozisyon olduğunu, masrafları ve {currency}{" "}
        para birimini kontrol ettim. Mevcut günlük değiştirilecek.
      </label>
      <div className="import-actions">
        <Button variant="outline" onClick={onBackup}>
          Tam yedek indir
        </Button>
        <Button
          disabled={
            !confirm ||
            !result.rows.length ||
            result.issues.length > 0 ||
            (result.duplicates > 0 && !keepDuplicates)
          }
          onClick={() => onImport(result.rows)}
        >
          İçe aktar ve değiştir
        </Button>
      </div>
    </>
  );
}
