import React from 'react';
import type { Highlight } from '../types';
import { Trash2, ExternalLink } from 'lucide-react';
import { LinkableText } from './LinkableText';

interface SidebarProps {
    highlights: Highlight[];
    onRemoveHighlight: (id: string) => void;
    onHighlightClick: (highlight: Highlight) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ highlights, onRemoveHighlight, onHighlightClick }) => {
    return (
        <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col font-sans">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Anotações</h2>
                <p className="text-sm text-gray-500">{highlights.length} item(ns)</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
                {highlights.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        <p>Nenhuma anotação ainda.</p>
                        <p className="text-sm">Selecione texto ou use o modo área para adicionar.</p>
                    </div>
                ) : (
                    highlights.map((highlight) => (
                        <div
                            key={highlight.id}
                            className="bg-white p-0 rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col group"
                        >
                            {/* Header: Page Info */}
                            <div className="px-4 py-2 border-b border-gray-100 bg-white">
                                <span className="text-xs text-gray-500 font-medium">
                                    Página {highlight.position.pageNumber}
                                </span>
                            </div>

                            <div className="p-4 flex flex-col space-y-3">
                                {/* Excerpt */}
                                {highlight.content.text ? (
                                    <div
                                        onClick={() => onHighlightClick(highlight)}
                                        className="cursor-pointer hover:bg-yellow-50 transition-colors rounded p-1 -m-1"
                                    >
                                        <h4 className="sr-only">Trecho</h4>
                                        <blockquote className="text-gray-800 font-semibold text-sm leading-relaxed line-clamp-4">
                                            {highlight.content.text}
                                        </blockquote>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => onHighlightClick(highlight)}
                                        className="text-sm text-gray-500 italic cursor-pointer"
                                    >
                                        [Imagem/Área Selecionada]
                                    </div>
                                )}

                                {/* Note Section */}
                                {highlight.comment.text && (
                                    <div className="mt-2">
                                        <h4 className="text-xs font-medium text-gray-500 mb-1">Nota</h4>
                                        <div className="bg-white border server-gray-200 rounded-md p-3 text-sm text-gray-700 shadow-sm border-gray-300">
                                            <div className="flex gap-2">
                                                {highlight.comment.emoji && (
                                                    <span>{highlight.comment.emoji}</span>
                                                )}
                                                <LinkableText text={highlight.comment.text} className="flex-1" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Buttons */}
                            <div className="px-4 py-3 bg-white border-t border-gray-100 flex justify-end space-x-2">
                                <button
                                    onClick={() => onHighlightClick(highlight)}
                                    className="flex items-center space-x-1 px-3 py-1.5 rounded border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <ExternalLink size={14} />
                                    <span>Ver no PDF</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveHighlight(highlight.id);
                                    }}
                                    className="flex items-center space-x-1 px-3 py-1.5 rounded border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 size={14} />
                                    <span>Excluir</span>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
