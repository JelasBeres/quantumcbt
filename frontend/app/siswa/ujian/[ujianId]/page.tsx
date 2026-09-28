"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  LayoutGrid,
  Lock,
  LogOut,
  Send,
} from "lucide-react";
import { API_BASE_URL, api } from "@/lib/api";
import Button from "@/components/Button";
import MathContent from "@/components/MathContent";
import TabelBenarSalah from "@/components/TabelBenarSalah";
import { useAppDialog } from "@/components/Dialog";

type StatementAnswer = { pernyataan_id: number; jawaban: boolean };
type Statement = { pernyataan_id: number; teks: string; urutan: number };
type SavedAnswer = number | string | number[] | StatementAnswer[] | null;

type ExamState = {
  mode_latihan?: string | null;
  bagian_aktif: number;
  soal_aktif_ids: number[];
  ujian_siswa_id: number;
  status: "sedang" | "selesai" | "timeout";
  soal_urutan: number[];
  jawaban_tersimpan: Record<string, SavedAnswer>;
  ragu_ragu?: Record<string, boolean>;
  bagian_urutan?: BagianUjian[];
  jumlah_soal: number;
  sisa_waktu_detik: number;
  waktu_selesai?: string | null;
  waktu_mulai?: string | null;
  bagian_terakhir: boolean;
  // Mode drilling: soal_id -> benar/salah untuk soal yang sudah dikonfirmasi.
  hasil_drill?: Record<string, boolean | null>;
};

// Hasil konfirmasi satu soal pada mode drilling (ditampilkan sebagai warna, bukan pop-up).
type DrillFeedback = {
  soal_id: number;
  benar: boolean | null;
  kunci: string[];
  kunci_opsi_ids: number[];
  pernyataan: { pernyataan_id: number; jawaban_benar: boolean }[];
  pembahasan: string;
};

type BagianUjian = {
  bagian_id?: number | null;
  nama: string;
  urutan: number;
  durasi_menit?: number | null;
  pelajaran_id?: number | null;
  soal_ids: number[];
};

type Option = { opsi_id: number; teks: string; posisi: number };
type Question = {
  soal_id: number;
  teks_soal: string;
  tipe: string;
  opsi: Option[];
  label_benar?: string | null;
  label_salah?: string | null;
  pernyataan?: Statement[];
  jawaban_user?: number | number[] | StatementAnswer[] | null;
  jawaban_teks?: string | null;
  is_ragu?: boolean;
  drill_feedback?: DrillFeedback | null;
};

const isEssayType = (tipe: string) => tipe === "esai";
const isIsianType = (tipe: string) => tipe === "isian";
const isOpsiType = (tipe: string) =>
  tipe === "pilihan_ganda" || tipe === "benar_salah" || tipe === "pilihan_lebih_dari_satu";
const isMultiSelectType = (tipe: string) => tipe === "pilihan_lebih_dari_satu";

