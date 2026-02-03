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
  const [docId, setDocId] = useState<string>('vade_mecum_default');

  // Persistence: Load on docId change
  useEffect(() => {
    const key = `pdf-highlights-${docId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setHighlights(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load highlights", e);
        setHighlights([]);
      }
    } else {
      setHighlights([]);
    }
  }, [docId]);

  // Persistence: Save on highlight change
  useEffect(() => {
    if (highlights.length > 0 || localStorage.getItem(`pdf-highlights-${docId}`)) {
      localStorage.setItem(`pdf-highlights-${docId}`, JSON.stringify(highlights));
    }
  }, [highlights, docId]);

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
      // Use filename as ID. Fallback to random if missing (unlikely)
      setDocId(file.name || crypto.randomUUID());
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

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <div className="flex-1 relative h-[60%] md:h-full w-full">
          <PDFViewer
            url={url}
            highlights={highlights}
            onAddHighlight={addHighlight}
            scrollRef={(scrollTo) => { scrollRef.current = scrollTo; }}
            scale={scale}
            selectionMode={selectionMode}
          />
        </div>
        <div className="h-[40%] md:h-auto md:w-auto w-full overflow-hidden">
          <Sidebar
            highlights={highlights}
            onRemoveHighlight={removeHighlight}
            onHighlightClick={scrollToHighlight}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
