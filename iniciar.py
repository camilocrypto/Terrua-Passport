"""Inicia Terruá Passport en el navegador con Python 3.8 o superior."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser


def main():
    site = Path(__file__).resolve().parent / "dist"
    handler = partial(SimpleHTTPRequestHandler, directory=str(site))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 8765), handler)
    except OSError:
        raise SystemExit("El puerto 8765 está ocupado. Cierra la otra instancia y vuelve a intentar.")
    with server:
        url = "http://127.0.0.1:8765/"
        print("Terruá Passport: " + url, flush=True)
        print("Deja esta ventana abierta mientras usas la app. Para cerrar, pulsa Ctrl+C.", flush=True)
        webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
