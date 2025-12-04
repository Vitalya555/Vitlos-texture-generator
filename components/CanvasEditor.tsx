import React, { useState, useRef, useEffect } from 'react';
import { Annotation } from '../types';
import { MapPin, X, Move } from 'lucide-react';

interface CanvasEditorProps {
  imageSrc: string | null;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({ imageSrc, annotations, setAnnotations }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tempLabel, setTempLabel] = useState('');
  const [pendingClick, setPendingClick] = useState<{x: number, y: number} | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Handle Dragging
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!draggingId || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      // Clamp values to keeping inside canvas
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      setAnnotations(prev => prev.map(ann => 
        ann.id === draggingId ? { ...ann, x, y } : ann
      ));
    };

    const handlePointerUp = () => {
      if (draggingId) {
        setDraggingId(null);
      }
    };

    if (draggingId) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingId, setAnnotations]);


  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only trigger if not dragging and not clicking on existing annotation
    if (draggingId || !imageSrc || !containerRef.current) return;

    // Small delay/check to prevent click after drag release
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setPendingClick({ x, y });
  };

  const addAnnotation = () => {
    if (pendingClick && tempLabel.trim()) {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        x: pendingClick.x,
        y: pendingClick.y,
        label: tempLabel.trim(),
      };
      setAnnotations([...annotations, newAnnotation]);
      setTempLabel('');
      setPendingClick(null);
    }
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
  };

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(id);
    setPendingClick(null); // Clear any pending input if we start dragging
  };

  const handleCancel = () => {
    setPendingClick(null);
    setTempLabel('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gray-800 p-2 rounded-lg border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-400 mb-2 flex justify-between">
          <span>1. Разметка UV</span>
          <span className="text-xs font-normal text-gray-500">Нажми чтобы добавить, тяни чтобы переместить</span>
        </h3>
        
        <div 
          ref={containerRef}
          className="relative w-full aspect-square bg-gray-900 rounded border border-dashed border-gray-600 overflow-hidden cursor-crosshair group touch-none"
          onClick={handleImageClick}
        >
          {imageSrc ? (
            <img 
              src={imageSrc} 
              alt="UV Layout" 
              className="w-full h-full object-contain pointer-events-none opacity-80" 
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Нет изображения
            </div>
          )}

          {/* Render Existing Annotations */}
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group/pin ${draggingId === ann.id ? 'z-50 scale-110' : 'z-20'}`}
              style={{ left: `${ann.x}%`, top: `${ann.y}%`, touchAction: 'none' }}
              onPointerDown={(e) => startDrag(e, ann.id)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`transition-transform ${draggingId === ann.id ? 'cursor-grabbing' : 'cursor-grab hover:scale-110'}`}>
                <MapPin className="w-6 h-6 text-red-500 fill-red-500 drop-shadow-lg" />
              </div>
              
              <span className={`bg-black/80 text-white text-xs px-2 py-0.5 rounded mt-1 whitespace-nowrap backdrop-blur-sm select-none border border-gray-700 flex items-center gap-1 ${draggingId === ann.id ? 'ring-2 ring-blue-500' : ''}`}>
                {ann.label}
                {draggingId === ann.id && <Move size={10} className="text-gray-400"/>}
              </span>

              {/* Delete Button (only show when not dragging) */}
              {!draggingId && (
                <div 
                  className="hidden group-hover/pin:flex absolute -top-2 -right-2 bg-white text-red-600 rounded-full p-0.5 cursor-pointer hover:bg-red-100 z-30"
                  onClick={(e) => { e.stopPropagation(); removeAnnotation(ann.id); }}
                >
                  <X size={12} />
                </div>
              )}
            </div>
          ))}

          {/* Render Pending Annotation Input */}
          {pendingClick && !draggingId && (
            <div 
              className="absolute z-30 bg-gray-800 p-3 rounded-lg shadow-xl border border-gray-600 w-48 animate-in fade-in zoom-in duration-200"
              style={{ 
                left: `${Math.min(pendingClick.x, 70)}%`, 
                top: `${Math.min(pendingClick.y, 80)}%` 
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs text-gray-300 mb-2 font-bold">Какая это часть?</p>
              <input
                type="text"
                autoFocus
                placeholder="напр. Лицо, Торс"
                className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 mb-2"
                value={tempLabel}
                onChange={(e) => setTempLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAnnotation()}
              />
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={handleCancel}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Отмена
                </button>
                <button 
                  onClick={addAnnotation}
                  disabled={!tempLabel.trim()}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded disabled:opacity-50"
                >
                  ОК
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2 px-1">
           * Важно: Отметьте "Лицо", чтобы AI не рисовал шлем. Вы можете перетаскивать метки.
        </p>
      </div>
      
      {/* Legend / List of annotations */}
      {annotations.length > 0 && (
         <div className="flex flex-wrap gap-2">
            {annotations.map(ann => (
                <div key={ann.id} className="flex items-center gap-1 bg-gray-800 border border-gray-700 px-2 py-1 rounded-full text-xs text-gray-300">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    {ann.label}
                    <button onClick={() => removeAnnotation(ann.id)} className="ml-1 text-gray-500 hover:text-white">
                        <X size={12} />
                    </button>
                </div>
            ))}
            <button onClick={() => setAnnotations([])} className="text-xs text-red-400 underline ml-auto">
              Очистить все
            </button>
         </div>
      )}
    </div>
  );
};

export default CanvasEditor;