export default function ExamRoomPage() {
  const params = useParams<{ ujianId: string }>();
  const router = useRouter();
  const ujianId = params.ujianId;
  const [state, setState] = useState<ExamState | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [nomor, setNomor] = useState(1);
  const [feedback, setFeedback] = useState<DrillFeedback | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<number[]>([]);
  const [statementAnswers, setStatementAnswers] = useState<StatementAnswer[]>([]);
  const [essayText, setEssayText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [raguPending, setRaguPending] = useState(false);
  const visibilityLogged = useRef(false);
  const essaySaveTimer = useRef<number | null>(null);
  const pendingEssayRef = useRef<{ soalId: number; text: string } | null>(null);
  const saveEssayAnswerRef = useRef<(soalId: number, text: string) => Promise<void>>(async () => undefined);
  const waktuSelesaiRef = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const advancingRef = useRef(false);
  const soalNavRef = useRef<HTMLDivElement>(null);
  const mapelNavRef = useRef<HTMLDivElement>(null);
  const questionRequestRef = useRef(0);
  const [transitioning, setTransitioning] = useState(false);
  const { showConfirm, dialog } = useAppDialog();

  const submitExam = useCallback(async (automatic = false) => {
    if (!automatic) {
      const confirmed = await showConfirm({
        title: "Kumpulkan Ujian",
        description: "Yakin ingin mengumpulkan ujian? Jawaban tidak dapat diubah lagi.",
        confirmLabel: "Kumpulkan",
        confirmVariant: "danger"
      });
      if (!confirmed) return;
    }
    // Guard in-flight: cegah double-submit dari serverTimer & effect remaining===0.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      // A browser clock or a stale render must never end an exam early.
      // Only the server can confirm that its deadline has actually passed.
      if (automatic) {
        const { data } = await api.get(`/ujian-siswa/${ujianId}/sisa-waktu`);
        if (!Number.isFinite(data.sisa_waktu_detik)) throw new Error("Invalid server timer");
        if (data.sisa_waktu_detik > 0) {
          waktuSelesaiRef.current = performance.now() + data.sisa_waktu_detik * 1000;
          setRemaining(data.sisa_waktu_detik);
          setSubmitting(false);
          submittingRef.current = false;
          return;
        }
      }
      const pending = pendingEssayRef.current;
      if (pending) {
        try {
          await saveEssayAnswerRef.current(pending.soalId, pending.text);
        } catch {
          // Draf yang ditolak server (mis. soal di bagian yang sudah dikunci)
          // tidak boleh memblokir pengumpulan ujian.
          pendingEssayRef.current = null;
        }
      }
      await api.patch(`/ujian-siswa/${ujianId}/submit`);
      router.replace(`/siswa/hasil/${ujianId}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Ujian gagal dikumpulkan.");
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [router, showConfirm, ujianId]);

  const loadQuestion = useCallback(async (target: number) => {
    const requestId = ++questionRequestRef.current;
    setError("");
    setFeedback(null);
    setLoading(true);
    setTransitioning(true);
    try {
      const response = await api.get(`/ujian-siswa/${ujianId}/soal/${target}`);
      if (requestId !== questionRequestRef.current) return;
      setQuestion(response.data);
      setSelected(typeof response.data.jawaban_user === "number" ? response.data.jawaban_user : null);
       setSelectedMulti(Array.isArray(response.data.jawaban_user) && response.data.jawaban_user.every((item: unknown) => typeof item === "number") ? response.data.jawaban_user : []);
       setStatementAnswers(Array.isArray(response.data.jawaban_user) && response.data.jawaban_user.every((item: unknown) => typeof item === "object") ? response.data.jawaban_user : []);
      // Drilling: soal yang sudah dikonfirmasi terkunci; tampilkan warnanya lagi.
      const drill = (response.data.drill_feedback ?? null) as DrillFeedback | null;
      setFeedback(drill);
      const draftKey = `cbt_draft_${ujianId}_${response.data.soal_id}`;
      if (drill) window.localStorage.removeItem(draftKey);
      const draft = drill ? null : window.localStorage.getItem(draftKey);
      const loadedEssay = draft ?? response.data.jawaban_teks ?? "";
      setEssayText(loadedEssay);
      if (draft !== null) {
        pendingEssayRef.current = { soalId: response.data.soal_id, text: draft };
      }
      setSaved(response.data.jawaban_user != null || !!response.data.jawaban_teks);
      setNomor(target);
    } catch (err: any) {
      if (requestId !== questionRequestRef.current) return;
      const message = err.response?.data?.detail || "Soal gagal dimuat.";
      setError(message);
      if (message.toLowerCase().includes("expired")) await submitExam(true);
    } finally {
      if (requestId !== questionRequestRef.current) return;
      setLoading(false);
      window.setTimeout(() => setTransitioning(false), 320);
    }
  }, [submitExam, ujianId]);

  // Lanjut ke bagian/mapel berikutnya (dipanggil manual atau otomatis saat waktu bagian habis).
  // Tidak bisa kembali ke bagian sebelumnya setelah pindah.
  const advanceSection = useCallback(async (currentBagianAktif: number) => {
    // Timer server & efek remaining===0 bisa memicu bersamaan; cukup satu request.
    if (advancingRef.current || submittingRef.current) return;
    advancingRef.current = true;
    try {
      // Simpan dulu esai/isian yang masih dalam jeda autosave: setelah pindah
      // bagian, soal bagian lama terkunci dan simpanannya ditolak server.
      if (essaySaveTimer.current) {
        window.clearTimeout(essaySaveTimer.current);
        essaySaveTimer.current = null;
      }
      const pending = pendingEssayRef.current;
      if (pending) {
        try {
          await saveEssayAnswerRef.current(pending.soalId, pending.text);
        } catch {
          pendingEssayRef.current = null;
        }
      }
      const { data } = await api.post<ExamState>(`/ujian-siswa/${ujianId}/lanjut-bagian`, null, {
        params: { bagian_aktif: currentBagianAktif },
      });
      setState(data);
      waktuSelesaiRef.current = performance.now() + data.sisa_waktu_detik * 1000;
      setRemaining(data.sisa_waktu_detik);
      const firstUnanswered = data.soal_urutan.findIndex((id) => {
        if (!data.soal_aktif_ids.includes(id)) return false;
        const v = data.jawaban_tersimpan[String(id)];
        return v == null || (Array.isArray(v) && v.length === 0);
      });
      await loadQuestion(firstUnanswered >= 0 ? firstUnanswered + 1 : data.soal_urutan.indexOf(data.soal_aktif_ids[0]) + 1);
    } catch (err: any) {
      const message: string = err.response?.data?.detail || "Gagal lanjut ke bagian berikutnya.";
      if (message.toLowerCase().includes("expired")) {
        // Waktu keseluruhan ujian habis: tidak ada bagian berikutnya, kumpulkan.
        advancingRef.current = false;
        await submitExam(true);
        return;
      }
      setError(message);
    } finally {
      advancingRef.current = false;
    }
  }, [loadQuestion, submitExam, ujianId]);

  useEffect(() => {
    api.get(`/ujian-siswa/${ujianId}/state`)
      .then((response) => {
        const examState: ExamState = response.data;
        if (examState.status === "selesai") {
          router.replace(`/siswa/hasil/${ujianId}`);
          return;
        }
        setState(examState);
        // Anchor the server's remaining duration to a monotonic clock instead
        // of parsing a timestamp in the browser's timezone/wall clock.
        waktuSelesaiRef.current = performance.now() + examState.sisa_waktu_detik * 1000;
        setRemaining(examState.sisa_waktu_detik);
          const firstUnanswered = examState.soal_urutan.findIndex((id) => {
            if (!examState.soal_aktif_ids.includes(id)) return false;
          const v = examState.jawaban_tersimpan[String(id)];
          return v == null || (Array.isArray(v) && v.length === 0);
        });
          loadQuestion(firstUnanswered >= 0 ? firstUnanswered + 1 : examState.soal_urutan.indexOf(examState.soal_aktif_ids[0]) + 1);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || "Ujian tidak dapat dimuat.");
        setLoading(false);
      });
  }, [loadQuestion, router, ujianId]);

  useEffect(() => {
    if (!state) return;
    // Scroll nomor soal aktif agar selalu terlihat (auto-center horizontal).
    const container = soalNavRef.current;
    const activeBtn = container?.querySelector<HTMLButtonElement>('[aria-current="true"]');
    if (container && activeBtn) {
      container.scrollTo({
        left: activeBtn.offsetLeft - container.clientWidth / 2 + activeBtn.clientWidth / 2,
        behavior: "smooth",
      });
    }
  }, [nomor, state]);

  useEffect(() => {
    // Baris mapel: geser mapel aktif ke tengah (penting di HP bila mapel banyak).
    const container = mapelNavRef.current;
    const activeChip = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (container && activeChip) {
      container.scrollTo({
        left: activeChip.offsetLeft - container.clientWidth / 2 + activeChip.clientWidth / 2,
        behavior: "smooth",
      });
    }
  }, [state?.bagian_aktif]);

  useEffect(() => {
    if (!state || state.mode_latihan === "drill") return;
    // Timer lokal hanya TURUN dari waktu_selesai server; tidak pernah naik.
    const localTimer = window.setInterval(() => {
      if (waktuSelesaiRef.current != null) {
        setRemaining(Math.max(0, Math.ceil((waktuSelesaiRef.current - performance.now()) / 1000)));
      } else {
        setRemaining((value) => Math.max(0, value - 1));
      }
    }, 1000);
    const serverTimer = window.setInterval(async () => {
      try {
        const response = await api.get(`/ujian-siswa/${ujianId}/sisa-waktu`);
        const sisa = response.data.sisa_waktu_detik as number;
        const bagianTerakhir = response.data.bagian_terakhir as boolean;
        // server otoritatif, tapi tetap jangan pernah menaikkan melebihi nilai lokal
        if (sisa <= 0) {
          if (bagianTerakhir) await submitExam(true);
          else await advanceSection(state.bagian_aktif);
          return;
        }
        waktuSelesaiRef.current = performance.now() + sisa * 1000;
        setRemaining(Math.max(0, sisa));
        setState((prev) => (prev && prev.bagian_terakhir !== bagianTerakhir ? { ...prev, bagian_terakhir: bagianTerakhir } : prev));
      } catch {}
    }, 10000);
    return () => {
      window.clearInterval(localTimer);
      window.clearInterval(serverTimer);
    };
  }, [state, ujianId, submitExam, advanceSection]);

  useEffect(() => {
    if (!state || state.mode_latihan === "drill" || remaining !== 0) return;
    if (state.bagian_terakhir) void submitExam(true);
    else void advanceSection(state.bagian_aktif);
    // Failed requests retry on the server timer, not every submitting toggle.
  }, [remaining, state, submitExam, advanceSection]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && !visibilityLogged.current) {
        visibilityLogged.current = true;
        api.post(`/ujian-siswa/${ujianId}/log-kecurangan`, { tipe: "tab_blur", deskripsi: "Siswa meninggalkan tab ujian" }).catch(() => undefined);
      } else if (!document.hidden) {
        visibilityLogged.current = false;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [ujianId]);

  const flushPendingEssay = useCallback(async () => {
    if (essaySaveTimer.current) {
      window.clearTimeout(essaySaveTimer.current);
      essaySaveTimer.current = null;
    }
    const pending = pendingEssayRef.current;
    if (pending) {
      await saveEssayAnswerRef.current(pending.soalId, pending.text);
    }
  }, [question]);

  const goToQuestion = useCallback(async (target: number) => {
    await flushPendingEssay();
    await loadQuestion(target);
  }, [flushPendingEssay, loadQuestion]);

  const showSaveError = useCallback((err: any, fallback: string) => {
    const message: string = err.response?.data?.detail || fallback;
    setError(message);
    // Server menolak karena waktu bagian sudah habis (jam browser bisa sedikit
    // berbeda): nolkan timer agar efek remaining===0 langsung lanjut/kumpulkan.
    if (err.response?.status === 409 && message.startsWith("Waktu bagian")) {
      waktuSelesaiRef.current = performance.now();
      setRemaining(0);
    }
  }, []);

  const selectAnswer = async (opsiId: number) => {
    setFeedback(null);
    if (!question) return;
    setSelected(opsiId);
    setSaved(false);
    setSaving(true);
    try {
      await api.post(`/ujian-siswa/${ujianId}/jawab`, { soal_id: question.soal_id, opsi_jawaban_id: opsiId });
      setSaved(true);
      setState((current) => current ? {
        ...current,
        jawaban_tersimpan: { ...current.jawaban_tersimpan, [String(question.soal_id)]: opsiId }
      } : current);
    } catch (err: any) {
      showSaveError(err, "Jawaban gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const toggleMultiAnswer = async (opsiId: number) => {
    setFeedback(null);
    if (!question) return;
    const next = selectedMulti.includes(opsiId)
      ? selectedMulti.filter((id) => id !== opsiId)
      : [...selectedMulti, opsiId];
    setSelectedMulti(next);
    setSaved(false);
    setSaving(true);
    try {
      await api.post(`/ujian-siswa/${ujianId}/jawab`, { soal_id: question.soal_id, opsi_jawaban_ids: next });
      setSaved(true);
      setState((current) => current ? {
        ...current,
        jawaban_tersimpan: { ...current.jawaban_tersimpan, [String(question.soal_id)]: next }
      } : current);
    } catch (err: any) {
      showSaveError(err, "Jawaban gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const selectStatementAnswer = async (pernyataanId: number, jawaban: boolean) => {
    setFeedback(null);
    if (!question) return;
    const next = [...statementAnswers.filter((item) => item.pernyataan_id !== pernyataanId), { pernyataan_id: pernyataanId, jawaban }]
      .sort((a, b) => a.pernyataan_id - b.pernyataan_id);
    setStatementAnswers(next);
    setSaved(false);
    setSaving(true);
    try {
      await api.post(`/ujian-siswa/${ujianId}/jawab`, { soal_id: question.soal_id, jawaban_pernyataan: next });
      setSaved(true);
      setState((current) => current ? {
        ...current,
        jawaban_tersimpan: { ...current.jawaban_tersimpan, [String(question.soal_id)]: next }
      } : current);
    } catch (err: any) {
      showSaveError(err, "Jawaban gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const saveEssayAnswer = useCallback(async (soalId: number, text: string) => {
    setSaving(true);
    setSaved(false);
    try {
      await api.post(`/ujian-siswa/${ujianId}/jawab`, { soal_id: soalId, jawaban_teks: text });
      if (pendingEssayRef.current?.soalId === soalId && pendingEssayRef.current.text === text) {
        pendingEssayRef.current = null;
        window.localStorage.removeItem(`cbt_draft_${ujianId}_${soalId}`);
      }
      setSaved(true);
      setState((current) => current ? {
        ...current,
        jawaban_tersimpan: { ...current.jawaban_tersimpan, [String(soalId)]: text }
      } : current);
    } catch (err: any) {
      showSaveError(err, "Jawaban gagal disimpan.");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [showSaveError, ujianId]);

  saveEssayAnswerRef.current = saveEssayAnswer;

  const toggleRagu = async (soalId: number) => {
    if (!question) return;
    const next = !question.is_ragu;
    setRaguPending(true);
    try {
      await api.patch(`/ujian-siswa/${ujianId}/ragu`, { soal_id: soalId, is_ragu: next });
      setQuestion((q) => q ? { ...q, is_ragu: next } : q);
      setState((current) => current ? {
        ...current,
        ragu_ragu: { ...(current.ragu_ragu ?? {}), [String(soalId)]: next }
      } : current);
    } catch (err: any) {
      showSaveError(err, "Tanda ragu-ragu gagal disimpan.");
    } finally {
      setRaguPending(false);
    }
  };

  const handleEssayChange = (value: string) => {
    setFeedback(null);
    setEssayText(value);
    setSaved(false);
    if (!question) return;
    pendingEssayRef.current = { soalId: question.soal_id, text: value };
    window.localStorage.setItem(`cbt_draft_${ujianId}_${question.soal_id}`, value);
    if (essaySaveTimer.current) window.clearTimeout(essaySaveTimer.current);
    essaySaveTimer.current = window.setTimeout(() => {
      essaySaveTimer.current = null;
      saveEssayAnswer(question.soal_id, value).catch(() => undefined);
    }, 1000);
  };

  useEffect(() => {
    const onPageHide = () => {
      const pending = pendingEssayRef.current;
      if (!pending) return;
      const token = window.localStorage.getItem("cbt_access_token");
      void fetch(`${API_BASE_URL}/ujian-siswa/${ujianId}/jawab`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ soal_id: pending.soalId, jawaban_teks: pending.text }),
        keepalive: true
      });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      if (essaySaveTimer.current) window.clearTimeout(essaySaveTimer.current);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [ujianId]);

  const answered = state ? Object.values(state.jawaban_tersimpan).filter((value) => {
    if (value == null || value === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }).length : 0;
  const bagianAktif = state?.bagian_urutan?.find((b) => b.soal_ids.includes(question?.soal_id ?? -1));
  const minutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const seconds = (remaining % 60).toString().padStart(2, "0");
  const totalSoal = state?.jumlah_soal || 0;
  const isLastQuestion = nomor >= totalSoal;
  const sectionIds = state?.soal_aktif_ids ?? [];
  const bagianUrutan = state?.bagian_urutan ?? [];
  // Nomor soal dimulai lagi dari 1 di setiap bagian (Matematika 1: 1-10, Matematika 2: 1-10).
  const nomorTampil = new Map<number, number>();
  if (bagianUrutan.length > 0) {
    bagianUrutan.forEach((b) => b.soal_ids.forEach((id, i) => nomorTampil.set(id, i + 1)));
  } else {
    state?.soal_urutan.forEach((id, i) => nomorTampil.set(id, i + 1));
  }
  const nomorSoal = (soalId: number | undefined, fallback: number) =>
    (soalId != null ? nomorTampil.get(soalId) : undefined) ?? fallback;
  // Strip navigasi hanya menampilkan soal bagian yang sedang dikerjakan, karena
  // nomornya berulang antarbagian dan bagian sebelumnya sudah terkunci.
  const visibleQuestionIds = bagianUrutan.length > 1
    ? new Set(bagianAktif?.soal_ids ?? sectionIds)
    : null;
  // Navigasi dua tingkat: baris mapel (tingkat 1) di atas strip nomor soal
  // (tingkat 2). Mapel hanya penanda posisi, tidak bisa diklik, karena
  // perpindahan bagian tetap satu arah lewat tombol Lanjut Bagian.
  const showMapelNav = bagianUrutan.length > 1;
  const isAnsweredId = (soalId: number) => {
    const v = state?.jawaban_tersimpan[String(soalId)];
    return v != null && v !== "" && (!Array.isArray(v) || v.length > 0);
  };
  const isLastQuestionInSection = sectionIds.length > 0 && sectionIds[sectionIds.length - 1] === (state?.soal_urutan[nomor - 1] ?? -1);
  const canAdvanceSection = isLastQuestionInSection && !isLastQuestion && state?.bagian_terakhir === false;
  const progress = totalSoal > 0 ? (answered / totalSoal) * 100 : 0;

  const soalStateCls = (soalId: number, index: number) => {
    const savedAnswer = state?.jawaban_tersimpan[String(soalId)];
    const isAnswered = savedAnswer != null && savedAnswer !== "" && (!Array.isArray(savedAnswer) || savedAnswer.length > 0);
    const isRagu = state?.ragu_ragu?.[String(soalId)];
    const isCurrent = nomor === index + 1;
    // Drilling: soal yang sudah dikonfirmasi hijau (benar) / merah (salah),
    // tetap berwarna walau sedang dibuka (ditandai cincin).
    const hasilDrill = state?.hasil_drill?.[String(soalId)];
    if (hasilDrill === true || hasilDrill === false) {
      const warna = hasilDrill
        ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
        : "border-red-600 bg-red-600 text-white hover:bg-red-700";
      return isCurrent ? `-translate-y-1 scale-110 ring-2 ring-brand-primary ring-offset-2 shadow-card-hover ${warna}` : warna;
    }
    // Skema warna status (konsisten dengan halaman hasil):
    // biru = terjawab, kuning = ragu, abu-abu = belum dijawab.
    let cls = "border-card-border bg-card-bg text-text-muted hover:border-brand-primary/60 hover:bg-brand-primary/5";
    if (isCurrent) {
      cls = "-translate-y-1 scale-110 border-brand-primary bg-brand-primary text-heading-light shadow-card-hover";
    } else if (isAnswered) {
      cls = "border-blue-600 bg-blue-600 text-white hover:bg-blue-800";
    }
    if (isRagu && !isCurrent) cls = "border-amber-500 bg-amber-500 text-white hover:bg-amber-700";
    return cls;
  };

  // Hasil konfirmasi drilling untuk soal yang sedang dibuka (jawaban terkunci & berwarna).
  const drillAktif = feedback && question && feedback.soal_id === question.soal_id ? feedback : null;
  const warnaIsian = !drillAktif || drillAktif.benar === null
    ? ""
    : drillAktif.benar
      ? "border-green-600 bg-green-50 ring-2 ring-green-600/20"
      : "border-red-600 bg-red-50 ring-2 ring-red-600/20";

  return (
    <main className="flex min-h-screen flex-col bg-transparent text-body-dark">
      {/* ============ TOP HEADER ============ */}
      <header className="sticky top-0 z-30 border-b border-card-border bg-brand-primary">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          {/* Kiri: keluar */}
          <div className="flex shrink-0 items-center sm:w-1/3">
            <button
              type="button"
              onClick={() => router.push("/siswa/dashboard")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-body-light transition-all duration-200 hover:scale-105 hover:bg-white/15 hover:text-heading-light active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Keluar dari ujian"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          {/* Tengah: logo Quantum (ikon saja) + motto */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-sm">
              <Image src="/quantum-research-logo.png" alt="Quantum Research" width={28} height={28} className="h-7 w-7 object-contain" priority />
            </span>
            <span className="truncate text-xs font-semibold italic tracking-wide text-heading-light sm:text-sm">Tekun, Logis, Kreatif</span>
          </div>

          {/* Kanan: timer */}
          <div className="flex shrink-0 items-center justify-end gap-2 sm:w-1/3">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 tabular-nums transition-colors duration-300 sm:gap-2 sm:px-4 sm:py-2 ${
                state?.mode_latihan !== "drill" && remaining <= 300
                  ? "animate-timer-pulse border-cta-alt bg-cta text-heading-light"
                  : "border-white/20 bg-white/10 text-heading-light"
              }`}
            >
              <Clock3 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="whitespace-nowrap text-xs font-bold sm:text-sm md:text-base">
                {state?.mode_latihan === "drill" ? (
                  <>
                    <span className="sm:hidden">Bebas</span>
                    <span className="hidden sm:inline">Tanpa timer</span>
                  </>
                ) : (
                  `${minutes}:${seconds}`
                )}
              </span>
            </div>
          </div>
        </div>
        {/* Progress pengerjaan */}
        <div className="h-0.5 w-full bg-white/10">
          <div
            className="h-full bg-cta transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* ============ QUESTION NAVIGATION STRIP ============ */}
      <div className="sticky top-[4.25rem] z-20 border-b border-card-border bg-card-bg">
        {showMapelNav && (
          <div className="border-b border-card-border bg-neutral/60">
            <div
              ref={mapelNavRef}
              aria-label="Urutan mapel"
              className="mx-auto flex w-full max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
            >
              {bagianUrutan.map((b, i) => {
                const aktifIdx = state?.bagian_aktif ?? 0;
                const status = i < aktifIdx ? "selesai" : i === aktifIdx ? "aktif" : "terkunci";
                const terjawab = b.soal_ids.filter(isAnsweredId).length;
                return (
                  <div
                    key={b.bagian_id ?? i}
                    aria-current={status === "aktif" ? "step" : undefined}
                    title={status === "selesai" ? `${b.nama} (selesai)` : status === "terkunci" ? `${b.nama} (belum dibuka)` : b.nama}
                    className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-200 ${
                      status === "aktif"
                        ? "border-brand-primary bg-brand-primary text-heading-light shadow-card"
                        : status === "selesai"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-card-border bg-card-bg text-text-muted"
                    }`}
                  >
                    {status === "selesai" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : status === "terkunci" ? (
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">{i + 1}</span>
                    )}
                    <span className="whitespace-nowrap">{b.nama}</span>
                    {status !== "terkunci" && (
                      <span className={`tabular-nums ${status === "aktif" ? "text-heading-light/80" : "opacity-70"}`}>
                        {terjawab}/{b.soal_ids.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <LayoutGrid className="hidden h-4 w-4 shrink-0 text-text-muted sm:block" aria-hidden="true" />
          <div
            ref={soalNavRef}
            className="relative flex flex-1 items-center gap-1.5 overflow-x-auto px-2 py-2 before:ml-auto before:content-[''] after:mr-auto after:content-[''] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {state?.soal_urutan.map((soalId, index) => {
              if (visibleQuestionIds && !visibleQuestionIds.has(soalId)) return null;
              return (
                <button
                  key={soalId}
                  onClick={() => goToQuestion(index + 1)}
                  disabled={loading || !sectionIds.includes(soalId)}
                  aria-label={`Soal nomor ${nomorSoal(soalId, index + 1)}`}
                  aria-current={nomor === index + 1 ? "true" : undefined}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-60 ${soalStateCls(soalId, index)}`}
                >
                  {nomorSoal(soalId, index + 1)}
                </button>
              );
            })}
          </div>
          <div className="ml-auto hidden shrink-0 items-center gap-3 text-xs text-text-muted md:flex">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Terjawab {answered}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-primary" /> Sedang</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Ragu-ragu</span>
            {state?.mode_latihan === "drill" && <>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> Benar</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Salah</span>
            </>}
          </div>
        </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-6 sm:px-6">
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
          {/* ===== KIRI: PERTANYAAN ===== */}
          <section className="min-w-0 rounded-card border border-card-border bg-card-bg p-5 shadow-card sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-heading-dark sm:text-lg">
                Soal {nomorSoal(question?.soal_id ?? state?.soal_urutan[nomor - 1], nomor)}
                {bagianAktif ? <span className="ml-2 rounded-md bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">{bagianAktif.nama}</span> : null}
              </h2>
              {question?.is_ragu && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                  <Flag className="h-3.5 w-3.5" /> Ragu-ragu
                </span>
              )}
            </div>

            {loading || !question ? (
              <div className="space-y-4 py-10">
                <div className="h-4 w-3/4 animate-pulse rounded bg-neutral" />
                <div className="h-4 w-full animate-pulse rounded bg-neutral" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-neutral" />
              </div>
            ) : (
              <div key={question.soal_id} className="animate-question-in mt-4 text-[17px] leading-[1.7] text-body-dark sm:text-lg">
                <MathContent className="prose max-w-none text-body-dark prose-p:text-body-dark prose-li:text-body-dark prose-strong:text-heading-dark" html={question.teks_soal} />
              </div>
            )}
          </section>

          {/* ===== KANAN: JAWABAN =====
              Desktop: kolom jawaban menempel (sticky) di bawah header + strip nomor,
              jadi saat soal panjang di-scroll hanya kolom soal yang bergerak. */}
          <section className={`min-w-0 rounded-card border border-card-border bg-card-bg p-4 shadow-card sm:p-5 lg:sticky lg:overflow-y-auto ${showMapelNav ? "lg:top-[13.5rem] lg:max-h-[calc(100dvh-13.5rem-6rem)]" : "lg:top-[10.5rem] lg:max-h-[calc(100dvh-10.5rem-6rem)]"}`}>
            {loading || !question ? (
              <div className="space-y-3 py-10">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-11 animate-pulse rounded-xl bg-neutral" />
                ))}
              </div>
            ) : isEssayType(question.tipe) ? (
              <div key={question.soal_id} className="animate-question-in">
                <p className="mb-3 text-sm font-semibold text-body-dark">Jawaban Esai</p>
                <textarea
                  value={essayText}
                  onChange={(e) => handleEssayChange(e.target.value)}
                  disabled={submitting || !!drillAktif}
                  placeholder="Tulis jawaban kamu di sini..."
                  rows={10}
                  className={`w-full rounded-input border border-card-border bg-card-bg p-4 text-base leading-relaxed text-body-dark placeholder:text-text-muted outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed ${drillAktif ? "" : "disabled:opacity-60"} ${warnaIsian}`}
                />
              </div>
            ) : isIsianType(question.tipe) ? (
              <div key={question.soal_id} className="animate-question-in">
                <p className="mb-3 text-sm font-semibold text-body-dark">Jawaban Singkat</p>
                <input
                  type="text"
                  value={essayText}
                  onChange={(e) => handleEssayChange(e.target.value)}
                  disabled={submitting || !!drillAktif}
                  placeholder="Tulis jawaban singkat kamu di sini..."
                  className={`w-full rounded-input border border-card-border bg-card-bg p-4 text-base text-body-dark placeholder:text-text-muted outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed ${drillAktif ? "" : "disabled:opacity-60"} ${warnaIsian}`}
                />
              </div>
            ) : question.tipe === "benar_salah" && question.pernyataan && question.pernyataan.length > 0 ? (
              <TabelBenarSalah
                key={question.soal_id}
                pernyataan={question.pernyataan}
                jawaban={statementAnswers}
                labelBenar={question.label_benar}
                labelSalah={question.label_salah}
                disabled={saving || submitting}
                onPilih={selectStatementAnswer}
                kunci={drillAktif ? Object.fromEntries(drillAktif.pernyataan.map((row) => [row.pernyataan_id, row.jawaban_benar])) : null}
              />
            ) : isOpsiType(question.tipe) ? (
              <div key={question.soal_id} className="animate-question-in space-y-2">
                {question.opsi.map((option, index) => {
                  const isSelected = isMultiSelectType(question.tipe)
                    ? selectedMulti.includes(option.opsi_id)
                    : selected === option.opsi_id;
                  // Drilling setelah konfirmasi: kunci hijau, pilihan salah merah.
                  const isKunci = !!drillAktif && drillAktif.kunci_opsi_ids.includes(option.opsi_id);
                  const warnaBaris = drillAktif
                    ? isKunci
                      ? "border-green-600 bg-green-50 shadow-card"
                      : isSelected
                        ? "border-red-600 bg-red-50 shadow-card"
                        : "border-card-border bg-card-bg"
                    : isSelected
                      ? "border-brand-primary bg-brand-primary/5 shadow-card"
                      : "border-card-border bg-card-bg hover:border-brand-primary hover:bg-brand-primary/5";
                  const warnaHuruf = drillAktif
                    ? isKunci
                      ? "border-green-600 bg-green-600 text-white"
                      : isSelected
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-card-border bg-neutral text-body-dark"
                    : isSelected
                      ? "border-brand-primary bg-brand-primary text-heading-light"
                      : "border-card-border bg-neutral text-body-dark group-hover:border-brand-primary";
                  return (
                    <button
                      key={option.opsi_id}
                      onClick={() => isMultiSelectType(question.tipe) ? toggleMultiAnswer(option.opsi_id) : selectAnswer(option.opsi_id)}
                      disabled={saving || submitting || !!drillAktif}
                      style={{ animationDelay: `${index * 45}ms` }}
                      className={`group animate-option-in flex w-full items-center gap-3 rounded-input border px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:active:scale-100 ${drillAktif ? "" : "disabled:opacity-60"} ${warnaBaris}`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition ${warnaHuruf}`}
                      >
                        {isMultiSelectType(question.tipe) ? (isSelected ? "✓" : "") : String.fromCharCode(65 + index)}
                      </span>
                      <MathContent className="prose prose-sm max-w-none flex-1 text-body-dark prose-p:my-0 prose-p:text-body-dark prose-li:text-body-dark" html={option.teks} />
                      {drillAktif && isKunci && <span className="shrink-0 text-xs font-semibold text-green-700">{isSelected ? "Jawabanmu benar" : "Jawaban benar"}</span>}
                      {drillAktif && !isKunci && isSelected && <span className="shrink-0 text-xs font-semibold text-red-700">Jawabanmu</span>}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {state?.mode_latihan === "drill" && question && <div className="mt-4 space-y-3">
              {!drillAktif && <Button disabled={saving || submitting || confirming} onClick={async () => {
                setConfirming(true); setError("");
                try {
                  await flushPendingEssay();
                  const { data } = await api.post<DrillFeedback>(`/ujian-siswa/${ujianId}/konfirmasi-drill/${question.soal_id}`);
                  setFeedback(data);
                  setState((current) => current ? {
                    ...current,
                    hasil_drill: { ...(current.hasil_drill ?? {}), [String(question.soal_id)]: data.benar }
                  } : current);
                }
                catch (err: any) { setError(err.response?.data?.detail || "Konfirmasi gagal"); }
                finally { setConfirming(false); }
              }}>Konfirmasi Jawaban</Button>}
              {/* Hasil ditunjukkan lewat warna opsi & nomor soal (tanpa pop-up). Soal
                  tanpa opsi (isian/esai) menampilkan kuncinya sebagai teks. */}
              {drillAktif && (isEssayType(question.tipe) || isIsianType(question.tipe)) && (
                <div className={`rounded-input border p-3.5 text-sm ${drillAktif.benar === null ? "border-card-border bg-neutral" : drillAktif.benar ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Kunci jawaban</p>
                  {drillAktif.kunci.map((k, i) => <MathContent key={i} className="prose prose-sm max-w-none" html={k} />)}
                </div>
              )}
              {drillAktif && drillAktif.pembahasan && (
                <div className="rounded-input border border-card-border bg-neutral p-3.5">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">Pembahasan</p>
                  <MathContent className="prose prose-sm max-w-none" html={drillAktif.pembahasan} />
                </div>
              )}
            </div>}
            <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
              {saving ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-card-border border-t-brand-primary" />
                  Menyimpan jawaban...
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Jawaban tersimpan
                </>
              ) : question && (isEssayType(question.tipe) || isIsianType(question.tipe)) ? (
                "Jawaban tersimpan otomatis saat kamu berhenti mengetik"
              ) : question && question.tipe === "benar_salah" && question.pernyataan?.length ? (
                "Pilih jawaban untuk setiap pernyataan"
              ) : question && isMultiSelectType(question.tipe) ? (
                "Pilih satu atau lebih jawaban yang benar"
              ) : (
                "Pilih salah satu jawaban"
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ============ BOTTOM NAVIGATION ============ */}
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-card-border bg-card-bg pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex w-full max-w-md items-center justify-center gap-2 px-3 py-3">
          <div className="w-28 sm:w-32">
            <Button
              variant="outline"
              disabled={nomor <= 1 || loading || submitting || !sectionIds.includes(state?.soal_urutan[nomor - 2] ?? -1)}
              onClick={() => goToQuestion(nomor - 1)}
              className="w-full transition-all duration-200 active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Kembali</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </div>

          <Button
            variant={question?.is_ragu ? "secondary" : "outline"}
            disabled={submitting || saving || raguPending}
            onClick={() => question && toggleRagu(question.soal_id)}
            className={`min-w-28 gap-2 rounded-full transition-all duration-200 active:scale-95 ${
              question?.is_ragu
                ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-700"
                : ""
            }`}
          >
            <Flag
              className={`h-4 w-4 ${question?.is_ragu ? "animate-timer-pulse" : ""}`}
              aria-hidden="true"
            />
            {raguPending ? "Menyimpan..." : question?.is_ragu ? "Sudah Ditandai" : "Ragu-ragu"}
          </Button>

          <div className="flex w-28 justify-end sm:w-32">
            {canAdvanceSection ? (
              <Button
                disabled={loading || submitting}
                onClick={async () => {
                  const confirmed = await showConfirm({
                    title: "Lanjut ke Bagian Berikutnya",
                    description: "Setelah lanjut, kamu tidak bisa kembali ke mapel ini lagi. Yakin ingin lanjut?",
                    confirmLabel: "Lanjut",
                  });
                  if (confirmed && state) await advanceSection(state.bagian_aktif);
                }}
                className="w-full transition-all duration-200 active:scale-95"
              >
                <span className="hidden sm:inline">Lanjut Bagian</span>
                <span className="sm:hidden">Lanjut</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : !isLastQuestion ? (
              <Button
                disabled={loading || submitting}
                onClick={() => goToQuestion(nomor + 1)}
                className="w-full transition-all duration-200 active:scale-95"
              >
                <span className="hidden sm:inline">Berikutnya</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={submitting}
                onClick={async () => { await flushPendingEssay(); submitExam(false); }}
                className="w-full transition-all duration-200 active:scale-95"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Mengumpulkan..." : "Kumpulkan"}
              </Button>
            )}
          </div>
        </div>
      </footer>
      {dialog}
    </main>
  );
}
