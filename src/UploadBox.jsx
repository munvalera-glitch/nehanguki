import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import imageCompression from "browser-image-compression";

export default function UploadBox({
  title,
  note,
  file,
  onFile,
  ocrStatus,
  ocrError,
  onAdjust,
  bgImage,
  bgPosition,
  loadingText,
  isPasswordRecovery,
  onUnifiedAdjust,
  onUnifiedReplace,
  forceLanguage,
  onClickIntercept
}) {
  const { t, i18n } = useTranslation();
  const cameraInputRef = React.useRef(null);
  const galleryInputRef = React.useRef(null);
  const isSelectingRef = React.useRef(false);
  const [isIOS, setIsIOS] = React.useState(false);
  const [isAndroid, setIsAndroid] = React.useState(false);
  const [showChoiceModal, setShowChoiceModal] = React.useState(false);

  React.useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
    setIsAndroid(/Android/i.test(navigator.userAgent));
  }, []);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [isCompressing, setIsCompressing] = React.useState(false);
  const uploaded = !!file;
  const isLoading = ocrStatus === "loading" || isCompressing;
  const isSuccess = ocrStatus === "success";
  const isError = ocrStatus === "error";

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = async e => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const fileType = rawFile.type.toLowerCase();
    const fileName = rawFile.name.toLowerCase();

    const isSupported = allowedTypes.includes(fileType) ||
      allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isSupported) {
      alert(t("upload.unsupportedError"));
      e.target.value = "";
      return;
    }

    if (rawFile.type.startsWith("image/")) {
      setIsCompressing(true);
      try {
        const options = {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 2000,
          useWebWorker: true,
          exifOrientation: true
        };
        const compressedBlob = await imageCompression(rawFile, options);
        const optimizedFile = new File([compressedBlob], rawFile.name, { type: "image/jpeg" });

        console.log(
          "Original:",
          (rawFile.size / 1024 / 1024).toFixed(2),
          "MB"
        );
        console.log(
          "Compressed:",
          (optimizedFile.size / 1024 / 1024).toFixed(2),
          "MB"
        );
        console.log(
          "Reduction:",
          ((1 - optimizedFile.size / rawFile.size) * 100).toFixed(1) + "%"
        );

        if (onFile) onFile(optimizedFile);
      } catch (error) {
        console.warn("Image compression failed, falling back to original", error);
        if (onFile) onFile(rawFile);
      } finally {
        setIsCompressing(false);
      }
    } else {
      if (onFile) onFile(rawFile);
    }
    // Reset input so same file can be re-selected after editor cancel
    e.target.value = "";
  };
  const handleCardClick = () => {
    if (isLoading || isSelectingRef.current) return;
    const openPicker = () => {
      if (isAndroid) {
        setShowChoiceModal(true);
      } else {
        isSelectingRef.current = true;
        galleryInputRef.current?.click();
        setTimeout(() => { isSelectingRef.current = false; }, 1000);
      }
    };
    if (onClickIntercept) {
      onClickIntercept(openPicker);
    } else {
      openPicker();
    }
  };

  const handleCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  const truncate = (name, max = 26) => name.length > max ? name.slice(0, max - 1) + "…" : name;
  const isWarning = ocrStatus === "warning";
  return <div className={`relative h-full border rounded-[16px] md:rounded-[20px] transition-all duration-200 text-center flex flex-col items-center select-none overflow-hidden cursor-pointer
                ${uploaded ? isError ? "border-[#e07a7a] bg-[#fff6f6]" : isWarning ? "border-[#d97706] bg-[#fffbef]" : "border-[#2d7a2d] bg-[#f0faf0]" : "border-dashed border-[#d9d7d3] bg-white hover:bg-[#fbfbfa] p-4 md:p-8 justify-center"}
                ${!uploaded ? "min-h-[140px] md:min-h-[180px]" : ""}`} 
                onClick={handleCardClick}
                onKeyDown={handleCardKeyDown}
                role="button"
                tabIndex={0}
                >
    {/* Watermark background if not uploaded */}
    {!uploaded && bgImage && (
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.35]" 
        style={{ 
          backgroundImage: `url(${bgImage})`, 
          backgroundSize: '100% auto', 
          backgroundPosition: bgPosition || 'center',
          backgroundRepeat: 'no-repeat'
        }} 
      />
    )}
    
    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} disabled={isLoading} onClick={e => e.stopPropagation()} />
    <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={isLoading} onClick={e => e.stopPropagation()} />

    {uploaded && previewUrl ? <>
      {/* Image preview */}
      <div className="w-full relative">
        <img src={previewUrl} alt={file.name} onClick={(e) => {
          if (onAdjust) {
            e.stopPropagation();
            onAdjust();
          }
        }} className={`w-full h-[140px] md:h-[180px] object-cover rounded-t-[14px] md:rounded-t-[18px] ${onAdjust ? 'cursor-pointer hover:opacity-90' : ''}`} style={{
          opacity: isLoading ? 0.5 : 1,
          transition: "opacity 0.2s"
        }} />

        {/* Adjust Image badge & Choose another photo - Only for password recovery */}
        {!isLoading && isPasswordRecovery && (
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            {onAdjust && (
              <div
                className="bg-[#111]/70 backdrop-blur-sm text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm cursor-pointer hover:bg-[#111] transition-colors"
                onClick={(e) => { e.stopPropagation(); onAdjust(); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                <span className="text-[9px] font-medium uppercase tracking-wide">{t("adjust.adjustImage")}</span>
              </div>
            )}
            <div
              className="bg-white/90 backdrop-blur-sm text-[#111] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm cursor-pointer hover:bg-white transition-colors"
              onClick={e => {
                e.stopPropagation();
                galleryInputRef.current?.click();
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
              <span className="text-[9px] font-medium uppercase tracking-wide">{t("str_167")}</span>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 rounded-t-[14px] md:rounded-t-[18px]">
          <svg className="animate-spin mb-1.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span className="text-white text-[11px] font-medium text-center px-4">{loadingText || (!isPasswordRecovery && isCompressing ? t("upload.processingPhoto") : isCompressing ? (t("str_162") || "Processing...") : t("str_162"))}</span>
        </div>}

        {/* Success / Warning badge */}
        {isSuccess && <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#2d7a2d] text-white px-2 py-0.5 rounded-full shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span className="text-[10px] font-semibold">{t("str_163")}</span>
        </div>}
        {isWarning && <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#d97706] text-white px-2 py-0.5 rounded-full shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          <span className="text-[10px] font-semibold">{t("str_164")}</span>
        </div>}
      </div>

      {/* Footer row */}
      <div className="w-full px-3 py-2 md:px-4 md:py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isLoading ? <span className="text-[11px] md:text-[12px] text-[#787774] italic">{t("str_165")}</span> : isError ? <span className="text-[11px] md:text-[12px] text-[#e07a7a] truncate">{ocrError || t("str_166")}</span> : <>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isWarning ? "#d97706" : "#2d7a2d"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
            <span className={`text-[11px] md:text-[12px] font-medium truncate ${isWarning ? 'text-[#d97706]' : 'text-[#2d7a2d]'}`}>{truncate(file.name)}</span>
          </>}
        </div>
      </div>

      {/* Error banner below footer */}
      {isError && ocrError && isPasswordRecovery && (
        <div className="w-full px-3 pb-2.5 md:px-4">
          <div className="bg-[#fff0f0] border border-[#f5c6c6] rounded-[10px] px-3 py-2 flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c0504d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
            <p className="text-[11px] text-[#c0504d] leading-snug">{ocrError}</p>
          </div>
        </div>
      )}
      
      {/* Unified Actions State */}
      {!isLoading && !isPasswordRecovery && (
        <div className="w-full px-3 pb-3 md:px-4 space-y-3 mt-1">
          {isError && ocrError && (
            <div className="bg-[#fff0f0] border border-[#f5c6c6] rounded-[10px] px-3 py-2 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c0504d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
              <p className="text-[11px] text-[#c0504d] leading-snug font-medium">
                {ocrError || t("upload.autoProcessFailed") || "Photo could not be processed automatically."}
              </p>
            </div>
          )}
          <div className="flex gap-2">
             <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (onUnifiedReplace) onUnifiedReplace();
                  else {
                    if (isAndroid) setShowChoiceModal(true);
                    else galleryInputRef.current?.click();
                  }
                }}
                className="flex-[1] flex items-center justify-center py-2.5 rounded-xl text-[13px] font-semibold bg-[#f4f4f4] text-[#333] active:scale-95 transition-all border border-[#e5e5e5]"
             >
                {(forceLanguage || i18n.language) === 'ko' ? '사진 변경' : 'Заменить фото'}
             </button>
             <button
                onClick={(e) => { e.stopPropagation(); onUnifiedAdjust?.(); }}
                className="flex-[1.5] flex items-center justify-center py-2.5 rounded-xl text-[13px] font-semibold bg-[#e5e7eb] text-[#374151] hover:bg-[#d1d5db] active:scale-95 transition-all"
             >
                {(forceLanguage || i18n.language) === 'ko' ? '사진 편집' : 'Изменить фото'}
             </button>
          </div>
        </div>
      )}
    </> : <>
      <div className="relative z-10 flex flex-col items-center">
        <div className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-lg shadow-sm border border-white/50 mb-1">
          <div className="text-[15px] md:text-[17px] font-semibold text-[#111111]">{title}</div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center mt-2 gap-2 pointer-events-none">
        <button
          type="button"
          disabled={isLoading}
          className="py-1.5 md:py-2 flex items-center justify-center group"
        >
          <div className="inline-flex items-center justify-center gap-2 text-xs md:text-sm font-medium text-[#111111] bg-white/95 backdrop-blur-md px-4 py-2 rounded-[12px] shadow-sm border border-white/80 group-hover:bg-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            {(forceLanguage || i18n.language) === 'ko' ? '사진 업로드' : 'Загрузить фото'}
          </div>
        </button>
      </div>

      {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-[16px] md:rounded-[20px]">
        <svg className="animate-spin mb-1.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#787774" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span className="text-[#787774] text-[11px] font-medium text-center px-4">{loadingText || (!isPasswordRecovery && isCompressing ? t("upload.processingPhoto") : isCompressing ? (t("str_162") || "Processing...") : t("str_162"))}</span>
      </div>}
    </>}

    <UploadChoiceModal 
      open={showChoiceModal} 
      onClose={() => setShowChoiceModal(false)}
      forceLanguage={forceLanguage}
      onCamera={() => {
        isSelectingRef.current = true;
        cameraInputRef.current?.click();
        setTimeout(() => { isSelectingRef.current = false; }, 1000);
      }}
      onGallery={() => {
        isSelectingRef.current = true;
        galleryInputRef.current?.click();
        setTimeout(() => { isSelectingRef.current = false; }, 1000);
      }}
    />
  </div>;
}


function UploadChoiceModal({ open, onClose, onCamera, onGallery, forceLanguage }) {
  const { t, i18n } = useTranslation();
  if (!open) return null;

  const lang = forceLanguage || i18n.language;
  const takePhotoText = lang === 'ko' ? '사진 촬영' : 'Сделать фото';
  const galleryText = lang === 'ko' ? '갤러리에서 선택' : 'Выбрать из галереи';
  const cancelText = lang === 'ko' ? '취소' : 'Отмена';

  return <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/50 p-4 animate-in fade-in" onClick={onClose}>
    <div className="bg-white w-full max-w-sm rounded-2xl md:rounded-3xl overflow-hidden shadow-xl animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:zoom-in-95" onClick={e => e.stopPropagation()}>
      <div className="flex flex-col">
        <button onClick={() => { onClose(); onCamera(); }} className="py-4 px-6 text-[16px] md:text-[17px] font-medium text-[#111111] hover:bg-[#f1f1ef] active:bg-[#e7e5e2] flex items-center gap-3 transition-colors text-left border-b border-[#f1f1ef]">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
          {takePhotoText}
        </button>
        <button onClick={() => { onClose(); onGallery(); }} className="py-4 px-6 text-[16px] md:text-[17px] font-medium text-[#111111] hover:bg-[#f1f1ef] active:bg-[#e7e5e2] flex items-center gap-3 transition-colors text-left border-b border-[#f1f1ef]">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          {galleryText}
        </button>
        <button onClick={onClose} className="py-4 px-6 text-[16px] md:text-[17px] font-semibold text-[#c0504d] hover:bg-[#fff0f0] active:bg-[#fce8e8] flex items-center justify-center transition-colors">
          {cancelText}
        </button>
      </div>
    </div>
  </div>;
}
