require("dotenv").config();
const nodemailer = require("nodemailer");

async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    logger: true,
    debug: true,
  });

  try {
    console.log("1. Comprobando conexión SMTP...");
    await transporter.verify();
    console.log("✓ Conexión y autenticación correctas");

    console.log("2. Enviando correo de prueba...");

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: "oliver.alamoholm@gmail.com",
      subject: "Prueba SMTP - MOMENTUM+",
      text: "Si recibes este correo, Nodemailer funciona correctamente.",
    });

    console.log("✓ Correo aceptado por el servidor SMTP");
    console.log("Message ID:", info.messageId);
    console.log("Destinatarios aceptados:", info.accepted);
    console.log("Destinatarios rechazados:", info.rejected);
  } catch (error) {
    console.error("ERROR SMTP");
    console.error("Código:", error.code);
    console.error("Respuesta:", error.response);
    console.error("Mensaje:", error.message);
  }
}

testEmail();
