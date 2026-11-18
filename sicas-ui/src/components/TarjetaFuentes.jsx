import { useState } from 'react';
import { FileAudio, Clock, ChevronDown, ChevronUp } from 'lucide-react';

export function TarjetaFuentes({ fuentes }) {
    const [abierto, setAbierto] = useState(false);

    if (!fuentes || fuentes.length === 0) return null;

    return (
        <div className="mt-3 border-t border-slate-200 pt-2">
            <button
                type="button"
                onClick={() => setAbierto(!abierto)}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:text-indigo-900 transition-colors"
            >
                <FileAudio className="w-3.5 h-3.5" />
                <span>Ver {fuentes.length} fragmentos de evidencia citados</span>
                {abierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {abierto && (
                <div className="mt-2.5 space-y-2">
                    {fuentes.map((fuente, idx) => (
                        <div
                            key={`${fuente.session_id}-${fuente.start_time_seconds}-${idx}`}
                            className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded">
                                        <Clock className="w-3 h-3" />
                                        Minuto {fuente.minuto}
                                    </span>
                                    <span className="text-slate-500 font-mono text-[11px]">
                                        Sesión: {fuente.session_id}
                                    </span>
                                </div>
                                <span className="bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded">
                                    Similitud: {fuente.similitud_pct}%
                                </span>
                            </div>
                            <p className="text-slate-700 leading-relaxed italic">"{fuente.transcript}"</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}