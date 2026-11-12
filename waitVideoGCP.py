import os
import json
import io

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

from google.cloud import pubsub_v1
from google.cloud import storage
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

TOKEN_FILE = os.getenv("GOOGLE_TOKEN_FILE", "token.json")
SUBSCRIPTION_NAME = os.getenv("PUBSUB_SUBSCRIPTION")
BUCKET_RAW_MEDIA = os.getenv("BUCKET_RAW_MEDIA")
PROJECT_ID = os.getenv("PROJECT_ID")

def obtener_credenciales():
    """Carga y refresca automáticamente las credenciales de OAuth2."""
    if not os.path.exists(TOKEN_FILE):
        raise FileNotFoundError(f"Archivo de credenciales '{TOKEN_FILE}' no encontrado.")
    
    creds = Credentials.from_authorized_user_file(TOKEN_FILE)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                f.write(creds.to_json())
        except Exception as e:
            print(f"⚠️ Advertencia al refrescar el token: {e}")
    return creds

def descargar_y_subir_video(file_id):
    """Descarga el MP4 de Google Drive y lo transfiere a Cloud Storage en la carpeta raw/."""
    creds = obtener_credenciales()
    drive_service = build('drive', 'v3', credentials=creds)

    print(f"\n⬇️ Descargando archivo de Drive (ID: {file_id})...")
    request = drive_service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
        print(f"Progreso de descarga: {int(status.progress() * 100)}%")
    
    print("✅ Descarga completada. Iniciando subida a Cloud Storage...")
    
    try:
        fh.seek(0)
        storage_client = storage.Client(credentials=creds, project=PROJECT_ID)
        bucket = storage_client.bucket(BUCKET_RAW_MEDIA)
        
        # Se guarda dentro de la subcarpeta raw/
        blob_path = f"raw/{file_id}.mp4"
        blob = bucket.blob(blob_path)
        
        blob.upload_from_file(fh, content_type='video/mp4')
        print(f"☁️ ¡Archivo resguardado exitosamente en gs://{BUCKET_RAW_MEDIA}/{blob_path}!")
    except Exception as e:
        print(f"❌ Error al subir a GCS: {e}")

def procesar_mensaje(mensaje):
    """Callback de procesamiento para eventos recibidos por Pub/Sub."""
    print("\n📩 Mensaje recibido en la suscripción de Pub/Sub...")
    try:
        evento_tipo = mensaje.attributes.get("ce-type") or mensaje.attributes.get("eventType")
        print(f"🔔 Tipo de evento: {evento_tipo}")

        if evento_tipo == "google.workspace.meet.recording.v2.fileGenerated" or not evento_tipo:
            datos = json.loads(mensaje.data.decode("utf-8")) if mensaje.data else {}
            print("📦 Payload decodificado:")
            print(json.dumps(datos, indent=2))

            recording_name = datos.get("recording", {}).get("name")
            if not recording_name and "resource" in datos:
                res = datos.get("resource", "")
                if "//meet.googleapis.com/" in res:
                    recording_name = res.split("//meet.googleapis.com/")[-1]
                else:
                    recording_name = res

            if not recording_name:
                raise Exception("No se encontró el identificador del recurso de grabación en el payload.")

            print(f"🎬 Recurso de grabación: {recording_name}")
            creds = obtener_credenciales()
            meet_service = build("meet", "v2", credentials=creds)

            print("🔎 Consultando metadatos de la grabación en Meet API...")
            recording = (
                meet_service
                .conferenceRecords()
                .recordings()
                .get(name=recording_name)
                .execute()
            )

            drive_destination = recording.get("driveDestination", {})
            file_id = drive_destination.get("file")

            if file_id:
                print(f"📁 ID de archivo en Google Drive: {file_id}")
                descargar_y_subir_video(file_id)
            else:
                raise Exception("No se detectó driveDestination.file en los metadatos de la grabación.")

            mensaje.ack()
            print("✅ Mensaje confirmado (ACK).")
            print("-" * 50)
        else:
            print(f"ℹ️ Evento descartado (no relevante): {evento_tipo}")
            mensaje.ack()

    except Exception as e:
        print(f"❌ Error durante el procesamiento del mensaje: {e}")
        # En caso de error se puede optar por no hacer ack para reintentar

if __name__ == "__main__":
    if not os.path.exists(TOKEN_FILE):
        print(f"❌ Archivo {TOKEN_FILE} no encontrado. Ejecuta primero scheduleMeetingGCP.py.")
        exit(1)

    if not SUBSCRIPTION_NAME:
        print("❌ Error: PUBSUB_SUBSCRIPTION no está configurado en .env.")
        exit(1)

    print(f"🚀 Iniciando suscriptor con Proyecto: {PROJECT_ID}")
    print(f"📦 Bucket destino: {BUCKET_RAW_MEDIA}/raw/")
    print(f"🎧 Escuchando en la suscripción: {SUBSCRIPTION_NAME}")

    creds = obtener_credenciales()
    suscriptor = pubsub_v1.SubscriberClient(credentials=creds)
    streaming_pull_future = suscriptor.subscribe(SUBSCRIPTION_NAME, callback=procesar_mensaje)
    print("Presiona Ctrl+C para finalizar.\n")

    try:
        streaming_pull_future.result()
    except KeyboardInterrupt:
        streaming_pull_future.cancel()
        print("\nServicio de escucha detenido.")
