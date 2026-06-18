import React, { useState, useRef, useEffect } from "react";

export default function FourCornerSelector({ imageSrc, onImageLoad, onChange }) {
  const containerRef = useRef(null);
  
  // Percentages [0-100]
  const [points, setPoints] = useState([
    { x: 10, y: 10 }, // TL
    { x: 90, y: 10 }, // TR
    { x: 90, y: 90 }, // BR
    { x: 10, y: 90 }, // BL
  ]);
  
  const [draggingIdx, setDraggingIdx] = useState(null);

  // When points change, emit to parent
  useEffect(() => {
    onChange(points);
  }, [points, onChange]);

  function handlePointerDown(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIdx(idx);
    e.target.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (draggingIdx === null) return;
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Clamp
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    setPoints(prev => {
      const newPoints = [...prev];
      newPoints[draggingIdx] = { x, y };
      return newPoints;
    });
  }

  function handlePointerUp(e) {
    if (draggingIdx !== null) {
      e.target.releasePointerCapture(e.pointerId);
      setDraggingIdx(null);
    }
  }

  return (
    <div 
      ref={containerRef}
      className="relative inline-block select-none" 
      style={{ touchAction: "none" }}
    >
      <img
        src={imageSrc}
        onLoad={onImageLoad}
        draggable={false}
        style={{
          maxWidth: "100%",
          maxHeight: "calc(100dvh - 200px)",
          display: "block",
          objectFit: "contain",
        }}
        alt="Document"
      />
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="crop-mask">
            <rect width="100" height="100" fill="white" />
            <polygon
              points={points.map(p => `${p.x},${p.y}`).join(" ")}
              fill="black"
            />
          </mask>
        </defs>
        
        <rect width="100" height="100" fill="rgba(0, 0, 0, 0.6)" mask="url(#crop-mask)" />
        
        <polygon
          points={points.map(p => `${p.x},${p.y}`).join(" ")}
          fill="transparent"
          stroke="#4f7cff"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {points.map((p, i) => (
        <div
          key={i}
          className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full flex items-center justify-center cursor-move touch-none"
          style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: 10 }}
          onPointerDown={(e) => handlePointerDown(e, i)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="w-4 h-4 bg-white border-2 border-[#4f7cff] rounded-full pointer-events-none shadow-sm" />
        </div>
      ))}
    </div>
  );
}
