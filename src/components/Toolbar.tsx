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
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
            <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Leitor de PDF
                </h1>
            </div>

            <div className="flex items-center space-x-4">
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setSelectionMode('text')}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectionMode === 'text' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Type size={16} />
                        <span>Texto</span>
                    </button>
                    <button
                        onClick={() => setSelectionMode('area')}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectionMode === 'area' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <MousePointer2 size={16} />
                        <span>Área</span>
                    </button>
                </div>

                <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setScale(scale - 0.1)}
                        className="p-2 hover:bg-white rounded-md transition-colors text-gray-600"
                        title="Diminuir Zoom"
                    >
                        <ZoomOut size={20} />
                    </button>
                    <span className="px-2 text-sm font-medium text-gray-600 min-w-[3rem] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale(scale + 0.1)}
                        className="p-2 hover:bg-white rounded-md transition-colors text-gray-600"
                        title="Aumentar Zoom"
                    >
                        <ZoomIn size={20} />
                    </button>
                </div>
            </div>

            <div>
                <label className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors shadow-sm font-medium">
                    <Upload size={18} />
                    <span>Carregar PDF</span>
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
