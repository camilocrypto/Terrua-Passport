# Terruá Passport · Piloto de trazabilidad

## Qué puede reproducir un evaluador

1. Abre la aplicación desde un servidor estático que sirva `dist/`. Para probar
   en el mismo equipo, ejecuta `python iniciar.py` y abre
   [la demo local](http://127.0.0.1:8765/#piloto).
2. Abre **Demo Testnet** y selecciona las botellas 0001 y 0002 de cada lote.
   Comprueba el número, emisor y enlace a Horizon. En el primer lote, la botella
   0002 debe mostrar la emisión original y la retirada declarada.
3. Sirve `dist/` por HTTPS e imprime las seis etiquetas desde esa misma URL.
   Escanea cada etiqueta con otro dispositivo y coteja lote y número.
4. Ejecuta `node pruebas/serie.cjs`, `node pruebas/piloto-local.cjs` y
   `node pruebas/piloto.cjs` con Node.js 22. La última prueba consulta Horizon
   y verifica tres lotes, 72 referencias individuales, una corrección y
   el reclamo de la botella 0001 del primer lote.

La tabla de evidencias en [pilot-evidence.json](dist/pilot-evidence.json)
contiene por lote su emisor, la huella SHA-256 del manifiesto, el hash de
configuración, los tramos y el sello. También contiene las referencias de la
corrección y del reclamo. Cada hash de transacción se puede consultar en
`https://horizon-testnet.stellar.org/transactions/<hash>`. El manifiesto
canónico está incluido en las operaciones de configuración. Esta arquitectura
usa operaciones de Stellar Classic, así que sus identificadores son los
emisores, códigos de activos y hashes de transacción.

### Evidencia anterior confirmada

- [Piedra del Sur, 620 botellas numeradas](https://horizon-testnet.stellar.org/transactions/0b424160dfdcc63afdaabc1d7ac2ec5cda27ad258c999c463e10f155335e39be).
- [Reserva Los Boldos, lote de 1.200 unidades](https://horizon-testnet.stellar.org/transactions/45415c6847ebb0e8e89b487beaad7838aefbca77bbf7f59ca205a7d7ac02096e)
  y [revisión documental](https://horizon-testnet.stellar.org/transactions/7b8a30ccc5402e0fc220dc70e233b37682e50e4a0b6bd597f55bf43338a19ba1).

## Decisión de arquitectura y seguridad

Para un lote de 24 botellas, Classic usa tres transacciones (configuración,
tramo de emisión y sello), con una operación de creación de saldo reclamable
por botella. El reclamo demostrado agrega una transacción con dos operaciones:
constituir la línea de confianza y reclamar. La URL pública verifica la emisión
sin pedir una cuenta. La cuenta receptora permite demostrar un caso concreto:
la bodega asigna una botella de muestra a un custodio designado, que recibe
el activo en Testnet. El activo representa una referencia digital en el piloto.

La alternativa Soroban estimada usaría un registro por lote con un compromiso
criptográfico del manifiesto y verificación por botella fuera de cadena.
Reduciría las escrituras proporcionales a la tirada y dependería de alojar el
manifiesto. Haría falta añadir un mecanismo de reclamo si se desea transferir
un activo. No se midieron comisiones ni reservas de esa alternativa. Se
eligió Classic para aprovechar el flujo de emisión y recuperación existente y
demostrar el traspaso digital de una muestra.

El archivo de evidencia publicado por HTTPS es la fuente de confianza para
los emisores y la cuenta revisora del piloto. La unicidad del lote usa la
reserva de numeración existente. La retirada es una declaración firmada
vinculada al sello original. Un QR copiado lleva al mismo pasaporte y el
operador coteja el número de etiqueta con el manifiesto al aplicarla.

Las claves de prueba son efímeras y se mantienen en memoria. Para recrear el
piloto tras un reinicio de Testnet o una rotación de cuentas, ejecuta
`node pruebas/piloto.cjs --publish`. Crea tres lotes nuevos y reemplaza el
archivo de evidencia únicamente cuando completa la verificación. Conserva
el commit anterior como historial, vuelve a desplegar y genera etiquetas
nuevas para los nuevos sellos. Para la emisión iniciada desde la aplicación,
conserva el respaldo y reutiliza el flujo **Comprobar emisión**.

## Borrador para Instawards

**Propuesta.** Demostrar el recorrido de un lote de vino desde el registro
firmado hasta la consulta por número de botella, con un ejemplo de retiro y
un reclamo de custodia en Stellar Testnet. La demostración utiliza datos
ficticios y evidencia verificable en el explorador.

| Entregable | Horas | Tarifa | Coste |
|---|---:|---:|---:|
| Especificación, criterios y evidencia | 16 | US$50/h | US$800 |
| Emisión, correcciones y recuperación | 32 | US$50/h | US$1.600 |
| Integración del verificador y etiquetado | 28 | US$50/h | US$1.400 |
| Pruebas, reproducción y documentación | 24 | US$50/h | US$1.200 |
| Total estimado | 100 | | US$5.000 |

Antes de presentar, revisar el SOW anterior, confirmar con el Chapter Lead la
ventana oficial, agregar enlaces de participación en Stellar Chile, asignar
responsables y validar la tarifa. Separar los entregables ya demostrados del
trabajo futuro que se pedirá financiar. Adjuntar un enlace HTTPS de la demo y
la validación por una persona ajena a la implementación. El plan local de
aceptación incluye los seis escaneos físicos.

**Prior art.** [TERWA](https://terwa.io/en/how-it-works) usa certificados
transferibles en Stellar para reservas de vino `en primeur`. Terruá enfoca
la demo en la consulta pública por botella numerada y la revisión del
registro por lote. [Reglas oficiales de Instawards](https://stellar.gitbook.io/scf-handbook/scf-awards/instawards/official-rules).
