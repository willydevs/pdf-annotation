import { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { PDFViewer } from './components/PDFViewer';
import { AuthPanel } from './components/AuthPanel';
import { authStorage, fetchCurrentUser, fetchHighlights, saveHighlights } from './api';
import type { Highlight, Session } from './types';
import * as pdfjs from 'pdfjs-dist';

// Core styles for react-pdf-highlighter
import 'react-pdf-highlighter/dist/style.css';

// If that fails, we might need to copy it to a local file.
// For now, let's assume Vite can resolve it.

// Set up worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Default PDF (can be replaced by upload)
const DEFAULT_URL = "/Vade_mecum_2026_uma_coluna.pdf";

function App() {
  const [session, setSession] = useState<Session | null>(() => authStorage.get());
  const token = session?.token;
  const [url, setUrl] = useState<string>(DEFAULT_URL);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [scale, setScale] = useState<number>(1);
  const [selectionMode, setSelectionMode] = useState<'text' | 'area'>('text');
  const [docId, setDocId] = useState<string>('vade_mecum_default');
  const [annotationsLoaded, setAnnotationsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    fetchCurrentUser(token)
      .then((user) => {
        if (!cancelled) {
          setSession((currentSession) => {
            if (!currentSession) {
              return currentSession;
            }

            const refreshed = { ...currentSession, user };
            authStorage.set(refreshed);
            return refreshed;
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          authStorage.clear();
          setSession(null);
        }
      });

    fetchHighlights(token, docId)
      .then((savedHighlights) => {
        if (!cancelled) {
          setHighlights(savedHighlights);
          setAnnotationsLoaded(true);
        }
      })
      .catch((error) => {
        console.error("Failed to load highlights", error);
        if (!cancelled) {
          setHighlights([]);
          setAnnotationsLoaded(true);
          setSyncStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [docId, token]);

  useEffect(() => {
    if (!token || !annotationsLoaded) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSyncStatus('saving');
      saveHighlights(token, docId, highlights)
        .then(() => setSyncStatus('saved'))
        .catch((error) => {
          console.error("Failed to save highlights", error);
          setSyncStatus('error');
        });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [highlights, docId, token, annotationsLoaded]);

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
      setAnnotationsLoaded(false);
      setSyncStatus('idle');
      // Use filename as ID. Fallback to random if missing (unlikely)
      setDocId(file.name || crypto.randomUUID());
    }
  };

  const handleAuthenticated = (nextSession: Session) => {
    authStorage.set(nextSession);
    setAnnotationsLoaded(false);
    setSyncStatus('idle');
    setSession(nextSession);
  };

  const handleLogout = () => {
    authStorage.clear();
    setSession(null);
    setHighlights([]);
    setAnnotationsLoaded(false);
  };

  if (!session) {
    return <AuthPanel onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Toolbar
        scale={scale}
        setScale={setScale}
        onUpload={handleUpload}
        selectionMode={selectionMode}
        setSelectionMode={setSelectionMode}
        user={session.user}
        syncStatus={syncStatus}
        onLogout={handleLogout}
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
