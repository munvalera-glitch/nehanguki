import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function ScanPreviewModal({ originalBlob, documentType, corners, onAccept, onRetry, onCancel }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState("grayscale");
  const [processedUrl, setProcessedUrl] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);

  // Load URLs
  useEffect(() => {
    if (originalBlob) {
      const url = URL.createObjectURL(originalBlob);
      setOriginalUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [originalBlob]);

  // Request processed image whenever mode changes
  useEffect(() => {
    let active = true;
    async function fetchPreview() {
      setLoading(true);
      setError("");
      try {
        const formData = new FormData();
        formData.append("image", originalBlob, "original.jpg");
        formData.append("documentType", documentType);
        formData.append("mode", mode);
        if (corners) {
          formData.append("corners", corners);
        }

        const res = await fetch("/api/document-copy/preview", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const data = await res.json();
        if (active) {
          if (data.success) {
            setProcessedUrl(data.processedImageUrl);
            setMeta({
              correctionApplied: data.correctionApplied,
              confidence: data.confidence,
              fallbackUsed: data.fallbackUsed,
            });
          } else {
            throw new Error(data.error || "Failed to process image");
          }
        }
      } catch (err) {
        if (active) {
          console.error("Preview fetch error:", err);
          setError(err.message || "Network error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchPreview();
    return () => {
      active = false;
    };
  }, [mode, originalBlob, documentType, corners]);

  async function handleAccept() {
    if (!processedUrl) return;
    try {
      setLoading(true);
      const res = await fetch(processedUrl);
      const blob = await res.blob();
      onAccept(blob);
    } catch (err) {
      console.error("Failed to convert preview to blob:", err);
      setError("Failed to export preview");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#111] text-white" style={{ touchAction: "none" }}>
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: "rgba(0,0,0,0.92)" }}>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/10 text-white text-[14px] font-medium active:bg-white/20"
          style={{ minWidth: 80, minHeight: 48 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          {t("preview.cancel")}
        </button>
        <span className="text-[15px] font-semibold">{t("preview.title")}</span>
        <div className="w-[80px]" /> {/* Spacer */}
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 overflow-hidden flex flex-col items-center justify-center bg-[#0d0d0d] p-4 relative">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <span className="text-[14px]">{t("crop.loading") || "Processing..."}</span>
            </div>
          </div>
        )}

        {/* View Toggle */}
        <div className="absolute top-4 z-10 flex bg-white/10 rounded-xl p-0.5 border border-white/5 shadow-md">
          <button
            onClick={() => setShowOriginal(false)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all ${!showOriginal ? "bg-[#4f7cff] text-white" : "text-white/60 hover:text-white"}`}
          >
            {t("preview.processed")}
          </button>
          <button
            onClick={() => setShowOriginal(true)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all ${showOriginal ? "bg-[#4f7cff] text-white" : "text-white/60 hover:text-white"}`}
          >
            {t("preview.original")}
          </button>
        </div>

        {/* Image Frame */}
        <div className="w-full h-full max-h-[calc(100dvh-280px)] flex items-center justify-center relative mt-8">
          {showOriginal ? (
            <img src={originalUrl} alt="Original crop" className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-white/10" />
          ) : (
            processedUrl && (
              <img src={processedUrl} alt="Processed scan" className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-white/10" />
            )
          )}
        </div>

        {/* Info/Warning Banner */}
        {meta && !showOriginal && (
          <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-center">
            {meta.correctionApplied && !meta.fallbackUsed ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-[12px]">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {t("preview.correctionApplied")}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-[12px]">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                {t("preview.fallbackUsed")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls & Mode Selection */}
      <div className="px-4 py-5 bg-[#1a1a1a] border-t border-white/10 space-y-4">
        {/* Mode Select */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">{t("preview.mode")}</label>
          <div className="grid grid-cols-3 gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setMode("grayscale")}
              className={`py-2 px-1 text-[12px] font-medium rounded-lg text-center transition-all ${mode === "grayscale" ? "bg-white/10 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
            >
              {t("preview.grayscale")}
            </button>
            <button
              onClick={() => setMode("black_white_xerox")}
              className={`py-2 px-1 text-[12px] font-medium rounded-lg text-center transition-all ${mode === "black_white_xerox" ? "bg-white/10 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
            >
              {t("preview.xerox")}
            </button>
            <button
              onClick={() => setMode("light_color_scan")}
              className={`py-2 px-1 text-[12px] font-medium rounded-lg text-center transition-all ${mode === "light_color_scan" ? "bg-white/10 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
            >
              {t("preview.color")}
            </button>
          </div>
        </div>

        {error && <p className="text-[#ff6b6b] text-[13px] text-center">{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-1.5 py-3.5 rounded-xl border border-white/15 text-[14px] font-semibold hover:bg-white/5 active:scale-[0.98] transition-all"
            style={{ minHeight: 48 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20a8 8 0 1 0-8-8"/></svg>
            {t("preview.retry")}
          </button>
          <button
            onClick={handleAccept}
            disabled={loading || !processedUrl}
            className="flex-[2] flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-bold text-white active:scale-[0.98] transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #4f7cff 0%, #3d6ae8 100%)",
              boxShadow: "0 4px 15px rgba(79,124,255,0.25)",
              minHeight: 48,
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {t("preview.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
