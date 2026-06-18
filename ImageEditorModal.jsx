import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import { useTranslation } from "react-i18next";
import "react-image-crop/dist/ReactCrop.css";

/* ── Override react-image-crop styles ──────────────────────────────────────── */
const CROP_STYLES = `
  /* Outside mask — dark overlay */
  .ReactCrop__crop-mask rect {
    fill: rgba(0, 0, 0, 0.62) !important;
  }
  /* Inside crop area — fully transparent (no tint) */
  .ReactCrop__crop-selection {
    background: transparent !important;
    border: 2px solid rgba(255, 255, 255, 0.90) !important;
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.62) !important;
  }
  /* Rule-of-thirds grid lines — subtle white */
  .ReactCrop__rule-of-thirds-hz::before,
  .ReactCrop__rule-of-thirds-hz::after,
  .ReactCrop__rule-of-thirds-vt::before,
  .ReactCrop__rule-of-thirds-vt::after {
    background-color: rgba(255,255,255,0.25) !important;
  }
  /* Corner & edge handles — white squares, more visible */
  .ReactCrop__drag-handle::after {
    background-color: #fff !important;
    border: 2px solid rgba(0,0,0,0.35) !important;
    width: 14px !important;
    height: 14px !important;
    border-radius: 3px !important;
  }
`;


// ── Helpers ───────────────────────────────────────────────────────────────────

/** Load an <img> from a data-URL and resolve when ready */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/** Rotate imageSrc 90° CW and return new data-URL */
async function rotateSrc(src) {
    const img    = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width  = img.height;
    canvas.height = img.width;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return canvas.toDataURL("image/jpeg", 0.95);
}

/** Extract crop from imgEl (no rotation needed – already baked in) */
function extractCrop(imgEl, pixelCrop) {
    const scaleX = imgEl.naturalWidth  / imgEl.width;
    const scaleY = imgEl.naturalHeight / imgEl.height;

    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(pixelCrop.width  * scaleX);
    canvas.height = Math.round(pixelCrop.height * scaleY);
    if (canvas.width === 0 || canvas.height === 0) return Promise.reject(new Error("Empty crop"));

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
        imgEl,
        pixelCrop.x * scaleX, pixelCrop.y * scaleY,
        canvas.width,          canvas.height,
        0, 0,                  canvas.width, canvas.height,
    );

    return new Promise((resolve, reject) =>
        canvas.toBlob(
            b => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/jpeg", 0.95,
        )
    );
}

/** Make a sensible initial crop for the loaded image */
function makeInitialCrop(width, height, aspect) {
    if (aspect) {
        return centerCrop(
            makeAspectCrop({ unit: "%", width: 88 }, aspect, width, height),
            width, height,
        );
    }
    return { unit: "%", x: 5, y: 5, width: 90, height: 90 };
}

import FourCornerSelector from "./FourCornerSelector";

// ── ImageEditorModal ──────────────────────────────────────────────────────────
/**
 * Props:
 *   file        – File | Blob
 *   docType     – string (if provided, enables 4-corner mode)
 *   aspectRatio – number (initial guide aspect) | null (free crop)
 *   helperText  – string
 *   onSave(blob | {blob, corners, fullBlob}) – called after save
 *   onCancel()   – called on cancel
 */
