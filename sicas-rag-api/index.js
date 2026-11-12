require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');

const path = require('path');

// Asegurar que si GOOGLE_APPLICATION_CREDENTIALS es relativo, se resuelva al directorio actual
if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

const app = express();
const port = process.env.PORT || 8081;
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'test-gcp-513719';

const bigquery = new BigQuery({ projectId });

app.use(cors());
app.use(express.json());

// 1. Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'sicas-rag-api' });
});

// 2. Listar sesiones/audiencias procesadas para el selector de la UI
app.get('/api/v1/audiencias', async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        session_id,
        COUNT(*) AS total_fragmentos,
        ROUND(MAX(end_time_seconds) / 60, 1) AS duracion_minutos
      FROM \`${projectId}.judicial_records.transcripciones_embeddings\`
      WHERE session_id IS NOT NULL
      GROUP BY session_id
      ORDER BY session_id DESC
    `;

    const [rows] = await bigquery.query({ query: sqlQuery });

    res.status(200).json({
      total: rows.length,
      audiencias: rows
    });
  } catch (error) {
    console.error('Error al listar audiencias:', error);
    res.status(500).json({
      error: 'Error al consultar el catálogo de audiencias',
      detalle: error.message
    });
  }
});

// 3. Consulta RAG con síntesis de Gemini + metadatos de fuentes citadas
app.post('/api/v1/audiencia/rag-query', async (req, res) => {
  try {
    const { sessionId, query, topK = 5 } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Solicitud inválida: el campo "query" es requerido.'
      });
    }

    const sessionFilter = sessionId
      ? 'AND base.session_id = @sessionId'
      : '';

    const sqlQuery = `
      WITH retrieval AS (
        SELECT 
          base.session_id,
          base.start_time_seconds,
          base.end_time_seconds,
          base.transcript,
          ROUND((1 - distance) * 100, 1) AS similitud_pct
        FROM VECTOR_SEARCH(
          TABLE \`${projectId}.judicial_records.transcripciones_embeddings\`,
          'text_embedding',
          (
            SELECT ml_generate_embedding_result AS query_embedding
            FROM ML.GENERATE_EMBEDDING(
              MODEL \`${projectId}.judicial_records.embedding_model\`,
              (SELECT @queryText AS content)
            )
          ),
          top_k => @topK,
          distance_type => 'COSINE',
          options => '{"use_brute_force": true}'
        )
        WHERE 1 = 1 ${sessionFilter}
        ORDER BY similitud_pct DESC
      ),
      aggregated_context AS (
        SELECT 
          STRING_AGG(
            CONCAT('[Minuto ', ROUND(start_time_seconds / 60, 1), ']: ', transcript),
            '\\n'
          ) AS contexto_recuperado,
          ARRAY_AGG(
            STRUCT(
              session_id,
              ROUND(start_time_seconds / 60, 1) AS minuto,
              start_time_seconds,
              transcript,
              similitud_pct
            )
          ) AS fuentes
        FROM retrieval
      )
      SELECT
        gen.ml_generate_text_result AS resumen_judicial,
        agg.fuentes
      FROM ML.GENERATE_TEXT(
        MODEL \`${projectId}.judicial_records.gemini_flash\`,
        (
          SELECT 
            CONCAT(
              'Eres un asistente judicial analítico de la plataforma SICAS. Con base estricta en los siguientes fragmentos transcritos de la audiencia:\\n\\n',
              contexto_recuperado,
              '\\n\\nInstrucción: Responde de forma clara, objetiva y estructurada a la pregunta planteada citando los minutos exactos correspondientes.\\n\\nPregunta: ',
              @queryText
            ) AS prompt
          FROM aggregated_context
        ),
        STRUCT(
          0.2 AS temperature,
          1024 AS max_output_tokens
        )
      ) AS gen
      CROSS JOIN aggregated_context AS agg;
    `;

    const options = {
      query: sqlQuery,
      params: {
        queryText: query,
        topK: Number(topK),
        ...(sessionId && { sessionId })
      }
    };

    const [rows] = await bigquery.query(options);

    if (!rows || rows.length === 0 || !rows[0].resumen_judicial) {
      return res.status(404).json({
        mensaje: 'No se encontraron fragmentos relevantes para responder la consulta.'
      });
    }

    res.status(200).json({
      pregunta: query,
      sessionId: sessionId || 'todas',
      respuesta: rows[0].resumen_judicial,
      fuentes: rows[0].fuentes || []
    });

  } catch (error) {
    console.error('Error al procesar consulta RAG:', error);
    res.status(500).json({
      error: 'Error interno al procesar la consulta con Vertex AI / BigQuery',
      detalle: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor SICAS RAG API corriendo en el puerto ${port}`);
});