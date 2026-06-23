import React, { useMemo, useState } from 'react';
import type { Highlight } from '../types';
import { ExternalLink, Search, Trash2, X } from 'lucide-react';
import { LinkableText } from './LinkableText';

interface SidebarProps {
    highlights: Highlight[];
    onRemoveHighlight: (id: string) => void;
    onHighlightClick: (highlight: Highlight) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ highlights, onRemoveHighlight, onHighlightClick }) => {
    const [query, setQuery] = useState('');
    const normalizedQuery = query.trim().toLowerCase();

    const filteredHighlights = useMemo(() => {
        if (!normalizedQuery) {
            return highlights;
        }

        return highlights.filter((highlight) => {
            const searchableText = [
                highlight.content.text,
                highlight.comment.text,
                highlight.comment.emoji,
                `pagina ${highlight.position.pageNumber}`,
                `página ${highlight.position.pageNumber}`,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchableText.includes(normalizedQuery);
        });
    }, [highlights, normalizedQuery]);

    return (
        <div className="w-full md:w-80 bg-white border-t md:border-l md:border-t-0 border-gray-200 h-full flex flex-col font-sans">
            <div className="p-4 border-b border-gray-200 space-y-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Anotações</h2>
                    <p className="text-sm text-gray-500">
                        {normalizedQuery
                            ? `${filteredHighlights.length} de ${highlights.length} item(ns)`
                            : `${highlights.length} item(ns)`}
                    </p>
                </div>

                <label className="relative block">
                    <span className="sr-only">Buscar anotações</span>
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar anotações"
                        className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                            title="Limpar busca"
                        >
                            <X size={14} />
                        </button>
                    )}
                </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50">
                {highlights.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        <p>Nenhuma anotação ainda.</p>
                        <p className="text-sm">Selecione texto ou use o modo área para adicionar.</p>
                    </div>
                ) : filteredHighlights.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        <p>Nenhum resultado encontrado.</p>
                    </div>
                ) : (
                    filteredHighlights.map((highlight) => (
                        <div
                            key={highlight.id}
                            className="bg-white p-0 rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col group"
                        >
                            <div className="px-4 py-2 border-b border-gray-100 bg-white">
                                <span className="text-xs text-gray-500 font-medium">
                                    Página {highlight.position.pageNumber}
                                </span>
                            </div>

                            <div className="p-4 flex flex-col space-y-3">
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

                                {highlight.comment.text && (
                                    <div className="mt-2">
                                        <h4 className="text-xs font-medium text-gray-500 mb-1">Nota</h4>
                                        <div className="bg-white rounded-md p-3 text-sm text-gray-700 shadow-sm border border-gray-300">
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

                            <div className="px-4 py-3 bg-white border-t border-gray-100 flex justify-end space-x-2">
                                <button
                                    onClick={() => onHighlightClick(highlight)}
                                    className="flex items-center space-x-1 px-3 py-1.5 rounded border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <ExternalLink size={14} />
                                    <span>Ver no PDF</span>
                                </button>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
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
