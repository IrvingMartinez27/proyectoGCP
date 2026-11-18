import { Search } from 'lucide-react';

export function HeaderConsulta({ sesionSeleccionada }) {
    return (
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-slate-600">Consultando sobre:</span>
                <span className="text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md">
                    {sesionSeleccionada || 'TODAS LAS AUDIENCIAS INDEXADAS'}
                </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Cloud Run Conectado</span>
            </div>
        </header>
    );
}