import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

export default function ImageAdjustmentModal({ imageSrc, onSave, onCancel }) {
    const { t } = useTranslation();
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const imgRef = useRef(null);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    // Reset button removed per user request

    const handleSave = useCallback(async () => {
        if (!imgRef.current) return;
        setSaving(true);
        setError("");

        try {
            const img = imgRef.current;
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");

            // Apply filters via Context2D
            // Warning: ctx.filter is supported in all modern browsers, but can be slow for huge images
            // We use standard percentages
            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
            ctx.drawImage(img, 0, 0);

            canvas.toBlob(blob => {
                if (!blob) {
                    setError("Failed to export image");
                    setSaving(false);
                    return;
                }
                onSave(blob);
            }, "image/jpeg", 0.95);

        } catch (err) {
            console.error(err);
            setError("Error saving image.");
            setSaving(false);
        }
    }, [brightness, contrast, onSave]);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#111]" style={{ touchAction: "none" }}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/10" style={{ background: "rgba(0,0,0,0.92)" }}>
                <button
                    onClick={onCancel}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/10 text-white text-[14px] font-medium active:bg-white/20"
                    style={{ minWidth: 80, minHeight: 48 }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    {t("crop.cancel") || "Cancel"}
                </button>
                <div className="text-[14px] font-semibold text-white">{t("adjust.adjustImage") || "Adjust image"}</div>
                <div className="w-[80px]" /> {/* Spacer to keep title centered */}
            </div>

            {/* Image Preview */}
            <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#0d0d0d] p-4 relative">
                <img 
                    ref={imgRef}
                    src={imageSrc} 
                    alt="Preview" 
                    className="max-w-full max-h-full object-contain"
                    style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
                    crossOrigin="anonymous"
                />
            </div>

            {/* Sliders Area */}
            <div className="px-5 py-6 bg-[#1a1a1a] border-t border-white/10 space-y-6">
                <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-[12px] font-medium text-white/70">
                            <span>{t("adjust.brightness") || "Brightness"}</span>
                            <span>{brightness}%</span>
                        </div>
                        <input 
                            type="range" min="30" max="200" value={brightness} 
                            onChange={e => setBrightness(Number(e.target.value))}
                            className="w-full accent-[#4f7cff] h-1.5 bg-white/20 rounded-lg appearance-none outline-none"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-[12px] font-medium text-white/70">
                            <span>{t("adjust.contrast") || "Contrast"}</span>
                            <span>{contrast}%</span>
                        </div>
                        <input 
                            type="range" min="30" max="250" value={contrast} 
                            onChange={e => setContrast(Number(e.target.value))}
                            className="w-full accent-[#4f7cff] h-1.5 bg-white/20 rounded-lg appearance-none outline-none"
                        />
                    </div>
                </div>

                {error && <p className="text-[#ff6b6b] text-[13px] text-center">{error}</p>}

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-[16px] text-white transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #4f7cff 0%, #3d6ae8 100%)" }}
                >
                    {saving ? (
                        <>
                            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            {t("crop.saving") || "Saving..."}
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            {t("adjust.done") || "Done - use image"}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
