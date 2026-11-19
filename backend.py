import json
import os
import random
import sys
import time

from dotenv import load_dotenv
from google import genai
from google.genai.errors import APIError

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
MODELO = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

if not API_KEY:
    print("Error: falta GEMINI_API_KEY en el archivo .env")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)

CATEGORIAS = ["incidencia_envio", "devolucion", "consulta_producto", "otro"]
PRIORIDADES = ["alta", "media", "baja"]
ERRORES_TEMPORALES = [429, 500, 502, 503, 504]

esquema = {
    "type": "OBJECT",
    "properties": {
        "categoria": {
            "type": "STRING",
            "enum": CATEGORIAS
        },
        "prioridad": {
            "type": "STRING",
            "enum": PRIORIDADES
        },
        "respuesta_sugerida": {
            "type": "STRING",
            "description": "Borrador de respuesta cordial en español para el cliente"
        }
    },
    "required": ["categoria", "prioridad", "respuesta_sugerida"]
}

instrucciones = """
Eres el asistente de atención al cliente de una empresa de comercio internacional.
Los clientes escriben en español o en inglés.

Clasifica la consulta en una categoría:
- incidencia_envio: retrasos, pedidos no recibidos, paquetes dañados o perdidos.
- devolucion: devoluciones, reembolsos o cambios.
- consulta_producto: dudas sobre un producto (características, stock, tallas, precio).
- otro: cualquier otro tema.

Asigna una prioridad:
- alta: problemas graves o urgentes, o cliente muy molesto.
- media: incidencias que hay que gestionar pero no son urgentes.
- baja: consultas informativas.

Escribe siempre la respuesta_sugerida en español, de forma cordial y profesional.
No inventes datos como números de pedido o fechas.
"""

config = genai.types.GenerateContentConfig(
    system_instruction=instrucciones,
    response_schema=esquema,
    response_mime_type="application/json"
)


def generate_retry_jitter(mensaje, max_retries=5, base_delay=1):
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODELO,
                contents=mensaje,
                config=config
            )
            return json.loads(response.text)

        except APIError as e:
            if e.code not in ERRORES_TEMPORALES or attempt == max_retries - 1:
                raise

            delay = base_delay * (2 ** attempt)
            jitter = random.uniform(0, delay)
            sleep_time = delay + jitter
            print(f"Error {e.code}. Reintento {attempt + 1} en {sleep_time:.2f} segundos...")
            time.sleep(sleep_time)


def analizar_consulta(mensaje):
    resultado = generate_retry_jitter(mensaje)

    if resultado["categoria"] not in CATEGORIAS or resultado["prioridad"] not in PRIORIDADES:
        raise ValueError(f"Respuesta con valores no válidos: {resultado}")

    return resultado


def procesar(mensaje):
    try:
        resultado = analizar_consulta(mensaje)
        print(json.dumps(resultado, ensure_ascii=False, indent=2))
    except APIError as e:
        print(f"Error de la API de Gemini ({e.code}): {e.message}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        procesar(" ".join(sys.argv[1:]))
    else:
        print("Escribe la consulta del cliente ('salir' para terminar)")
        while True:
            mensaje = input("\n> ").strip()
            if mensaje.lower() == "salir":
                break
            if mensaje:
                procesar(mensaje)
