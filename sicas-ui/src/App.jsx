import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { ragService } from './services/ragService';
import { SidebarAudiencias } from './components/SidebarAudiencias';
import { HeaderConsulta } from './components/HeaderConsulta';
import { MensajeBurbuja } from './components/MensajeBurbuja';
import { InputConsulta } from './components/InputConsulta';

export function App() {
  const [audiencias, setAudiencias] = useState([]);
  const [cargandoAudiencias, setCargandoAudiencias] = useState(true);
  const [errorAudiencias, setErrorAudiencias] = useState(null);

  const [sesionSeleccionada, setSesionSeleccionada] = useState('');
  const [topK, setTopK] = useState(5);
  const [enviando, setEnviando] = useState(false);

  const [mensajes, setMensajes] = useState([
    {
      id: 'bienvenida',
      rol: 'asistente',
      contenido:
        'Bienvenido al módulo de consulta analítica de SICAS. Selecciona una audiencia específica en el panel izquierdo o consulta sobre todo el repositorio judicial indexado.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const finChatRef = useRef(null);

  // Carga inicial del catálogo de audiencias desde Cloud Run
  useEffect(() => {
    const cargarCatalogo = async () => {
      try {
        setCargandoAudiencias(true);
        const data = await ragService.obtenerAudiencias();
        setAudiencias(data.audiencias || []);
        setErrorAudiencias(null);
      } catch (err) {
        setErrorAudiencias(err.message || 'No se pudo conectar con Cloud Run');
      } finally {
        setCargandoAudiencias(false);
      }
    };

    cargarCatalogo();
  }, []);

  // Auto-scroll al recibir nuevos mensajes
  useEffect(() => {
    finChatRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const manejarConsulta = async (preguntaTexto) => {
    const nuevoMensajeUsuario = {
      id: crypto.randomUUID(),
      rol: 'usuario',
      contenido: preguntaTexto,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMensajes((prev) => [...prev, nuevoMensajeUsuario]);
    setEnviando(true);

    try {
      const resultado = await ragService.consultarRag({
        query: preguntaTexto,
        ...(sesionSeleccionada ? { sessionId: sesionSeleccionada } : {}),
        topK,
      });

      const respuestaAsistente = {
        id: crypto.randomUUID(),
        rol: 'asistente',
        contenido: resultado.respuesta,
        fuentes: resultado.fuentes,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMensajes((prev) => [...prev, respuestaAsistente]);
    } catch (err) {
      const mensajeError = {
        id: crypto.randomUUID(),
        rol: 'asistente',
        contenido: `No se pudo completar la consulta: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true,
      };
      setMensajes((prev) => [...prev, mensajeError]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 font-sans">
      <SidebarAudiencias
        audiencias={audiencias}
        cargando={cargandoAudiencias}
        error={errorAudiencias}
        sesionSeleccionada={sesionSeleccionada}
        onSeleccionarSesion={setSesionSeleccionada}
        topK={topK}
        onCambiarTopK={setTopK}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <HeaderConsulta sesionSeleccionada={sesionSeleccionada} />

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {mensajes.map((msg) => (
            <MensajeBurbuja key={msg.id} mensaje={msg} />
          ))}

          {enviando && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm flex items-center gap-3 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                <span>Ejecutando búsqueda vectorial en BigQuery y generando síntesis...</span>
              </div>
            </div>
          )}

          <div ref={finChatRef} />
        </div>

        <InputConsulta enviando={enviando} onEnviarPregunta={manejarConsulta} />
      </main>
    </div>
  );
}

export default App;