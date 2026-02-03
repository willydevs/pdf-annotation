import React from 'react';
import { ZoomIn, ZoomOut, Upload, MousePointer2, Type } from 'lucide-react';

interface ToolbarProps {
    scale: number;
    setScale: (scale: number) => void;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    selectionMode: 'text' | 'area';
    setSelectionMode: (mode: 'text' | 'area') => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ scale, setScale, onUpload, selectionMode, setSelectionMode }) => {
    return (
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm z-10 overflow-x-auto overflow-y-hidden gap-4 min-w-0">
            <div className="flex items-center space-x-4 shrink-0">
                <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hidden sm:block">
                    Leitor de PDF
                </h1>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent sm:hidden">
                    PDF
                </h1>
            </div>

            <div className="flex items-center space-x-4 shrink-0">
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setSelectionMode('text')}
                        className={`flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${selectionMode === 'text' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Type size={14} className="md:w-4 md:h-4" />
                        <span>Texto</span>
                    </button>
                    <button
                        onClick={() => setSelectionMode('area')}
                        className={`flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${selectionMode === 'area' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <MousePointer2 size={14} className="md:w-4 md:h-4" />
                        <span>Área</span>
                    </button>
                </div>

                <div className="flex items-center space-x-1 md:space-x-2 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setScale(scale - 0.1)}
                        className="p-1.5 md:p-2 hover:bg-white rounded-md transition-colors text-gray-600"
                        title="Diminuir Zoom"
                    >
                        <ZoomOut size={16} className="md:w-5 md:h-5" />
                    </button>
                    <span className="px-1 md:px-2 text-xs md:text-sm font-medium text-gray-600 min-w-[2.5rem] md:min-w-[3rem] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale(scale + 0.1)}
                        className="p-1.5 md:p-2 hover:bg-white rounded-md transition-colors text-gray-600"
                        title="Aumentar Zoom"
                    >
                        <ZoomIn size={16} className="md:w-5 md:h-5" />
                    </button>
                </div>
            </div>

            <div className="shrink-0">
                <label className="flex items-center space-x-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors shadow-sm font-medium text-xs md:text-sm">
                    <Upload size={14} className="md:w-[18px] md:h-[18px]" />
                    <span className="hidden sm:inline">Carregar PDF</span>
                    <span className="sm:hidden">PDF</span>
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={onUpload}
                        className="hidden"
                    />
                </label>
            </div>
        </div>
    );
};
