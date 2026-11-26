# Terruá Passport · Pasaporte y apertura en Soroban

## Evaluar el piloto

**Tirada de 100 botellas.** Ejecuta `node pruebas/ensayo.cjs --tirada` y
abre [TIRADA-100](http://127.0.0.1:18768/). Este servidor usa un contrato
separado y conserva el ensayo anterior. Verifica y guarda el comprobante
antes de la presentación con `node pruebas/tirada.cjs evidencia-tirada-100.json`.
En la reunión, abre **0100**, simula la apertura, comprueba un código
incorrecto y el correcto, confirma el consumo y vuelve al lote. El contador
debería mostrar 99 activas y el enlace a la transacción. Mantén el proceso
en marcha para conservar el código y la cuenta de ensayo en memoria.

Para ensayar desde un solo computador, ejecuta `node pruebas/ensayo.cjs` y
abre [la botella de ensayo](http://127.0.0.1:18767). El servidor local prepara
dos botellas nuevas en un contrato separado de Testnet. Pulsa **Simular
apertura**, escribe el código, compruébalo y marca la botella como consumida.
La cuenta titular de ensayo se guarda en memoria y firma solo en Testnet. El
consumo es definitivo. Usa `?botella=2` como segunda ficha, o reinicia el
servidor para preparar un nuevo ensayo. Mantén el servidor abierto durante
la presentación. El QR local se puede abrir usando su enlace en el mismo
computador.

1. Ejecuta `python iniciar.py` y selecciona **Soroban**. Para un evaluador externo, sirve el directorio `dist/` por HTTPS y abre `soroban.html`.
2. Abre las dos primeras botellas de cada lote desde los seis QR de muestra. Comprueba que los números de frente, reverso y pasaporte coinciden. Usa **Comparar el número impreso** para probar que otra numeración se rechaza.
3. En el primer lote, la botella 0001 aparece **Consumida**, la 0002 aparece **Retirada** y quedan 22 activas. El pasaporte incluye los enlaces a las transacciones de la demo y el ledger del último cambio.
4. Ejecuta `node pruebas/soroban.cjs` para verificar los 72 registros en Testnet. [Evidencia de despliegue y comisiones](dist/soroban-evidence.json).

Los datos de las bodegas, el frente, el reverso y la apertura de la cápsula son simulados. Las transacciones y los estados se registran en Soroban Testnet. Una copia del QR abre el mismo registro digital. La prueba del código comprueba que coincide con el registro. Para evaluar la protección física se requiere una prueba de etiquetado, cierre y apertura con una bodega.

## Contrato y flujo

- Soroban conserva lotes, pasaportes individuales, titulares y estados. La bodega autorizada registra lotes y botellas y asigna cada titular una vez. El revisor puede retirar una botella activa. El titular puede cerrar una botella activa con su firma y el código exacto. Los estados finales conservan el pasaporte y reducen el contador de activas.
- El QR incluye contrato, identificador del lote y número. El código de apertura se genera con 80 bits aleatorios, se imprime en cuatro grupos de cuatro caracteres y se oculta debajo de la cápsula en el diseño físico. Cotejar el número de la etiqueta y la ficha puede hacerse sin wallet.
- El compromiso SHA‑256 concatena `terrua.cork.v1` en ASCII, 32 bytes del ID de red, el `ScVal` XDR de la dirección del contrato, 32 bytes del ID de lote, el número como entero de cuatro bytes big endian y los 16 caracteres ASCII del código. La app elimina separadores y convierte a mayúsculas. **Comprobar código** hace la comparación localmente. Al iniciar el consumo, la preparación envía el código al RPC y la transacción confirmada lo hace público. El contrato exige la autorización de la wallet asignada.
- El archivo de evidencias es público y contiene los manifiestos, hashes y comisiones reportadas en stroops. La app coteja el hash del manifiesto con el contrato. El historial enlazado presenta las transacciones de la demo y el estado actual se consulta en Soroban. Las cuentas de escritura son efímeras. La demostración publicada permite lectura y revisión de las transacciones ya firmadas.

## Reproducir

Usa Node.js 22 o posterior y Rust con el target `wasm32v1-none`. Ejecuta los comandos desde la raíz del repositorio.

```text
cargo test --locked --manifest-path soroban/Cargo.toml
cargo build --locked --release --target wasm32v1-none --manifest-path soroban/Cargo.toml
node pruebas/soroban-local.cjs
node pruebas/soroban.cjs --publish soroban/target/wasm32v1-none/release/terrua_passport.wasm
node pruebas/soroban.cjs
```

El publicador crea cuentas efímeras de administrador, bodega, revisión y titular, usa Friendbot en Testnet y realiza el consumo con la cuenta titular. Los códigos de botellas activas quedan en memoria durante el proceso. Publica el JSON solo al completar las verificaciones. Ejecutar de nuevo crea otro contrato y otros QR. Conserva el JSON anterior en el historial de Git.

Para probar la firma desde el navegador, prepara un despliegue propio con las
variables de proceso `TERRUA_TEST_HOLDER` (dirección pública financiada de una
wallet Freighter en Testnet) y `TERRUA_TEST_CORK` (un código de muestra de 16
símbolos generado de forma aleatoria). El publicador asigna la botella 0003
del primer lote a esa wallet. Abre su ficha, comprueba el código y firma el
consumo. El código no se escribe en el JSON. Elimina la variable del entorno
de la terminal al terminar. Usa esta variante en una copia del piloto.

Las escrituras extienden la vigencia de las entradas persistentes que tocan. Si se archiva el estado, se necesita restaurar la instancia y, según la operación, las entradas de lote, bodega o botella antes de reintentar. Mantén la instancia y el Wasm vigentes con el operador del despliegue. Para esta demo efímera se puede volver a publicar tras un reinicio de Testnet. [Restaurar una instancia con Stellar CLI](https://developers.stellar.org/docs/tools/cli/cookbook/restore-contract-instance) · [Restaurar datos persistentes](https://developers.stellar.org/docs/tools/cli/cookbook/restore-contract-storage)

## Postulación

Usar Classic como evidencia previa y Soroban como evidencia técnica del piloto de apertura, asignación y consumo. La propuesta de US$5.000 se desglosa en 18 h de contrato y modelo de autorización, 28 h de integración y firma, 30 h de pruebas de seguridad, QR y ciclo de vida, y 24 h de despliegue, documentación y reproducción, a US$50/h. Confirmar con el equipo la tarifa y los responsables. El SOW final debe distinguir el trabajo ya entregado del alcance que se financiaría, como la validación con una bodega y el flujo operativo de empaque y asignación.
