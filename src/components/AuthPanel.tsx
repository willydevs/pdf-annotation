import { useEffect, useRef, useState, type FormEvent } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { loginUser, loginWithGoogle, registerUser } from "../api";
import type { Session } from "../types";

interface AuthPanelProps {
    onAuthenticated: (session: Session) => void;
}

interface GoogleAccounts {
    id: {
        initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
        renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number }) => void;
    };
}

declare global {
    interface Window {
        google?: { accounts: GoogleAccounts };
    }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function AuthPanel({ onAuthenticated }: AuthPanelProps) {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const googleButtonRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!googleClientId || !googleButtonRef.current) {
            return;
        }

        const renderButton = () => {
            if (!window.google || !googleButtonRef.current) {
                return;
            }

            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: async (response) => {
                    if (!response.credential) {
                        setError("Não foi possível entrar com o Google.");
                        return;
                    }

                    try {
                        setError("");
                        setIsLoading(true);
                        const session = await loginWithGoogle(response.credential);
                        onAuthenticated(session);
                    } catch (err) {
                        setError(err instanceof Error ? err.message : "Falha no login com Google.");
                    } finally {
                        setIsLoading(false);
                    }
                },
            });
            window.google.accounts.id.renderButton(googleButtonRef.current, {
                theme: "outline",
                size: "large",
                width: 320,
            });
        };

        if (window.google) {
            renderButton();
            return;
        }

        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = renderButton;
        document.head.appendChild(script);
    }, [onAuthenticated]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const session =
                mode === "login"
                    ? await loginUser(email, password)
                    : await registerUser(name, email, password);
            onAuthenticated(session);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Não foi possível autenticar.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <section className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Leitor de PDF</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Entre para salvar suas anotações na sua conta.
                    </p>
                </div>

                <div className="grid grid-cols-2 bg-gray-100 rounded-lg p-1 mb-5">
                    <button
                        type="button"
                        onClick={() => setMode("login")}
                        className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === "login" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"}`}
                    >
                        <LogIn size={16} />
                        Entrar
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("register")}
                        className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === "register" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"}`}
                    >
                        <UserPlus size={16} />
                        Criar conta
                    </button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                    {mode === "register" && (
                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Nome</span>
                            <input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                required
                            />
                        </label>
                    )}

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">E-mail</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            required
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">Senha</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            minLength={8}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            required
                        />
                    </label>

                    {error && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                        {isLoading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
                    </button>
                </form>

                {googleClientId && (
                    <div className="mt-5">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="h-px flex-1 bg-gray-200" />
                            <span className="text-xs font-medium text-gray-400">ou</span>
                            <div className="h-px flex-1 bg-gray-200" />
                        </div>
                        <div ref={googleButtonRef} className="flex justify-center" />
                    </div>
                )}
            </section>
        </main>
    );
}
