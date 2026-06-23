import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bot, FileText, Highlighter, MessageSquarePlus, Send, Sparkles } from 'lucide-react';
import {
    createAiConversation,
    fetchAiConversations,
    fetchAiMessages,
    sendAiMessage,
} from '../api';
import type { AiAction, AiConversation, AiMessage } from '../types';

interface AiPanelProps {
    token: string;
    docId: string;
    onAction: (action: AiAction) => void;
}

export function AiPanel({ token, docId, onAction }: AiPanelProps) {
    const [conversations, setConversations] = useState<AiConversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<number | undefined>();
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        fetchAiConversations(token)
            .then((items) => {
                setConversations(items);
                setActiveConversationId((current) => current ?? items[0]?.id);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar conversas.'));
    }, [token]);

    useEffect(() => {
        if (!activeConversationId) {
            setMessages([]);
            return;
        }

        fetchAiMessages(token, activeConversationId)
            .then(setMessages)
            .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar mensagens.'));
    }, [activeConversationId, token]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'end' });
    }, [messages, isLoading]);

    const activeConversation = useMemo(
        () => conversations.find((conversation) => conversation.id === activeConversationId),
        [activeConversationId, conversations],
    );

    const startConversation = async () => {
        setError('');
        const conversation = await createAiConversation(token);
        setConversations((current) => [conversation, ...current]);
        setActiveConversationId(conversation.id);
        setMessages([]);
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const content = input.trim();
        if (!content || isLoading) {
            return;
        }

        const optimisticMessage: AiMessage = {
            id: Date.now(),
            role: 'user',
            content,
            actions: [],
            createdAt: new Date().toISOString(),
        };

        setInput('');
        setError('');
        setIsLoading(true);
        setMessages((current) => [...current, optimisticMessage]);

        try {
            const response = await sendAiMessage(token, content, docId, activeConversationId);
            setActiveConversationId(response.conversationId);
            setMessages((current) => [...current, response.message]);
            const updated = await fetchAiConversations(token);
            setConversations(updated);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao consultar IA.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <aside className="w-full xl:w-96 bg-white border-t xl:border-l xl:border-t-0 border-gray-200 h-[45%] xl:h-full flex flex-col">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Sparkles size={18} className="text-blue-600" />
                            IA Jurídica
                        </h2>
                        <p className="text-xs text-gray-500 truncate max-w-64">
                            {activeConversation?.title || 'Converse com o Vade Mecum'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={startConversation}
                        className="p-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                        title="Nova conversa"
                    >
                        <MessageSquarePlus size={16} />
                    </button>
                </div>

                {conversations.length > 0 && (
                    <select
                        value={activeConversationId ?? ''}
                        onChange={(event) => setActiveConversationId(Number(event.target.value))}
                        className="mt-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                        {conversations.map((conversation) => (
                            <option key={conversation.id} value={conversation.id}>
                                {conversation.title}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.length === 0 ? (
                    <div className="text-sm text-gray-500 space-y-3">
                        <p>Pergunte sobre artigos, peça um resumo ou solicite uma anotação.</p>
                        <button
                            type="button"
                            onClick={() => setInput('Explique o art. 5º da Constituição e crie uma anotação nos pontos principais.')}
                            className="w-full text-left rounded-md border border-gray-200 bg-white p-3 hover:border-blue-200"
                        >
                            Explicar o art. 5º e sugerir anotação
                        </button>
                        <button
                            type="button"
                            onClick={() => setInput('Procure no Vade Mecum os direitos sociais e me leve até a página relevante.')}
                            className="w-full text-left rounded-md border border-gray-200 bg-white p-3 hover:border-blue-200"
                        >
                            Buscar direitos sociais no Vade Mecum
                        </button>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={`${message.id}-${message.role}`}
                            className={`rounded-lg border p-3 text-sm ${message.role === 'user'
                                ? 'bg-blue-600 text-white border-blue-600 ml-8'
                                : 'bg-white text-gray-800 border-gray-200 mr-8'
                                }`}
                        >
                            <div className="flex items-center gap-2 font-semibold mb-1">
                                {message.role === 'assistant' ? <Bot size={15} /> : null}
                                {message.role === 'assistant' ? 'IA' : 'Você'}
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

                            {message.actions.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {message.actions.map((action, index) => (
                                        <button
                                            key={`${action.type}-${index}`}
                                            type="button"
                                            onClick={() => onAction(action)}
                                            className="w-full flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs font-medium text-blue-700 hover:bg-blue-100"
                                        >
                                            {action.type === 'go_to_page' ? <FileText size={14} /> : <Highlighter size={14} />}
                                            <span>{action.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}

                {isLoading && (
                    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-500">
                        Consultando o Vade Mecum...
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {error && (
                <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                </div>
            )}

            <form onSubmit={submit} className="p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-2">
                    <textarea
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        placeholder="Pergunte, peça para encontrar artigo ou criar anotação..."
                        className="min-h-11 max-h-28 flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="h-11 w-11 shrink-0 rounded-md bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:bg-blue-300"
                        title="Enviar"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </form>
        </aside>
    );
}
