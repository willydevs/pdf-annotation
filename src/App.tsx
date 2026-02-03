import { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { PDFViewer } from './components/PDFViewer';
import type { Highlight } from './types';
import * as pdfjs from 'pdfjs-dist';

// Core styles for react-pdf-highlighter
import 'react-pdf-highlighter/dist/style.css';

// If that fails, we might need to copy it to a local file.
// For now, let's assume Vite can resolve it.

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Default PDF (can be replaced by upload)
const DEFAULT_URL = "/Vade_mecum_EC134_2024.pdf";

function App() {
  const [url, setUrl] = useState<string>(DEFAULT_URL);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [scale, setScale] = useState<number>(1);
  const [selectionMode, setSelectionMode] = useState<'text' | 'area'>('text');

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('pdf-highlights');
    if (saved) {
      try {
        setHighlights(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load highlights", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pdf-highlights', JSON.stringify(highlights));
  }, [highlights]);

  const addHighlight = (highlight: Highlight) => {
    console.log("Saving highlight", highlight);
    setHighlights((prev) => [...prev, highlight]);
  };

  const removeHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const scrollRef = useRef<((highlight: Highlight) => void) | null>(null);

  const scrollToHighlight = (highlight: Highlight) => {
    if (scrollRef.current) {
      scrollRef.current(highlight);
    }
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setUrl(fileUrl);
      setHighlights([]); // Clear highlights for new file? Or keep? Usually clear or unique by file.
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Toolbar
        scale={scale}
        setScale={setScale}
        onUpload={handleUpload}
        selectionMode={selectionMode}
        setSelectionMode={setSelectionMode}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <PDFViewer
            url={url}
            highlights={highlights}
            onAddHighlight={addHighlight}
            scrollRef={(scrollTo) => { scrollRef.current = scrollTo; }}
            scale={scale}
            selectionMode={selectionMode}
          />
        </div>
        <Sidebar
          highlights={highlights}
          onRemoveHighlight={removeHighlight}
          onHighlightClick={scrollToHighlight}
        />
      </div>
    </div>
  );
}

export default App;