export default function ImageEditorModal({ file, docType, aspectRatio, helperText, onSave, onCancel }) {
    const { t } = useTranslation();
    const [imageSrc,      setImageSrc]      = useState(null);
    const [crop,          setCrop]          = useState(undefined);      // displayed crop box
    const [completedCrop, setCompletedCrop] = useState(null);           // px after mouse-up
    const [cornerPoints,  setCornerPoints]  = useState(null);           // 4-corner points in %
    const [rotating,      setRotating]      = useState(false);
    const [saving,        setSaving]        = useState(false);
    const [error,         setError]         = useState("");

    const imgRef = useRef(null);

    // Load file once
    useEffect(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload  = e => setImageSrc(e.target.result);
        reader.onerror = () => setError(t("crop.errorLoad"));
        reader.readAsDataURL(file);
    }, [file, t]);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    /** When the <img> is ready, set initial crop */
    const onImageLoad = useCallback(e => {
        const { width, height } = e.currentTarget;
        const initial = makeInitialCrop(width, height, aspectRatio);
        setCrop(initial);
        // start with completedCrop matching initial (% → px)
        setCompletedCrop(null);
    }, [aspectRatio]);

    /** Rotate: bake rotation into the data-URL so crop coords stay simple */
    const handleRotate = useCallback(async () => {
        if (!imageSrc || rotating) return;
        setRotating(true);
        setError("");
        try {
            const rotated = await rotateSrc(imageSrc);
            setImageSrc(rotated);
            setCrop(undefined);       // will reset on next onImageLoad
            setCompletedCrop(null);
        } catch {
            setError(t("crop.errorRotate"));
        } finally {
            setRotating(false);
        }
    }, [imageSrc, rotating, t]);

    /** Save: extract the selected area */
    const handleSave = useCallback(async () => {
        if (!imgRef.current) return;
        setSaving(true);
        setError("");
        try {
            const img = imgRef.current;
            
            if (docType && cornerPoints) {
                // 4-corner mode
                const rw = img.width;      // rendered width
                const rh = img.height;     // rendered height
                const nw = img.naturalWidth;
                const nh = img.naturalHeight;
                
                // pxPoints for extractCrop (rendered pixels)
                const pxPoints = cornerPoints.map(p => ({ x: (p.x / 100) * rw, y: (p.y / 100) * rh }));
                
                const minX = Math.max(0, Math.min(...pxPoints.map(p => p.x)));
                const maxX = Math.min(rw, Math.max(...pxPoints.map(p => p.x)));
                const minY = Math.max(0, Math.min(...pxPoints.map(p => p.y)));
                const maxY = Math.min(rh, Math.max(...pxPoints.map(p => p.y)));
                
                const bboxCrop = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
                const fallbackBlob = await extractCrop(img, bboxCrop);
                
                // Get the full image as a blob (preserves rotation)
                const fullCrop = { x: 0, y: 0, width: rw, height: rh };
                const fullBlob = await extractCrop(img, fullCrop);
                
                // naturalPoints for backend OpenCV
                const naturalPoints = cornerPoints.map(p => ({ x: (p.x / 100) * nw, y: (p.y / 100) * nh }));
                const cornersStr = naturalPoints.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(",");
                
                await onSave({ blob: fallbackBlob, corners: cornersStr, fullBlob: fullBlob });
                return;
            }
            
            // Standard Rectangular Crop Mode
            if (!completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
                const full = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
                await onSave(await extractCrop(img, full));
                return;
            }
            
            const blob = await extractCrop(img, completedCrop);
            await onSave(blob);
        } catch (e) {
            console.error(e);
            setError(t("crop.errorCrop"));
            setSaving(false);
        }
    }, [completedCrop, cornerPoints, docType, onSave, t]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (!imageSrc) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-3 text-white">
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    <span className="text-[14px]">{t("crop.loading")}</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col bg-[#111]"
            style={{ touchAction: "none" }}
        >
            {/* Inject crop style overrides */}
            <style>{CROP_STYLES}</style>

            {/* ── Top bar ──────────────────────────────────────────────────── */}
            <div
                className="flex items-center gap-2 px-3 py-3 border-b border-white/10"
                style={{ background: "rgba(0,0,0,0.92)" }}
            >
                <button
                    onClick={onCancel}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/10 text-white text-[14px] font-medium active:bg-white/20"
                    style={{ minWidth: 80, minHeight: 48 }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    {t("crop.cancel")}
                </button>

                <p className="flex-1 text-center text-[11px] text-white/55 leading-snug px-1">{helperText}</p>

                <button
                    onClick={handleRotate}
                    disabled={rotating}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/10 text-white text-[14px] font-medium active:bg-white/20 disabled:opacity-40"
                    style={{ minWidth: 80, minHeight: 48, justifyContent: "center" }}
                >
                    {rotating
                        ? <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    }
                    {t("crop.rotate90")}
                </button>
            </div>

            {/* ── Hint strip ───────────────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-white/5 border-b border-white/5">
                <span className="text-[11px] text-white/40">
                    {docType 
                        ? t("crop.fourCorners")
                        : `${t("crop.dragCorners")} • ${t("crop.moveFrame")} • ${t("crop.pinchZoom")}`}
                </span>
            </div>

            {/* ── Crop area ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto flex items-start justify-center bg-[#0d0d0d]" style={{ WebkitOverflowScrolling: "touch" }}>
                {docType ? (
                    <FourCornerSelector 
                        imageSrc={imageSrc} 
                        onImageLoad={e => imgRef.current = e.currentTarget} 
                        onChange={setCornerPoints} 
                    />
                ) : (
                    <ReactCrop
                        crop={crop}
                        onChange={(pxCrop, pctCrop) => setCrop(pctCrop)}
                        onComplete={(pxCrop) => setCompletedCrop(pxCrop)}
                        keepSelection
                        ruleOfThirds
                        style={{ maxWidth: "100%", display: "block" }}
                    >
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            alt={t("crop.imageAlt")}
                            onLoad={onImageLoad}
                            style={{
                                maxWidth: "100%",
                                maxHeight: "calc(100dvh - 200px)",
                                display: "block",
                                objectFit: "contain",
                            }}
                            draggable={false}
                        />
                    </ReactCrop>
                )}
            </div>

            {/* ── Bottom controls ──────────────────────────────────────────── */}
            <div
                className="px-4 py-4 space-y-3 border-t border-white/10"
                style={{ background: "rgba(0,0,0,0.92)" }}
            >
                {error && (
                    <p className="text-[#ff6b6b] text-[13px] text-center">{error}</p>
                )}

                <button
                    onClick={handleSave}
                    disabled={saving || rotating}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-[16px] text-white transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{
                        background: "linear-gradient(135deg, #4f7cff 0%, #3d6ae8 100%)",
                        minHeight: 56,
                        boxShadow: "0 4px 20px rgba(79,124,255,0.35)",
                    }}
                >
                    {saving ? (
                        <>
                            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            {t("crop.saving")}
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            {docType ? t('crop.straightenDone') : t('crop.doneUseSelectedArea')}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
