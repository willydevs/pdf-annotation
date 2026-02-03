export interface Highlight {
    content: {
        text?: string;
        image?: string;
    };
    position: {
        boundingRect: {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            width: number;
            height: number;
        };
        rects: {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            width: number;
            height: number;
        }[];
        pageNumber: number;
    };
    comment: {
        text: string;
        emoji: string;
    };
    id: string;
}
