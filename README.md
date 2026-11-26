# Terruá Passport

Terruá Passport lets wineries tokenize each numbered bottle on Stellar Testnet and record its origin, vintage, and production details. Wine lovers can scan the bottle’s QR code to verify its digital record, explore tasting notes, and discover food pairings.

**Run locally.** With Python 3.8 or later, run `python3 iniciar.py` from the repository root, or double-click `Iniciar-Terrua.cmd` on Windows. Open [Terruá Passport on localhost](http://127.0.0.1:8765/). To run the offline tests with Node.js 22 or later, use `node pruebas/serie.cjs`.

Prototipo para registrar lotes de vino, elegir entre un activo por lote y una serie de botellas con activos individuales y verificar la ficha y su revisión en Stellar Testnet. Esta copia incluye la aplicación con emisión individual numerada, el código JavaScript editable, los recursos gráficos y las dependencias de la aplicación.

## Piloto para Instawards

**Demo Soroban** verifica un pasaporte por botella y su estado en Testnet. Los
QR y las etiquetas numeradas simulan el etiquetado físico. La guía de
[Soroban](SOROBAN.md) describe el código oculto, el consumo firmado y cómo
reproducir el despliegue.

La sección **Demo Testnet** conserva el piloto Classic de tres lotes ficticios. Cada
enlace verifica la emisión por número sin conectar una billetera. La aplicación
contrasta el emisor con el registro publicado de la demo y muestra el historial
firmado para la botella retirada. Las seis etiquetas de prueba se imprimen desde
esa sección. Alojando `dist/` por HTTPS, sus QR sirven también desde otro equipo.

Con Node.js 22, ejecuta `node pruebas/piloto-local.cjs` para las pruebas de
autorización y correcciones, `node pruebas/serie.cjs` para las pruebas de
emisión y recuperación, y `node pruebas/piloto.cjs` para verificar 72 botellas,
una corrección y un reclamo directamente contra Stellar Testnet. Las referencias
publicadas están en `dist/pilot-evidence.json`. Consulta la
[guía de reproducción y postulación](PILOTO.md) para volver a generar el piloto.

## Abrir en Windows

1. Clona este repositorio o descarga y extrae su ZIP.
2. Con Python 3.8 o superior instalado, haz doble clic en **Iniciar-Terrua.cmd**.
3. Mantén abierta la ventana del servidor. Si el navegador no se abre automáticamente, visita `http://127.0.0.1:8765/`. Para terminar, pulsa **Ctrl+C** en la ventana.

En macOS o Linux, ejecuta `python3 iniciar.py` desde la carpeta extraída. También puedes publicar el contenido de `dist/` en un alojamiento web estático con HTTPS. Las dependencias ya están incluidas.

## Probar el pasaporte

- Abre **Origen 1.200** para explorar un lote ilustrativo con 1.194 botellas disponibles y seis muestras testigo. Compara la botella **0372** con la **0401** y abre la ficha de servicio para ver temperatura, decantación y maridaje.
- Abre **Reserva Los Boldos** y selecciona **Verificar en Stellar**. La app consulta la emisión de 1.200 unidades del lote COL-024 y su revisión documental. Los datos de la bodega y del laboratorio son ficticios.
- Para probar la verificación desde un archivo, abre **Verificar**, despliega **Verificar un archivo de pasaporte** y selecciona `ejemplos/COL-024.json`.
- Para crear otro lote, pulsa **Registrar vino**. El borrador se guarda en el navegador. Al emitir, los metadatos del lote quedan en la red de pruebas. Si seleccionas un documento, la aplicación registra su nombre y su huella SHA-256.
- Emitir y verificar requieren conexión a internet. Para firmar una revisión propia también se necesita una cuenta de prueba con saldo y la extensión Freighter configurada en Testnet.
- Los enlaces y QR generados al ejecutar la app en tu equipo apuntan a la dirección local. Para compartir un pasaporte utiliza el archivo JSON o genera el enlace desde una instalación HTTPS accesible a tus destinatarios.

## Emitir botellas numeradas

1. En **Registrar vino**, completa **Origen** y abre el paso **Lote**.
2. Indica el número de botellas y el primer número de la tirada. El formulario propone **Un token único por botella numerada**. Activa **Registrar el control de embotellado** para indicar muestras, bajas y producción teórica. La aplicación valida los rangos y detecta números duplicados.
3. Para reclamar los activos, escribe una dirección pública Stellar propia en **Cuenta Stellar receptora**. Dejarla vacía crea una colección demostrativa asignada a una dirección cuyas claves se descartan.
4. Revisa el intervalo y confirma la publicación en Testnet. Cada serie admite entre 1 y 4.800 números consecutivos. Por ejemplo, si empiezas en 450 y registras 12 botellas, se emiten los números 0450 a 0461.
5. En el pasaporte, busca una botella por número para obtener su ficha, su QR y su archivo JSON. **Descargar numeración CSV** exporta el número, el activo, el emisor, el enlace y el estado declarado de cada botella para preparar las etiquetas.

El ejemplo **Piedra del Sur**, lote **ITA-011**, contiene 620 activos emitidos en Stellar Testnet, del 0001 al 0620. Puedes importar `ejemplos/ITA-011-botella-0061.json` desde **Verificar** y consultar el activo B00000061 en el segundo tramo de la tirada.

### Qué comprueba la aplicación

Cada número tiene un código de activo independiente y un emisor. El número se puede repetir en otros lotes, cuyos emisores son diferentes. La serie reserva en Stellar la combinación normalizada de bodega y código de lote. El emisor crea un saldo reclamable de 0,0000001 por activo, la cantidad mínima de Stellar Classic. Esa cantidad representa una botella. Tras el último tramo se bloquea la clave emisora. La aplicación comprueba la numeración, los destinatarios y las operaciones de toda la serie antes de mostrarla como emitida.

Durante una emisión puedes descargar el **respaldo de emisión**. Si se corta la conexión, reabre el borrador en el mismo navegador y pulsa **Comprobar emisión**. En otro equipo, abre **Verificar → Recuperar una emisión numerada pendiente** e importa el respaldo. La aplicación comprueba las firmas y reutiliza las mismas transacciones. Conserva el borrador o el respaldo hasta que la serie quede sellada.

El QR identifica el registro digital. Una copia de la misma etiqueta lleva a ese mismo registro. El control físico de colocación y la validación de la identidad de la bodega corresponden al proceso de embotellado.

### Pruebas incluidas

Con Node.js 22 o superior, ejecuta `node pruebas/serie.cjs` desde la carpeta del proyecto. Las pruebas locales cubren rangos, códigos diferentes, límites entre tramos, un respaldo alterado, reintentos y recuperación tras una interrupción. También comprueban la estructura de una serie de 4.800 botellas. La tirada de 620 es la muestra comprobada en Testnet.

## Archivos principales

| Archivo | Contenido |
|---|---|
| dist/index.html, dist/styles.css | Interfaz y estilos |
| dist/app.js, dist/model.js | Registro, campos de vino, pasaportes y exportación |
| dist/chain.js | Emisión de activos y verificación de la ficha en Stellar Testnet |
| dist/serial.js | Numeración, emisión por tramos y verificación individual |
| dist/review.js | Firma y verificación de revisiones |
| dist/assets/, dist/licenses/ | Imágenes, tipografías, SDK y licencias |
| ejemplos/COL-024.json | Pasaporte de muestra importable con las referencias de emisión y revisión |
