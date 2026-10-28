# MOMENTUM+ local con confirmación por email

## Preparación
1. Instala Node.js (18+) y arranca MongoDB.
2. En esta carpeta ejecuta `npm install`.
3. Copia `.env.example` a `.env` y establece `SMTP_PASS` con la contraseña REAL del buzón `noreply@manutelcanarias.es`.
4. Cambia `SESSION_SECRET` y `ADMIN_PASSWORD` por valores seguros.
5. Ejecuta `npm start` y abre http://localhost:3000.

## SMTP
- Host: `manutelcanarias-es.correoseguro.dinaserver.com`
- Puerto: `465` (SMTPS / SSL)
- Usuario: `noreply@manutelcanarias.es`
- Contraseña: contraseña del buzón, que NO se incluye en el proyecto.
- Remitente: `MOMENTUM+ <noreply@manutelcanarias.es>`

Si el proveedor requiere STARTTLS, cambia `SMTP_PORT=587`; Nodemailer utiliza `secure:false` en ese puerto.
El servidor muestra el enlace de confirmación en la consola **solo si no has configurado SMTP**, para pruebas locales.

## Flujo
- Los nuevos miembros se crean sin verificar y reciben un correo con botón para confirmar.
- El enlace dura 24 horas y solo se puede utilizar una vez.
- Antes de confirmar no se puede iniciar sesión.
- En login se puede reenviar la confirmación (espera de 60 segundos por email).
- Las cuentas preexistentes se conservan activadas para evitar bloquear miembros anteriores.
- El administrador inicial se crea confirmado.

## Consideraciones
- No publiques `.env`, no subas contraseñas a repositorios.
- En producción añade rate limiting persistente, CSRF, cookies secure con HTTPS y un servicio de correo fiable.
- El almacenamiento de archivos y otras partes del prototipo siguen las decisiones de seguridad de la versión anterior; revísalas antes de publicar.
