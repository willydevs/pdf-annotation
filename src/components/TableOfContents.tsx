import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Loader2, Search, X } from 'lucide-react';
import { fetchToc, type TocEntry } from '../api';

interface Props {
    onNavigate: (pageNumber: number) => void;
    onClose: () => void;
}

export const TableOfContents: React.FC<Props> = ({ onNavigate, onClose }) => {
    const [entries, setEntries] = useState<TocEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchToc()
            .then(setEntries)
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
        ? entries.filter(e =>
            e.title.toLowerCase().includes(normalizedQuery) ||
            String(e.pageNumber).includes(normalizedQuery)
        )
        : entries;

    return (
        <div
            ref={panelRef}
            className="absolute left-0 top-0 h-full w-72 bg-white border-r border-gray-200 shadow-xl z-30 flex flex-col"
        >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-blue-600" />
                    <h2 className="font-bold text-gray-800 text-sm">Sumário</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                >
                    <X size={14} />
                </button>
            </div>

            <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                <label className="relative block">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar no sumário..."
                        className="w-full rounded border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
                    />
                </label>
            </div>

            <div className="flex-1 overflow-y-auto py-1">
                {loading ? (
                    <div className="flex items-center justify-center h-24 text-gray-400">
                        <Loader2 size={20} className="animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 mt-8 px-4">
                        {entries.length === 0 ? 'Sumário indisponível para este documento.' : 'Nenhum resultado.'}
                    </p>
                ) : (
                    filtered.map((entry, i) => (
                        <button
                            key={i}
                            onClick={() => { onNavigate(entry.pageNumber); onClose(); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors group border-b border-gray-50 last:border-0"
                        >
                            <span className="block text-xs text-gray-800 leading-snug group-hover:text-blue-700 line-clamp-2">
                                {entry.title}
                            </span>
                            <span className="text-[10px] text-gray-400 group-hover:text-blue-500 mt-0.5 block">
                                p. {entry.pageNumber}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};
