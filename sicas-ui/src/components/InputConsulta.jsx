import { useState } from 'react';
import { Send } from 'lucide-react';

const SUGERENCIAS = [
    '¿Cuáles fueron los temas principales y acuerdos tomados?',
    'Resume las intervenciones clave citando los minutos exactos.',
    '¿Qué resoluciones o fechas quedaron pendientes?',
];

export function InputConsulta({ enviando, onEnviarPregunta }) {
    const [texto, setTexto] = useState('');

    const manejarSubmit = (e) => {
        e.preventDefault();
        const limpio = texto.trim();
        if (!limpio || enviando) return;
        onEnviarPregunta(limpio);
        setTexto('');
    };

    return (
        <div className="bg-white border-t border-slate-200 p-4">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-wrap gap-2 mb-3">
                    {SUGERENCIAS.map((sug) => (
                        <button
                            key={sug}
                            type="button"
                            onClick={() => setTexto(sug)}
                            className="text-xs bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-full transition-colors"
                        >
                            {sug}
                        </button>
                    ))}
                </div>

                <form onSubmit={manejarSubmit} className="flex gap-3">
                    <input
                        type="text"
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        placeholder="Escribe tu consulta jurídica sobre la audiencia..."
                        disabled={enviando}
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        disabled={enviando || !texto.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-3 rounded-xl flex items-center gap-2 text-sm transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                        <span>Consultar</span>
                    </button>
                </form>
            </div>
        </div>
    );
}