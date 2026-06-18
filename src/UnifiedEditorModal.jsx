import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import { useTranslation } from "react-i18next";
import "react-image-crop/dist/ReactCrop.css";

const CROP_STYLES = `
  /* Outside mask */
  .ReactCrop__crop-mask rect {
    fill: rgba(0, 0, 0, 0.62) !important;
  }
  /* Inside crop area */
  .ReactCrop__crop-selection {
    background: transparent !important;
    border: 2px solid rgba(255, 255, 255, 0.90) !important;
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.62) !important;
  }
  /* Hide corner handles completely so user can only drag edges */
  .ReactCrop__drag-handle.ord-nw,
  .ReactCrop__drag-handle.ord-ne,
  .ReactCrop__drag-handle.ord-sw,
  .ReactCrop__drag-handle.ord-se {
    display: none !important;
  }
  
  .ReactCrop__drag-handle {
    background: transparent !important;
    border: none !important;
    outline: none !important;
  }

  /* Make edge touch areas large */
  .ReactCrop__drag-handle.ord-n,
  .ReactCrop__drag-handle.ord-s {
    height: 32px !important;
    width: 100% !important;
    transform: translateY(-50%) !important;
  }
  .ReactCrop__drag-handle.ord-e,
  .ReactCrop__drag-handle.ord-w {
    width: 32px !important;
    height: 100% !important;
    transform: translateX(-50%) !important;
  }
  /* Hide the little white squares */
  .ReactCrop__drag-handle::after {
    display: none !important;
  }
  .ReactCrop__drag-bar {
    background: transparent !important;
  }
`;

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

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

function extractCrop(imgEl, pixelCrop, brightness, contrast) {
    const scaleX = imgEl.naturalWidth  / imgEl.width;
    const scaleY = imgEl.naturalHeight / imgEl.height;

    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(pixelCrop.width  * scaleX);
    canvas.height = Math.round(pixelCrop.height * scaleY);
    if (canvas.width === 0 || canvas.height === 0) return Promise.reject(new Error("Empty crop"));

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

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

function makeInitialCrop() {
    return { unit: "%", x: 5, y: 5, width: 90, height: 90 };
}

export default function UnifiedEditorModal({ file, onSave, onCancel, onReplace }) {
    const { t } = useTranslation();
    const [imageSrc,      setImageSrc]      = useState(null);
    const [crop,          setCrop]          = useState(undefined);
    const [completedCrop, setCompletedCrop] = useState(null);
    const [rotating,      setRotating]      = useState(false);
    const [saving,        setSaving]        = useState(false);
    const [error,         setError]         = useState("");
    
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);

    const imgRef = useRef(null);

    useEffect(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload  = e => setImageSrc(e.target.result);
        reader.onerror = () => setError(t("crop.errorLoad"));
        reader.readAsDataURL(file);
    }, [file, t]);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    const onImageLoad = useCallback(e => {
        const initial = makeInitialCrop();
        setCrop(initial);
        setCompletedCrop(null);
    }, []);

    const handleRotate = useCallback(async () => {
        if (!imageSrc || rotating) return;
        setRotating(true);
        setError("");
        try {
            const rotated = await rotateSrc(imageSrc);
            setImageSrc(rotated);
            setCrop(undefined);
            setCompletedCrop(null);
        } catch {
            setError(t("crop.errorRotate"));
        } finally {
            setRotating(false);
        }
    }, [imageSrc, rotating, t]);

    const handleSave = useCallback(async () => {
        if (!imgRef.current) return;
        setSaving(true);
        setError("");
        try {
            const img = imgRef.current;
            
            let cropToUse = completedCrop;
            if (!cropToUse || cropToUse.width === 0 || cropToUse.height === 0) {
                cropToUse = { x: 0, y: 0, width: img.width, height: img.height };
            }
            
            const blob = await extractCrop(img, cropToUse, brightness, contrast);
            await onSave(blob);
        } catch (e) {
            console.error(e);
            setError(t("crop.errorCrop"));
            setSaving(false);
        }
    }, [completedCrop, brightness, contrast, onSave, t]);

    if (!imageSrc) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-3 text-white">
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    <span className="text-[14px]">{t("crop.loading") || "Loading..."}</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col bg-[#111]"
            style={{ touchAction: "none" }}
        >
            <style>{CROP_STYLES}</style>

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
                    {t("editor.cancel") || "Cancel"}
                </button>

                <p className="flex-1 text-center text-[13px] text-white/55 font-medium px-1">{t("upload.adjustImageBig") || "Adjust image"}</p>

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
                    {t("crop.rotate90") || "90°"}
                </button>
            </div>

            <div className="flex-1 overflow-auto flex items-start justify-center bg-[#0d0d0d] relative" style={{ WebkitOverflowScrolling: "touch" }}>
                <ReactCrop
                    crop={crop}
                    onChange={(pxCrop, pctCrop) => setCrop(pctCrop)}
                    onComplete={(pxCrop) => setCompletedCrop(pxCrop)}
                    keepSelection
                    style={{ maxWidth: "100%", display: "block", touchAction: "none" }}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Document"
                        onLoad={onImageLoad}
                        style={{
                            maxWidth: "100%",
                            maxHeight: "calc(100dvh - 280px)",
                            display: "block",
                            objectFit: "contain",
                            filter: `brightness(${brightness}%) contrast(${contrast}%)`
                        }}
                        draggable={false}
                    />
                </ReactCrop>
            </div>

            <div
                className="px-4 py-4 space-y-4 border-t border-white/10"
                style={{ background: "rgba(0,0,0,0.92)" }}
            >
                <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-[11px] font-medium text-white/70">
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
                        <div className="flex justify-between text-[11px] font-medium text-white/70">
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

                {error && (
                    <p className="text-[#ff6b6b] text-[13px] text-center">{error}</p>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={onReplace}
                        disabled={saving || rotating}
                        className="flex-[1] flex items-center justify-center py-3.5 rounded-xl font-semibold text-[15px] text-white transition-all active:scale-[0.98] disabled:opacity-50"
                        style={{ background: "rgba(255,255,255,0.1)" }}
                    >
                        {t("editor.replace") || "Replace"}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || rotating}
                        className="flex-[1.5] flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[15px] text-white transition-all active:scale-[0.98] disabled:opacity-50"
                        style={{
                            background: "linear-gradient(135deg, #4f7cff 0%, #3d6ae8 100%)",
                            boxShadow: "0 4px 20px rgba(79,124,255,0.35)",
                        }}
                    >
                        {saving ? (
                            <>
                                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                {t("crop.saving") || "Saving..."}
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                {t("editor.done") || "Done"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
