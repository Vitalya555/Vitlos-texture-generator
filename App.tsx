import React, { useState } from 'react';
import { Upload, Wand2, Download, RefreshCw, AlertCircle, ScanEye, Sparkles } from 'lucide-react';
import CanvasEditor from './components/CanvasEditor';
import { Annotation, GenerationState } from './types';
import { generateTexture, detectUVParts, editTexture } from './services/gemini';

const App: React.FC = () => {
  const [uvImage, setUvImage] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [stylePrompt, setStylePrompt] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [genState, setGenState] = useState<GenerationState>({
    isLoading: false,
    resultImage: null,
    error: null,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        setUvImage(base64);
        setAnnotations([]); // Reset old
        setGenState(prev => ({ ...prev, resultImage: null, error: null }));
        
        // Auto-detect parts
        setIsDetecting(true);
        try {
           const rawBase64 = base64.split(',')[1];
           const detectedParts = await detectUVParts(rawBase64);
           if (detectedParts && detectedParts.length > 0) {
             setAnnotations(detectedParts);
           }
        } catch (err) {
           console.error("Auto detection failed", err);
        } finally {
           setIsDetecting(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!uvImage) return;
    if (!stylePrompt.trim()) {
      setGenState(prev => ({ ...prev, error: "Пожалуйста, опишите стиль текстуры." }));
      return;
    }

    setGenState({ isLoading: true, resultImage: null, error: null });

    try {
      // Extract base64 raw data
      const base64Data = uvImage.split(',')[1];
      const result = await generateTexture(base64Data, stylePrompt, annotations);
      setGenState({ isLoading: false, resultImage: result, error: null });
    } catch (err: any) {
      setGenState({ isLoading: false, resultImage: null, error: err.message || "Ошибка генерации" });
    }
  };

  const handleEdit = async () => {
    if (!genState.resultImage || !editPrompt.trim()) return;

    setGenState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const base64Data = genState.resultImage.split(',')[1];
      const result = await editTexture(base64Data, editPrompt);
      setGenState({ isLoading: false, resultImage: result, error: null });
      setEditPrompt(''); // Clear edit prompt on success
    } catch (err: any) {
      setGenState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: err.message || "Ошибка редактирования" 
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="mb-8 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
            Roblox AI Texture Painter
          </h1>
          <p className="text-gray-400">
            Загрузи UV развертку, AI автоматически найдет части тела. Опиши стиль и получи скин.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Controls & Input */}
          <div className="space-y-6">
            
            {/* Upload Section */}
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg relative overflow-hidden">
              <label className="block text-sm font-medium text-gray-300 mb-2">Загрузить UV Развертку (Template)</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isDetecting}
                />
                <div className={`border-2 border-dashed border-gray-700 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500 group-hover:border-blue-500 group-hover:text-blue-400 transition-colors bg-gray-900/50 h-32 ${isDetecting ? 'opacity-50' : ''}`}>
                   <Upload className="mb-2" />
                   <span className="text-sm">{uvImage ? "Файл выбран (Нажми чтобы заменить)" : "Нажми или перетащи файл сюда"}</span>
                </div>
              </div>
              
              {isDetecting && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-20">
                   <div className="flex flex-col items-center text-blue-400 animate-pulse">
                      <ScanEye className="w-10 h-10 mb-2 animate-bounce"/>
                      <span className="font-semibold">AI ищет части тела...</span>
                   </div>
                </div>
              )}
            </div>

            {/* Canvas / Annotation Section */}
            {uvImage && (
              <CanvasEditor 
                imageSrc={uvImage} 
                annotations={annotations} 
                setAnnotations={setAnnotations} 
              />
            )}

            {/* Prompt Section */}
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg">
              <label className="block text-sm font-medium text-gray-300 mb-2">2. Опиши стиль</label>
              <textarea
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                placeholder="Пример: Киберпанк броня, неоновые линии, темно-синий металл..."
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
              />
              <p className="text-xs text-gray-500 mt-2">
                 * AI попытается полностью закрасить линии развертки вашим стилем.
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={handleGenerate}
              disabled={!uvImage || genState.isLoading || isDetecting}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg
                ${!uvImage || genState.isLoading || isDetecting
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-500 hover:to-purple-500 shadow-blue-500/20'
                }`}
            >
              {genState.isLoading ? (
                <>
                  <RefreshCw className="animate-spin" /> Обработка...
                </>
              ) : (
                <>
                  <Wand2 /> {genState.resultImage ? "Создать заново" : "Создать Скин"}
                </>
              )}
            </button>

            {genState.error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg flex items-center gap-2">
                <AlertCircle size={20} />
                <span className="text-sm">{genState.error}</span>
              </div>
            )}
          </div>

          {/* Right Column: Result */}
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg flex flex-col h-full min-h-[500px]">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Download size={20} className="text-purple-400"/> Результат
            </h2>
            
            <div className="flex-1 bg-gray-950 rounded-lg border border-gray-700 flex items-center justify-center relative overflow-hidden min-h-[300px]">
               {genState.isLoading ? (
                 <div className="flex flex-col items-center gap-4 text-gray-400 animate-pulse p-8">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-center">AI рисует текстуры и удаляет линии...<br/><span className="text-xs text-gray-600">Это может занять 10-20 секунд</span></p>
                 </div>
               ) : genState.resultImage ? (
                 <img 
                   src={genState.resultImage} 
                   alt="Generated Skin" 
                   className="w-full h-full object-contain"
                 />
               ) : (
                 <div className="text-gray-600 text-center p-8">
                    <p className="mb-2">Здесь появится результат</p>
                    <p className="text-xs max-w-xs mx-auto opacity-50">
                      Итоговая картинка будет без линий разметки.
                    </p>
                 </div>
               )}
            </div>

            {genState.resultImage && (
              <div className="mt-6 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 
                 {/* Download Button */}
                 <a 
                   href={genState.resultImage} 
                   download="roblox_skin_ai.png"
                   className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-900/20"
                 >
                   <Download size={18} /> Скачать PNG
                 </a>

                 {/* Edit Section */}
                 <div className="border-t border-gray-700 pt-4 mt-2">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                       <Sparkles size={16} className="text-yellow-400"/> Редактировать этот результат
                    </h3>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="Напр: Сделай броню красной, добавь логотип на спину..."
                        className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                      />
                      <button 
                        onClick={handleEdit}
                        disabled={!editPrompt.trim() || genState.isLoading}
                        className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors border border-gray-600"
                      >
                        Применить
                      </button>
                    </div>
                 </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;
