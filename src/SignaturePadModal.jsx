import React, { useState, useEffect } from "react";

export default function SignaturePadModal({ isOpen, onClose, onSave, title }) {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Make it full width of container, fixed height
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 240;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Transparent background
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const startDrawing = (e) => {
    if (e.type.startsWith('touch')) e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (e.type.startsWith('touch')) e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const cropAndSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasPixels = true;
        }
      }
    }

    if (!hasPixels) {
      alert("Пожалуйста, распишитесь.");
      return;
    }

    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);

    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedCtx = croppedCanvas.getContext('2d');
    croppedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    // Save as PNG transparent
    const dataUrl = croppedCanvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e7e5e2]">
          <h3 className="text-lg font-bold text-[#1a1c1d]">{title || "Добавить подпись"}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#f3f1ee] transition-colors text-[#555]">
            ✕
          </button>
        </div>
        
        <div className="p-6 flex-1 flex flex-col bg-[#f8f8f6]">
          <div className="bg-white border-2 border-dashed border-[#d9d7d3] rounded-xl overflow-hidden relative touch-none" style={{ height: "240px" }}>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <span className="text-xl font-bold">Распишитесь здесь</span>
            </div>
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-crosshair relative z-10"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#e7e5e2] bg-white flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleClear}
            className="flex-1 py-3 text-[15px] font-bold text-[#1a1c1d] bg-white border border-[#d9d7d3] rounded-xl hover:bg-[#f1f1ef] transition-colors"
          >
            Очистить
          </button>
          <button
            onClick={cropAndSave}
            className="flex-1 py-3 text-[15px] font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
          >
            Сохранить подпись
          </button>
        </div>
      </div>
    </div>
  );
}
