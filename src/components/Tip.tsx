import { useState } from "react";
import { Check } from "lucide-react";

const COLORS = [
    { name: 'Amarelo', value: 'yellow', hex: '#FFE28F' },
    { name: 'Verde', value: 'green', hex: '#86EFAC' },
    { name: 'Azul', value: 'blue', hex: '#93C5FD' },
    { name: 'Rosa', value: 'pink', hex: '#F9A8D4' },
    { name: 'Laranja', value: 'orange', hex: '#FDBA74' },
];

interface Props {
    onConfirm: (comment: { text: string; emoji: string; color: string }) => void;
}

export const Tip = ({ onConfirm }: Props) => {
    const [text, setText] = useState("");
    const [emoji, setEmoji] = useState("📝");
    const [color, setColor] = useState("yellow");

    const emojis = ["📝", "💡", "❓", "❗", "✅"];

    return (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-64 animate-in fade-in zoom-in duration-200">
            <div className="flex space-x-2 mb-2">
                {COLORS.map((c) => (
                    <button
                        key={c.value}
                        title={c.name}
                        onClick={() => setColor(c.value)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c.value ? 'border-gray-500 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c.hex }}
                    />
                ))}
            </div>

            <div className="flex space-x-2 mb-3 overflow-x-auto pb-1">
                {emojis.map((e) => (
                    <button
                        key={e}
                        onClick={() => setEmoji(e)}
                        className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${emoji === e ? "bg-blue-100 ring-2 ring-blue-400" : ""}`}
                    >
                        {e}
                    </button>
                ))}
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    onConfirm({ text, emoji, color });
                }}
            >
                <textarea
                    placeholder="Adicione um comentário..."
                    autoFocus
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 min-h-[80px] mb-2 p-2 resize-none bg-gray-50"
                />
                <div className="flex justify-end">
                    <button
                        type="submit"
                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                        <Check size={14} />
                        <span>Salvar</span>
                    </button>
                </div>
            </form>
        </div>
    );
};
