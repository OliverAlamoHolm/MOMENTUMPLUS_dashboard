require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const app = express();
const PORT = process.env.PORT || 6000;
const MONGO =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/momentumplus";
const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      firstName: String,
      lastName: String,
      email: { type: String, unique: true, index: true },
      passwordHash: String,
      role: { type: String, enum: ["member", "admin"], default: "member" },
      status: { type: String, enum: ["active", "disabled"], default: "active" },
      phone: String,
      completedLessons: [
        { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
      ],
      resetTokenHash: String,
      resetExpires: Date,
      emailVerified: { type: Boolean, default: false },
      verificationTokenHash: String,
      verificationExpires: Date,
    },
    { timestamps: true },
  ),
);
const Lesson = mongoose.model(
  "Lesson",
  new mongoose.Schema(
    {
      title: { type: String, required: true },
      level: { type: String, required: true },
      format: String,
      url: String,
      order: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);
const Resource = mongoose.model(
  "Resource",
  new mongoose.Schema(
    {
      title: { type: String, required: true },
      type: String,
      description: String,
      url: String,
    },
    { timestamps: true },
  ),
);
const Event = mongoose.model(
  "Event",
  new mongoose.Schema(
    {
      title: { type: String, required: true },
      date: String,
      time: String,
      type: String,
      description: String,
      link: String,
    },
    { timestamps: true },
  ),
);
for (const d of ["uploads/library", "uploads/academy"])
  fs.mkdirSync(path.join(__dirname, d), { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(
      null,
      path.join(
        __dirname,
        req.uploadArea === "academy" ? "uploads/academy" : "uploads/library",
      ),
    ),
  filename: (req, file, cb) =>
    cb(
      null,
      Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"),
    ),
});
const upload = multer({ storage, limits: { fileSize: 250 * 1024 * 1024 } });
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: MONGO }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 3600 * 1000,
    },
  }),
);
app.use("/uploads", (req, res, next) =>
  req.session?.userId ? next() : res.status(401).send("Acceso restringido"),
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const safeUser = (u) => ({
  id: u._id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  role: u.role,
  status: u.status,
  phone: u.phone || "",
  completedLessons: u.completedLessons || [],
  emailVerified: !!u.emailVerified,
});
const smtpReady = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const mailer = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
const baseUrl = () => process.env.APP_URL || `http://localhost:${PORT}`;
async function sendVerification(u) {
  const token = crypto.randomBytes(32).toString("hex");
  u.verificationTokenHash = hashToken(token);
  u.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await u.save();
  const url = `${baseUrl()}/api/auth/verify?token=${token}&email=${encodeURIComponent(u.email)}`;
  if (!smtpReady()) {
    console.log("[VERIFICACIÓN DEMO] " + url);
    return;
  }
  const safeName = String(u.firstName || "").replace(/[<>&"']/g, "");
  const html = `<!doctype html><html><body style="margin:0;padding:30px 12px;background:#edf3f8;font-family:Arial,Helvetica,sans-serif;color:#102d4d"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;margin:auto;background:white;border-radius:18px;overflow:hidden"><tr><td style="background:linear-gradient(110deg,#092747,#098bc5);padding:30px 38px;color:white"><div style="font-size:29px;font-weight:800;letter-spacing:1px">MOMENTUM<span style="color:#5bd5ff">+</span></div><div style="font-size:10px;letter-spacing:3px;margin-top:7px">PEOPLE · KNOWLEDGE · OPPORTUNITY</div></td></tr><tr><td style="padding:38px"><p style="font-size:12px;letter-spacing:2px;color:#168fc6;font-weight:bold">BIENVENIDO A MOMENTUM+</p><h1 style="font-size:28px;line-height:1.2;margin:10px 0 20px">Un paso más hacia tu formación.</h1><p style="line-height:1.7;color:#4b6075">Hola ${safeName}, gracias por unirte a MOMENTUM+. Confirma tu dirección de correo para activar tu cuenta y acceder a tu Academia, Biblioteca y Eventos.</p><div style="padding:22px 0"><a href="${url}" style="display:inline-block;padding:16px 28px;border-radius:9px;background:#087dc0;color:white;text-decoration:none;font-weight:bold">Confirmar mi cuenta →</a></div><p style="font-size:13px;line-height:1.6;color:#708196">El enlace caduca en 24 horas. Si no has solicitado el registro, ignora este correo.</p></td></tr><tr><td style="background:#f3f8fb;padding:20px 38px;font-size:12px;color:#71859b">MOMENTUM+ · People · Knowledge · Opportunity</td></tr></table></body></html>`;
  await mailer().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: u.email,
    subject: "Activa tu cuenta | MOMENTUM+",
    text: `Hola ${safeName}, confirma tu cuenta: ${url} (válido 24 horas).`,
    html,
  });
}
const resendAttempts = new Map();
const auth = (req, res, next) =>
  req.session.userId
    ? next()
    : res.status(401).json({ error: "Debes iniciar sesión." });
const admin = async (req, res, next) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Debes iniciar sesión." });
  const u = await User.findById(req.session.userId);
  if (!u || u.role !== "admin")
    return res
      .status(403)
      .json({ error: "Acceso de administrador requerido." });
  next();
};
app.post("/api/auth/register", async (req, res) => {
  try {
    let { firstName, lastName, email, password } = req.body;
    email = (email || "").trim().toLowerCase();
    if (
      !firstName ||
      !lastName ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 8
    )
      return res.status(400).json({
        error:
          "Introduce datos válidos y una contraseña de al menos 8 caracteres.",
      });
    if (await User.exists({ email }))
      return res
        .status(409)
        .json({ error: "Ya existe una cuenta con ese email." });
    if (!smtpReady() && process.env.NODE_ENV === "production")
      return res
        .status(503)
        .json({ error: "El servicio de correo no está configurado." });
    const u = await User.create({
      firstName,
      lastName,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      emailVerified: false,
    });
    try {
      await sendVerification(u);
    } catch (e) {
      console.error("Error SMTP:", e.message);
      return res.status(503).json({
        error:
          "Cuenta creada, pero no se pudo enviar el correo. Utiliza reenviar confirmación.",
      });
    }
    res.json({
      ok: true,
      message:
        "Cuenta creada. Comprueba tu correo y confirma tu dirección antes de entrar.",
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No se pudo crear la cuenta." });
  }
});
app.get("/api/auth/verify", async (req, res) => {
  const email = String(req.query.email || "").toLowerCase(),
    token = String(req.query.token || "");
  const u = token
    ? await User.findOne({
        email,
        verificationTokenHash: hashToken(token),
        verificationExpires: { $gt: new Date() },
      })
    : null;
  if (!u)
    return res
      .status(400)
      .send(
        "<h2>Enlace inválido o caducado</h2><p>Solicita otro correo de confirmación desde el inicio de sesión.</p>",
      );
  u.emailVerified = true;
  u.verificationTokenHash = undefined;
  u.verificationExpires = undefined;
  await u.save();
  res.redirect("/?verified=1");
});
app.post("/api/auth/resend-verification", async (req, res) => {
  const email = String(req.body.email || "")
      .trim()
      .toLowerCase(),
    now = Date.now();
  if (resendAttempts.get(email) > now)
    return res.json({
      ok: true,
      message:
        "Si la cuenta está pendiente, recibirás un nuevo correo. Espera un minuto antes de volver a intentarlo.",
    });
  resendAttempts.set(email, now + 60000);
  const u = await User.findOne({ email, emailVerified: false });
  if (u) {
    try {
      await sendVerification(u);
    } catch (e) {
      console.error("Error SMTP:", e.message);
      return res
        .status(503)
        .json({ error: "No se pudo enviar el correo. Inténtalo más tarde." });
    }
  }
  res.json({
    ok: true,
    message:
      "Si la cuenta está pendiente, recibirás un correo de confirmación.",
  });
});
app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email || "")
      .trim()
      .toLowerCase(),
    u = await User.findOne({ email });
  if (
    !u ||
    u.status !== "active" ||
    !(await bcrypt.compare(req.body.password || "", u.passwordHash))
  )
    return res.status(401).json({ error: "Email o contraseña incorrectos." });
  if (!u.emailVerified)
    return res.status(403).json({
      error:
        "Debes confirmar tu correo antes de entrar. Utiliza «Reenviar confirmación».",
      code: "EMAIL_NOT_VERIFIED",
    });
  req.session.regenerate((err) => {
    if (err)
      return res.status(500).json({ error: "No se pudo iniciar sesión." });
    req.session.userId = u._id.toString();
    res.json({ user: safeUser(u) });
  });
});
app.post("/api/auth/logout", (req, res) =>
  req.session.destroy(() => res.json({ ok: true })),
);
app.get("/api/auth/me", auth, async (req, res) => {
  const u = await User.findById(req.session.userId);
  if (!u || u.status !== "active")
    return res.status(401).json({ error: "Sesión no válida." });
  res.json({ user: safeUser(u) });
});
app.post("/api/auth/change-password", auth, async (req, res) => {
  const u = await User.findById(req.session.userId);
  if (!(await bcrypt.compare(req.body.currentPassword || "", u.passwordHash)))
    return res
      .status(400)
      .json({ error: "La contraseña actual no es correcta." });
  if ((req.body.newPassword || "").length < 8)
    return res
      .status(400)
      .json({ error: "La nueva contraseña debe tener al menos 8 caracteres." });
  u.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await u.save();
  res.json({ ok: true });
});
app.post("/api/auth/forgot", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const u = await User.findOne({ email });
  if (u) {
    const token = crypto.randomBytes(32).toString("hex");
    u.resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
    u.resetExpires = new Date(Date.now() + 3600000);
    await u.save();
    const link = `${process.env.APP_URL || `http://localhost:${PORT}`}/reset.html?token=${token}&email=${encodeURIComponent(email)}`;
    if (smtpReady()) {
      const tr = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: +process.env.SMTP_PORT || 587,
        secure: (+process.env.SMTP_PORT || 465) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await tr.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: "Restablecer contraseña · MOMENTUM+",
        text: `Restablece tu contraseña: ${link}`,
      });
    } else console.log("\n[MOMENTUM+ RESET LINK]\n" + link + "\n");
  }
  res.json({
    ok: true,
    message: "Si el email existe, se ha generado un enlace de recuperación.",
  });
});
app.post("/api/auth/reset", async (req, res) => {
  const hash = crypto
    .createHash("sha256")
    .update(req.body.token || "")
    .digest("hex");
  const u = await User.findOne({
    email: (req.body.email || "").toLowerCase(),
    resetTokenHash: hash,
    resetExpires: { $gt: new Date() },
  });
  if (!u)
    return res
      .status(400)
      .json({ error: "El enlace no es válido o ha caducado." });
  if ((req.body.password || "").length < 8)
    return res.status(400).json({ error: "Mínimo 8 caracteres." });
  u.passwordHash = await bcrypt.hash(req.body.password, 12);
  u.resetTokenHash = undefined;
  u.resetExpires = undefined;
  await u.save();
  res.json({ ok: true });
});
app.patch("/api/profile", auth, async (req, res) => {
  const u = await User.findByIdAndUpdate(
    req.session.userId,
    {
      $set: {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        phone: req.body.phone,
      },
    },
    { new: true },
  );
  res.json({ user: safeUser(u) });
});
app.get("/api/lessons", auth, async (req, res) =>
  res.json(await Lesson.find().sort({ order: 1, createdAt: 1 })),
);
app.post("/api/lessons/:id/complete", auth, async (req, res) => {
  const op = req.body.done ? "$addToSet" : "$pull";
  const u = await User.findByIdAndUpdate(
    req.session.userId,
    { [op]: { completedLessons: req.params.id } },
    { new: true },
  );
  res.json({ user: safeUser(u) });
});
app.get("/api/resources", auth, async (req, res) =>
  res.json(await Resource.find().sort({ createdAt: -1 })),
);
app.get("/api/events", auth, async (req, res) =>
  res.json(await Event.find().sort({ date: 1, time: 1 })),
);
app.get("/api/admin/users", admin, async (req, res) =>
  res.json((await User.find().sort({ createdAt: -1 })).map(safeUser)),
);
app.post("/api/admin/users", admin, async (req, res) => {
  try {
    const password = req.body.password || "momentum2026";
    const u = await User.create({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: req.body.role || "member",
      emailVerified: true,
    });
    res.json(safeUser(u));
  } catch (e) {
    res
      .status(400)
      .json({ error: "No se pudo crear el usuario. Revisa el email." });
  }
});
app.patch("/api/admin/users/:id", admin, async (req, res) => {
  const set = {};
  for (const k of ["status", "role"]) if (req.body[k]) set[k] = req.body[k];
  const u = await User.findByIdAndUpdate(
    req.params.id,
    { $set: set },
    { new: true },
  );
  res.json(safeUser(u));
});
app.delete("/api/admin/users/:id", admin, async (req, res) => {
  if (req.params.id === req.session.userId)
    return res
      .status(400)
      .json({ error: "No puedes eliminar tu propia cuenta." });
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
const area = (a) => (req, res, next) => {
  req.uploadArea = a;
  next();
};
app.post(
  "/api/admin/resources",
  admin,
  area("library"),
  upload.single("file"),
  async (req, res) => {
    const url = req.file
      ? "/uploads/library/" + req.file.filename
      : req.body.link;
    res.json(
      await Resource.create({
        title: req.body.title,
        type: req.body.type,
        description: req.body.description,
        url,
      }),
    );
  },
);
app.delete("/api/admin/resources/:id", admin, async (req, res) => {
  await Resource.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
app.post(
  "/api/admin/lessons",
  admin,
  area("academy"),
  upload.single("file"),
  async (req, res) => {
    const url = req.file
      ? "/uploads/academy/" + req.file.filename
      : req.body.link;
    res.json(
      await Lesson.create({
        title: req.body.title,
        level: req.body.level,
        format: req.body.format,
        url,
        order: +req.body.order || 0,
      }),
    );
  },
);
app.delete("/api/admin/lessons/:id", admin, async (req, res) => {
  await Lesson.findByIdAndDelete(req.params.id);
  await User.updateMany({}, { $pull: { completedLessons: req.params.id } });
  res.json({ ok: true });
});
app.post("/api/admin/events", admin, async (req, res) =>
  res.json(await Event.create(req.body)),
);
app.delete("/api/admin/events/:id", admin, async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
app.use(express.static(__dirname, { extensions: ["html"] }));
async function bootstrap() {
  await mongoose.connect(MONGO);
  const email = (
    process.env.ADMIN_EMAIL || "admin@momentumplus.es"
  ).toLowerCase();
  if (!(await User.exists({ email }))) {
    await User.create({
      firstName: "Administrador",
      lastName: "MOMENTUM+",
      email,
      passwordHash: await bcrypt.hash(
        process.env.ADMIN_PASSWORD || "momentum2026",
        12,
      ),
      role: "admin",
      emailVerified: true,
    });
    console.log("Admin creado:", email);
  }
  await User.updateMany(
    { emailVerified: { $exists: false } },
    { $set: { emailVerified: true } },
  );
  app.listen(PORT, () =>
    console.log(`MOMENTUM+ listo en http://localhost:${PORT}`),
  );
}
bootstrap().catch((e) => {
  console.error("No se pudo iniciar:", e.message);
  process.exit(1);
});
