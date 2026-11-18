import { Scale, Database, Clock, Layers, Loader2, AlertCircle } from 'lucide-react';

export function SidebarAudiencias({
    audiencias,
    cargando,
    error,
    sesionSeleccionada,
    onSeleccionarSesion,
    topK,
    onCambiarTopK,
}) {
    return (
        <aside className="w-80 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shrink-0">
            <div className="p-5 border-b border-slate-800 flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-lg">
                    <Scale className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="font-bold text-lg tracking-tight">SICAS Judicial</h1>
                    <p className="text-xs text-slate-400">Motor RAG • Vertex AI + BQ</p>
                </div>
            </div>

            <div className="p-4 border-b border-slate-800">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Ámbito de Búsqueda
                </label>
                <button
                    type="button"
                    onClick={() => onSeleccionarSesion('')}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between transition-colors ${sesionSeleccionada === ''
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Todas las audiencias
                    </span>
                    <span className="text-xs bg-slate-950/40 px-2 py-0.5 rounded">
                        {audiencias.length}
                    </span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    <span>Sesiones Indexadas</span>
                    {cargando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </div>

                {error && (
                    <div className="bg-red-950/60 border border-red-800 text-red-200 p-3 rounded-lg text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {!cargando && !error && audiencias.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-6">
                        No hay audiencias registradas en BigQuery todavía.
                    </p>
                )}

                {audiencias.map((aud) => {
                    const activa = sesionSeleccionada === aud.session_id;
                    return (
                        <button
                            key={aud.session_id}
                            type="button"
                            onClick={() => onSeleccionarSesion(aud.session_id)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${activa
                                    ? 'bg-indigo-950/80 border-indigo-500 text-white'
                                    : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                                }`}
                        >
                            <div className="font-mono text-xs font-semibold truncate text-indigo-300 mb-1.5">
                                {aud.session_id}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {aud.duracion_minutos} min
                                </span>
                                <span className="flex items-center gap-1">
                                    <Layers className="w-3 h-3" />
                                    {aud.total_fragmentos} clips
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/40">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Fragmentos de contexto (Top-K)</span>
                    <span className="font-semibold text-indigo-400">{topK}</span>
                </div>
                <input
                    type="range"
                    min={2}
                    max={10}
                    value={topK}
                    onChange={(e) => onCambiarTopK(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                />
            </div>
        </aside>
    );
}