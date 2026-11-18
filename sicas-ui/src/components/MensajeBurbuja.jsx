import { Sparkles } from 'lucide-react';
import { TarjetaFuentes } from './TarjetaFuentes';

export function MensajeBurbuja({ mensaje }) {
    const esUsuario = mensaje.rol === 'usuario';

    return (
        <div className={`flex ${esUsuario ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-3xl rounded-2xl px-5 py-4 shadow-sm ${esUsuario
                        ? 'bg-indigo-600 text-white'
                        : mensaje.error
                            ? 'bg-red-50 border border-red-200 text-red-900'
                            : 'bg-white border border-slate-200 text-slate-800'
                    }`}
            >
                {!esUsuario && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Análisis SICAS (Gemini 3.5 Flash)</span>
                    </div>
                )}

                <div className="text-sm leading-relaxed whitespace-pre-line">{mensaje.contenido}</div>

                {mensaje.fuentes && <TarjetaFuentes fuentes={mensaje.fuentes} />}

                <div
                    className={`text-[10px] mt-2 text-right ${esUsuario ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                >
                    {mensaje.timestamp}
                </div>
            </div>
        </div>
    );
}