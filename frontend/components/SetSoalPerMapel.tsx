"use client";

import { ReactNode, useMemo, useState } from "react";

// Satu mapel bisa punya beberapa set soal (bagian): Matematika 1, Matematika 2, ...
// Kiri daftar mapel, kanan kartu set milik mapel terpilih. Paket dengan satu mapel
// langsung menampilkan kartu set tanpa kolom mapel.
export type SetSoal = {
  bagian_id: number;
  nama: string;
  jumlah_soal?: number;
  pelajaran_id?: number | null;
  pelajaran_nama?: string | null;
};

// Nama set di kartu dipersingkat: "Matematika 2" di bawah mapel Matematika -> "Set 2".
function namaSingkat(item: SetSoal) {
  const mapel = item.pelajaran_nama?.trim();
  if (mapel && item.nama.toLowerCase().startsWith(`${mapel.toLowerCase()} `)) {
    return `Set ${item.nama.slice(mapel.length + 1)}`;
  }
  return item.nama;
}

// Durasi ringkas untuk kartu set: "15 mnt", "1 j 30 mnt".
export function durasiSingkat(menit?: number | null) {
  if (!menit) return "-";
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (!jam) return `${sisa} mnt`;
  return sisa ? `${jam} j ${sisa} mnt` : `${jam} j`;
}

type Props<T extends SetSoal> = {
  items: T[];
  renderMeta: (item: T) => ReactNode;
  renderActions: (item: T) => ReactNode;
};

export default function SetSoalPerMapel<T extends SetSoal>({ items, renderMeta, renderActions }: Props<T>) {
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; nama: string; sets: T[] }>();
    for (const item of items) {
      const key = item.pelajaran_id != null ? String(item.pelajaran_id) : "lainnya";
      const group = map.get(key) ?? { key, nama: item.pelajaran_nama || "", sets: [] };
      group.sets.push(item);
      map.set(key, group);
    }
    return Array.from(map.values());
  }, [items]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = groups.find((g) => g.key === activeKey) ?? groups[0];

  const cards = (sets: T[]) => (
    <ul className="student-set-list">
      {sets.map((item, i) => (
        <li key={item.bagian_id} className="student-set">
          <span className="student-set-no">{i + 1}</span>
          <h3 title={item.nama}>{namaSingkat(item)}</h3>
          {renderMeta(item)}
          <div className="student-set-actions">{renderActions(item)}</div>
        </li>
      ))}
    </ul>
  );

  if (groups.length <= 1) {
    return (
      <>
        <p className="student-split-label">{active?.nama ? `Set Soal ${active.nama}` : "Daftar Set Soal"}</p>
        {cards(active?.sets ?? [])}
      </>
    );
  }

  return (
    <div className="student-mapel-layout">
      <nav aria-label="Daftar mapel">
        <p className="student-split-label">Daftar Mapel</p>
        <ul className="student-mapel-list" role="tablist">
          {groups.map((g) => (
            <li key={g.key}>
              <button
                type="button"
                role="tab"
                aria-selected={g.key === active.key}
                className={`student-mapel-tab${g.key === active.key ? " student-mapel-tab-active" : ""}`}
                onClick={() => setActiveKey(g.key)}
              >
                <span>{g.nama || "Lainnya"}</span>
                <span className="student-mapel-count">{g.sets.length} set</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div role="tabpanel">
        <p className="student-split-label">Set Soal {active.nama || "Lainnya"}</p>
        {cards(active.sets)}
      </div>
    </div>
  );
}
