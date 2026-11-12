import datetime
import json
import os
import uuid

# Soporte para .env con fallback si no está instalado python-dotenv[cite: 1]
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

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Carga de variables de entorno con fallbacks configurados[cite: 1]
PROJECT_ID = os.getenv("PROJECT_ID")
CLIENT_SECRET_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE", "credentials.json")
TOKEN_FILE = os.getenv("GOOGLE_TOKEN_FILE", "token.json")
CALENDAR_ID = os.getenv("CALENDAR_ID", "primary")
PUBSUB_TOPIC = os.getenv("PUBSUB_TOPIC", f"projects/{PROJECT_ID}/topics/workspace-events" if PROJECT_ID else None)
TIME_ZONE = os.getenv("TIME_ZONE", "America/Mexico_City")

# Scopes requeridos para Calendar, Drive, Meet y Pub/Sub[cite: 1]
SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/meetings.space.readonly',
    'https://www.googleapis.com/auth/pubsub',
    'https://www.googleapis.com/auth/devstorage.read_write',
    'https://www.googleapis.com/auth/cloud-platform'
]

def autenticar_usuario():
    """Maneja el inicio de sesión en el navegador y almacena el token localmente."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        try:
            creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
        except Exception:
            creds = None
    
    if not creds or not creds.valid:
        renovado = False
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                renovado = True
            except Exception as e:
                print(f"[!] El token guardado ya no es valido o expiro: {e}. Se solicitara nuevo inicio de sesion...")
                creds = None

        if not renovado:
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
            
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
            
    return creds

def crear_evento_google_meet(titulo, descripcion, fecha_inicio, fecha_fin, invitados):
    """Crea un evento en Google Calendar y genera la sala de Google Meet asociada."""
    creds = autenticar_usuario()
    service = build('calendar', 'v3', credentials=creds)

    event = {
        'summary': titulo,
        'description': descripcion,
        'start': {
            'dateTime': fecha_inicio.isoformat(),
            'timeZone': TIME_ZONE,
        },
        'end': {
            'dateTime': fecha_fin.isoformat(),
            'timeZone': TIME_ZONE,
        },
        'attendees': [{'email': email} for email in invitados],
        'conferenceData': {
            'createRequest': {
                'requestId': str(uuid.uuid4()),
                'conferenceSolutionKey': {
                    'type': 'hangoutsMeet'
                }
            }
        }
    }

    try:
        event_result = service.events().insert(
            calendarId=CALENDAR_ID, 
            body=event, 
            conferenceDataVersion=1
        ).execute()

        print("✅ Evento creado exitosamente en Google Calendar")
        print(f"Título: {titulo}")
        print(f"Link del calendario: {event_result.get('htmlLink')}")
        print(f"Link directo de Google Meet: {event_result.get('hangoutLink')}")
        
        return event_result.get('hangoutLink')

    except Exception as e:
        print(f"❌ Error al crear el evento: {e}")
        return None

def obtener_meet_space(creds, meeting_code):
    """Obtiene el nombre canónico del recurso Meet Space."""
    meet_service = build('meet', 'v2', credentials=creds)

    try:
        respuesta = meet_service.spaces().get(
            name=f'spaces/{meeting_code}'
        ).execute()

        print(f"✅ Recurso Meet Space localizado: {respuesta.get('name')}")
        return respuesta.get('name')

    except Exception as e:
        print(f"❌ Error obteniendo el Meet Space: {e}")
        return None

def suscribir_a_grabaciones(creds, meet_link, pubsub_topic):
    """Crea la suscripción en Workspace Events para escuchar la generación de grabaciones."""
    meeting_code = meet_link.split('/')[-1]
    print(f"🔎 Código de reunión: {meeting_code}")

    canonical_space_name = obtener_meet_space(creds, meeting_code)
    if not canonical_space_name:
        raise Exception("No se pudo obtener el canonical_space_name de la sesión.")

    target_resource = f"//meet.googleapis.com/{canonical_space_name}"
    print(f"🎯 Target Resource: {target_resource}")

    events_service = build('workspaceevents', 'v1', credentials=creds)

    suscripcion = {
        "targetResource": target_resource,
        "eventTypes": ["google.workspace.meet.recording.v2.fileGenerated"],
        "notificationEndpoint": {
            "pubsubTopic": pubsub_topic
        },
        "payloadOptions": {
            "includeResource": False
        }
    }
    
    try:
        print(f"⏳ Registrando suscripción para {target_resource}...")
        respuesta = events_service.subscriptions().create(body=suscripcion).execute()
        print("✅ ¡Suscripción en Workspace Events creada correctamente!")
        print(f"ID de Suscripción: {respuesta.get('name')}")
    except Exception as e:
        print(f"❌ Error al crear la suscripción: {e}")

if __name__ == "__main__":
    if not PUBSUB_TOPIC:
        print("❌ Error: PUBSUB_TOPIC o PROJECT_ID no están definidos en las variables de entorno.")
        exit(1)

    MEETING_TITLE = "TEST2"
    MEETING_DESCRIPTION = "TEST BUCKET."
    
    ahora = datetime.datetime.now()
    START_DATE = ahora
    END_DATE = ahora + datetime.timedelta(minutes=30)
    
    # Coloca los correos que se unirán a la sesión
    INVITEE_EMAILS = []

    enlace_meet = crear_evento_google_meet(
        MEETING_TITLE,
        MEETING_DESCRIPTION,
        START_DATE,
        END_DATE,
        INVITEE_EMAILS
    )
    
    if enlace_meet:
        creds = autenticar_usuario()
        # Se envía directamente la variable cargada del entorno (.env)
        suscribir_a_grabaciones(creds, enlace_meet, PUBSUB_TOPIC)