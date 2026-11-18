const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const ragService = {
    async obtenerAudiencias() {
        const response = await fetch(`${API_BASE_URL}/api/v1/audiencias`);
        if (!response.ok) {
            throw new Error(`Error al obtener audiencias (${response.status})`);
        }
        return response.json();
    },

    async consultarRag(payload) {
        const response = await fetch(`${API_BASE_URL}/api/v1/audiencia/rag-query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.mensaje || errorData.error || `Error HTTP ${response.status}`);
        }

        return response.json();
    },
};