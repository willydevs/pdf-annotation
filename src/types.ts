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
    color?: string;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatarUrl?: string | null;
}

export interface Session {
    token: string;
    user: User;
}

export type AiAction =
    | {
        type: 'go_to_page';
        label: string;
        pageNumber: number;
    }
    | {
        type: 'create_annotation';
        label: string;
        pageNumber: number;
        quote: string;
        note: string;
    };

export interface AiConversation {
    id: number;
    title: string;
    createdAt: string;
    updatedAt: string;
}

export interface AiMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    actions: AiAction[];
    createdAt: string;
}
