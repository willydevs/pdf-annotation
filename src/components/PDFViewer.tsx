import {
    PdfLoader,
    PdfHighlighter,
    Highlight,
    Popup,
    AreaHighlight,
} from "react-pdf-highlighter";
import { Tip } from "./Tip";
import type { Highlight as HighlightType } from "../types";
import { LinkableText } from "./LinkableText";
import { Loader2 } from "lucide-react";

interface Props {
    url: string;
    highlights: HighlightType[];
    onAddHighlight: (highlight: HighlightType) => void;
    scrollRef: (scrollTo: (highlight: HighlightType) => void) => void;
    scale: number;
    selectionMode: 'text' | 'area';
}

const parseIdFromHash = () => document.location.hash.slice("#highlight-".length);

const resetHash = () => {
    document.location.hash = "";
};

export const PDFViewer = ({ url, highlights, onAddHighlight, scrollRef, scale, selectionMode }: Props) => {
    return (
        <div className="relative h-full w-full bg-gray-100 overflow-hidden">
            <PdfLoader url={url} beforeLoad={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-blue-500" size={40} /></div>}>
                {(pdfDocument) => (
                    <PdfHighlighter
                        pdfDocument={pdfDocument}
                        enableAreaSelection={(event) => selectionMode === 'area' || event.altKey}
                        onScrollChange={resetHash}
                        pdfScaleValue={scale as any}
                        scrollRef={(scrollTo) => {
                            scrollRef(scrollTo);

                            const highlightId = parseIdFromHash();
                            const highlight = highlights.find((h) => h.id === highlightId);
                            if (highlight) {
                                scrollTo(highlight);
                            }
                        }}
                        onSelectionFinished={(
                            position,
                            content,
                            hideTipAndSelection,
                            _
                        ) => (
                            <Tip
                                onConfirm={(comment) => {
                                    onAddHighlight({ content, position, comment, id: crypto.randomUUID() });
                                    hideTipAndSelection();
                                }}
                            />
                        )}
                        highlightTransform={(
                            highlight,
                            index,
                            setTip,
                            hideTip,
                            _,
                            __,
                            isScrolledTo
                        ) => {
                            const isTextHighlight = !highlight.content.image;

                            const component = isTextHighlight ? (
                                <Highlight
                                    isScrolledTo={isScrolledTo}
                                    position={highlight.position}
                                    comment={highlight.comment}
                                />
                            ) : (
                                <AreaHighlight
                                    isScrolledTo={isScrolledTo}
                                    highlight={highlight}
                                    onChange={(boundingRect) => {
                                        console.log("Resize Area", boundingRect);
                                    }}
                                />
                            );

                            return (
                                <Popup
                                    popupContent={
                                        <div className="bg-white rounded-lg shadow-xl border border-gray-100 p-4 max-w-sm">
                                            {highlight.content?.text ? (
                                                <div className="mb-3">
                                                    <h4 className="font-bold text-gray-900 mb-1 text-xs uppercase tracking-wide">
                                                        Trecho
                                                    </h4>
                                                    <p className="text-gray-600 text-sm leading-relaxed line-clamp-4 border-l-2 border-gray-200 pl-2">
                                                        "{highlight.content.text}"
                                                    </p>
                                                </div>
                                            ) : null}

                                            <div>
                                                <h4 className="font-bold text-gray-900 mb-1 text-xs uppercase tracking-wide">
                                                    Nota
                                                </h4>
                                                <div className="text-gray-800 text-sm">
                                                    <span className="mr-2 text-base">{highlight.comment.emoji}</span>
                                                    <LinkableText text={highlight.comment.text} />
                                                </div>
                                            </div>
                                        </div>
                                    }
                                    onMouseOver={(popupContent) =>
                                        setTip(highlight, () => popupContent)
                                    }
                                    onMouseOut={hideTip}
                                    key={index}
                                    children={component}
                                />
                            );
                        }}
                        highlights={highlights}
                    />
                )}
            </PdfLoader>
        </div>
    );
};
