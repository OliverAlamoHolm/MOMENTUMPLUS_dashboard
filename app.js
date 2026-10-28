const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const dialog = $("#loginDialog"),
  publicSite = $("#publicSite"),
  privateApp = $("#privateApp"),
  sidebar = $("#memberSidebar");
let me = null,
  lessons = [],
  resources = [],
  events = [],
  users = [],
  libraryFilter = "Todos";
const api = async (url, opt = {}) => {
  const r = await fetch(url, {
    credentials: "same-origin",
    ...opt,
    headers: {
      ...(opt.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(opt.headers || {}),
    },
  });
  let d = {};
  try {
    d = await r.json();
  } catch {}
  if (!r.ok) throw new Error(d.error || "Ha ocurrido un error.");
  return d;
};
const toast = (t) => {
  const e = $("#toast");
  e.textContent = t;
  e.classList.add("show");
  setTimeout(() => e.classList.remove("show"), 2400);
};
const esc = (s) =>
  (s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
["openLogin", "heroMember", "previewLogin"].forEach((id) =>
  $("#" + id)?.addEventListener("click", () => dialog.showModal()),
);
$("#openRegister").onclick = () => {
  dialog.close();
  $("#registerDialog").showModal();
};
$("#closeRegister").onclick = () => $("#registerDialog").close();
$("#openForgot").onclick = () => {
  dialog.close();
  $("#forgotDialog").showModal();
};
$("#closeForgot").onclick = () => $("#forgotDialog").close();
async function login() {
  try {
    const d = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("#loginEmail").value,
        password: $("#loginPassword").value,
      }),
    });
    $("#loginError").hidden = true;
    await enter(d.user);
  } catch (e) {
    $("#loginError").textContent = e.message;
    $("#loginError").hidden = false;
  }
}
$("#fakeLogin").onclick = login;
$("#loginForm").onsubmit = (e) => {
  e.preventDefault();
  login();
};
$("#registerForm").onsubmit = async (e) => {
  e.preventDefault();
  const er = $("#registerError");
  if ($("#registerPassword").value !== $("#registerPassword2").value) {
    er.textContent = "Las contraseñas no coinciden.";
    er.hidden = false;
    return;
  }
  try {
    const d = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        firstName: $("#registerFirstName").value,
        lastName: $("#registerLastName").value,
        email: $("#registerEmail").value,
        password: $("#registerPassword").value,
      }),
    });
    er.hidden = true;
    $("#registerDialog").close();
    dialog.showModal();
    $("#loginEmail").value = $("#registerEmail").value;
    $("#loginError").textContent = d.message;
    $("#loginError").hidden = false;
  } catch (x) {
    er.textContent = x.message;
    er.hidden = false;
  }
};
$("#forgotForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await api("/api/auth/forgot", {
      method: "POST",
      body: JSON.stringify({ email: $("#forgotEmail").value }),
    });
    $("#forgotError").textContent = d.message;
    $("#forgotError").hidden = false;
  } catch (x) {
    $("#forgotError").textContent = x.message;
    $("#forgotError").hidden = false;
  }
};
async function enter(user) {
  me = user;
  dialog.close();
  publicSite.hidden = true;
  privateApp.hidden = false;
  document.body.classList.add("member-mode");
  setIdentity();
  await refresh();
  showView(me.role === "admin" ? "admin-dashboard" : "dashboard");
}
function setIdentity() {
  const a = me.role === "admin",
    name = `${me.firstName || ""} ${me.lastName || ""}`.trim() || me.email;
  $("#memberNav").hidden = a;
  $("#adminNav").hidden = !a;
  $("#sidebarName").textContent = name;
  $("#sidebarRole").textContent = a ? "Administrador" : "Miembro";
  $("#sidebarAvatar").textContent = a
    ? "AD"
    : (me.firstName?.[0] || "M") + (me.lastName?.[0] || "P");
  $("#topAvatar").textContent = $("#sidebarAvatar").textContent;
  $("#topName").textContent = me.firstName || "Miembro";
  $("#areaKicker").textContent = a
    ? "MOMENTUM+ · ADMINISTRACIÓN"
    : "MOMENTUM+ · ÁREA PRIVADA";
  $("#profileAvatar").textContent = $("#sidebarAvatar").textContent;
  $("#profileName").textContent = name;
  $("#profileRole").textContent = a ? "Administrador" : "Miembro";
  $("#profileFirstName").value = me.firstName || "";
  $("#profileLastName").value = me.lastName || "";
  $("#profileEmail").value = me.email || "";
  $("#profileEmail").disabled = true;
  $("#profilePhone").value = me.phone || "";
  $("#welcomeName").textContent = me.firstName || "Miembro";
}
const titles = {
  dashboard: "Inicio",
  academy: "Academia",
  biblioteca: "Biblioteca",
  "eventos-member": "Eventos",
  perfil: "Mi perfil",
  "admin-dashboard": "Resumen",
  "admin-academy": "Gestionar Academia",
  "admin-library": "Gestionar Biblioteca",
  "admin-events": "Gestionar Eventos",
  "admin-users": "Usuarios",
};
function showView(v) {
  $$(".member-view").forEach((x) => x.classList.remove("active"));
  $("#view-" + v)?.classList.add("active");
  $$(".nav-item[data-view]").forEach((x) =>
    x.classList.toggle("active", x.dataset.view === v),
  );
  $("#viewTitle").textContent = titles[v] || "MOMENTUM+";
  sidebar.classList.remove("open");
  scrollTo(0, 0);
}
document.addEventListener("click", (e) => {
  const x = e.target.closest("[data-view]");
  if (x && !privateApp.hidden) showView(x.dataset.view);
});
$("#menuBtn").onclick = () => sidebar.classList.add("open");
$("#sidebarClose").onclick = () => sidebar.classList.remove("open");
$("#logoutBtn").onclick = async () => {
  await api("/api/auth/logout", { method: "POST" });
  me = null;
  privateApp.hidden = true;
  publicSite.hidden = false;
  document.body.classList.remove("member-mode");
};
async function refresh() {
  [lessons, resources, events] = await Promise.all([
    api("/api/lessons"),
    api("/api/resources"),
    api("/api/events"),
  ]);
  if (me.role === "admin") users = await api("/api/admin/users");
  renderAll();
}
function doneSet() {
  return new Set((me.completedLessons || []).map(String));
}
function progress() {
  return lessons.length
    ? Math.round((doneSet().size / lessons.length) * 100)
    : 0;
}
function renderHome() {
  const p = progress();
  $("#progressPct").textContent = p + "%";
  $("#progressBar").style.width = p + "%";
  $("#nextLessonText").textContent =
    `${doneSet().size} de ${lessons.length} lecciones completadas`;
  $("#eventCountText").textContent =
    `${events.filter((e) => !isPastEvent(e)).length} próximos eventos.`;
}
function renderAcademy() {
  const ds = doneSet(),
    levels = ["Empieza aquí", "Nivel 1", "Nivel 2", "Nivel 3", "Liderazgo"];
  $("#academyPath").innerHTML =
    levels
      .map((level, idx) => {
        const ls = lessons.filter((x) => x.level === level);
        if (!ls.length) return "";
        const done = ls.filter((x) => ds.has(String(x._id))).length;
        const open =
          idx === 0 ||
          levels
            .slice(0, idx)
            .every((prev) =>
              lessons
                .filter((x) => x.level === prev)
                .every((x) => ds.has(String(x._id))),
            );
        return `<article class="academy-stage ${done === ls.length ? "done" : open ? "current" : "locked"}"><div>${done === ls.length ? "✓" : idx === 4 ? "★" : idx}</div><section><small>${level.toUpperCase()}</small><h3>${level}</h3><p>${done}/${ls.length} lecciones completadas</p><div class="lesson-mini-list">${ls.map((l) => `<label class="lesson-mini ${!open ? "disabled" : ""}"><input type="checkbox" aria-label="Marcar lección completada: ${esc(l.title)}" data-lesson-id="${l._id}" ${ds.has(String(l._id)) ? "checked" : ""} ${!open ? "disabled" : ""}><span>${esc(l.title)}${l.url ? ` <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" class="lesson-open">Ver contenido ↗</a>` : ""}</span><em>${esc(l.format)}</em></label>`).join("")}</div></section><span class="stage-state">${done === ls.length ? "Completado" : open ? "Disponible" : "Bloqueado"}</span></article>`;
      })
      .join("") ||
    '<div class="empty-state">Todavía no hay lecciones publicadas.</div>';
  $$("[data-lesson-id]").forEach(
    (c) =>
      (c.onchange = async () => {
        const d = await api(
          "/api/lessons/" + c.dataset.lessonId + "/complete",
          { method: "POST", body: JSON.stringify({ done: c.checked }) },
        );
        me = d.user;
        renderAll();
      }),
  );
}
function renderLibrary() {
  const q = ($("#librarySearch")?.value || "").toLowerCase();
  const f = resources.filter(
    (r) =>
      (libraryFilter === "Todos" || r.type === libraryFilter) &&
      `${r.title} ${r.description}`.toLowerCase().includes(q),
  );
  $("#memberLibraryGrid").innerHTML =
    f
      .map(
        (r) =>
          `<article class="resource-card"><div class="file-icon">${r.type === "Presentación" ? "PPT" : r.type === "Vídeo" ? "VID" : "PDF"}</div><span>${esc(r.type || "RECURSO")}</span><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p>${r.url ? `<a class="resource-link" href="${r.url}" target="_blank">Abrir recurso →</a>` : ""}</article>`,
      )
      .join("") || '<div class="empty-state">No hay recursos.</div>';
}
function isPastEvent(e) {
  if (!e.date) return false;
  const t = new Date(`${e.date}T${e.time || "23:59"}:00`);
  return !Number.isNaN(t.getTime()) && t.getTime() < Date.now();
}
function eventState(e) {
  return isPastEvent(e)
    ? '<span class="event-ended">Finalizado</span>'
    : '<span class="event-upcoming">Próximo evento</span>';
}
function renderEvents() {
  const box = $("#memberEventsList");
  box.innerHTML =
    events
      .map(
        (e) =>
          `<article class="member-event-card ${isPastEvent(e) ? "past-event" : ""}"><div class="date-tile"><b>${new Date(e.date + "T12:00:00").getDate()}</b><span>${new Date(e.date + "T12:00:00").toLocaleDateString("es", { month: "short" }).toUpperCase()}</span></div><div><span class="pill">${esc(e.type)}</span> ${eventState(e)}<h3>${esc(e.title)}</h3><p>${esc(e.date)} · ${esc(e.time)}</p></div><button class="btn btn-outline" data-event="${e._id}">Ver detalles</button></article>`,
      )
      .join("") || '<div class="empty-state">No hay eventos publicados.</div>';
  $$("[data-event]").forEach(
    (b) =>
      (b.onclick = () =>
        openEvent(events.find((e) => e._id === b.dataset.event))),
  );
}
function openEvent(e) {
  $("#eventDetailsType").textContent =
    (e.type || "EVENTO") + (isPastEvent(e) ? " · FINALIZADO" : "");
  $("#eventDetailsTitle").textContent = e.title;
  $("#eventDetailsMeta").textContent = `${e.date || ""} · ${e.time || ""}`;
  $("#eventDetailsDescription").textContent =
    e.description || "Sin descripción.";
  $("#eventDetailsActions").innerHTML =
    e.link && !isPastEvent(e)
      ? `<a class="btn btn-primary" href="${e.link}" target="_blank">Acceder al evento</a>`
      : "";
  $("#eventDetailsDialog").showModal();
}
$("#closeEventDetails").onclick = () => $("#eventDetailsDialog").close();
function resourcePreview(url, format) {
  if (!url) return '<div class="admin-thumb">SIN ARCHIVO</div>';
  const clean = esc(url);
  const type = (format || "").toLowerCase();
  if (type.includes("vídeo") || /\.(mp4|webm)(\?|$)/i.test(url))
    return `<video class="admin-thumb" src="${clean}" controls preload="metadata"></video>`;
  if (type.includes("pdf") || /\.pdf(\?|$)/i.test(url))
    return `<iframe class="admin-thumb" title="Vista previa PDF" loading="lazy" src="${clean}#toolbar=0"></iframe>`;
  return `<div class="admin-thumb admin-thumb-file">${type.includes("presentación") ? "PPT" : "ARCHIVO"}</div>`;
}
function adminCard(item, kind, meta, desc) {
  const url = item.url || "";
  return `<article class="admin-content-card"><div class="admin-content-preview">${resourcePreview(url, item.format || item.type)}</div><div class="admin-content-info"><span class="admin-meta">${esc(meta)}</span><h3>${esc(item.title)}</h3>${desc ? `<p>${esc(desc)}</p>` : ""}<div class="admin-actions">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="admin-action-link">Abrir / previsualizar ↗</a>` : ""}<button class="admin-delete" data-del-${kind}="${item._id}">Eliminar</button></div></div></article>`;
}
function renderAdmin() {
  if (me.role !== "admin") return;
  $("#adminUsersCount").textContent = users.filter(
    (u) => u.status === "active",
  ).length;
  $("#adminResourcesCount").textContent = resources.length;
  $("#adminEventsCount").textContent = events.length;
  $("#adminLessonsCount").textContent = lessons.length;
  $("#resourceListCount").textContent = resources.length;
  $("#eventListCount").textContent = events.length;
  $("#lessonListCount").textContent = lessons.length;
  $("#adminResourceList").innerHTML =
    resources
      .map((r) => adminCard(r, "resource", r.type, r.description))
      .join("") ||
    '<p class="empty-state">Todavía no hay recursos publicados.</p>';
  $("#adminLessonList").innerHTML =
    lessons
      .map((l) =>
        adminCard(
          l,
          "lesson",
          l.level + " · " + l.format,
          "Lección de Academia",
        ),
      )
      .join("") || '<p class="empty-state">Todavía no hay lecciones.</p>';
  $("#adminEventList").innerHTML =
    events
      .map(
        (e) =>
          `<article class="admin-content-card admin-event-row"><div class="admin-date"><strong>${esc(e.date || "—")}</strong><span>${esc(e.time || "")}</span></div><div class="admin-content-info"><span class="admin-meta">${esc(e.type || "Evento")} · ${isPastEvent(e) ? "Finalizado" : "Próximo"}</span><h3>${esc(e.title)}</h3><p>${esc(e.description || "Sin descripción")}</p><div class="admin-actions">${e.link ? `<a class="admin-action-link" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">Enlace del evento ↗</a>` : ""}<button class="admin-delete" data-del-event="${e._id}">Eliminar</button></div></div></article>`,
      )
      .join("") || '<p class="empty-state">Todavía no hay eventos.</p>';
  renderUsers();
  $$("[data-del-resource]").forEach(
    (b) =>
      (b.onclick = () => del("/api/admin/resources/" + b.dataset.delResource)),
  );
  $$("[data-del-event]").forEach(
    (b) => (b.onclick = () => del("/api/admin/events/" + b.dataset.delEvent)),
  );
  $$("[data-del-lesson]").forEach(
    (b) => (b.onclick = () => del("/api/admin/lessons/" + b.dataset.delLesson)),
  );
}
async function del(url) {
  if (!confirm("¿Eliminar este elemento?")) return;
  await api(url, { method: "DELETE" });
  await refresh();
}
function renderUsers() {
  const q = ($("#userSearch")?.value || "").toLowerCase();
  $("#usersTableBody").innerHTML = users
    .filter((u) =>
      (u.firstName + " " + u.lastName + " " + u.email)
        .toLowerCase()
        .includes(q),
    )
    .map(
      (u) =>
        `<tr><td>${esc(u.firstName + " " + u.lastName)}</td><td>${esc(u.email)}</td><td>${u.completedLessons?.length || 0}/${lessons.length}</td><td>${esc(u.status)}</td><td><button data-toggle-user="${u.id}" data-status="${u.status}">${u.status === "active" ? "Desactivar" : "Activar"}</button> <button data-delete-user="${u.id}">Eliminar</button></td></tr>`,
    )
    .join("");
  $$("[data-toggle-user]").forEach(
    (b) =>
      (b.onclick = async () => {
        await api("/api/admin/users/" + b.dataset.toggleUser, {
          method: "PATCH",
          body: JSON.stringify({
            status: b.dataset.status === "active" ? "disabled" : "active",
          }),
        });
        await refresh();
      }),
  );
  $$("[data-delete-user]").forEach(
    (b) => (b.onclick = () => del("/api/admin/users/" + b.dataset.deleteUser)),
  );
}
function renderAll() {
  setIdentity();
  renderHome();
  renderAcademy();
  renderLibrary();
  renderEvents();
  renderAdmin();
}
$("#librarySearch").oninput = renderLibrary;
$("#libraryFilters").onclick = (e) => {
  const b = e.target.closest("[data-filter]");
  if (!b) return;
  libraryFilter = b.dataset.filter;
  $$("#libraryFilters button").forEach((x) =>
    x.classList.toggle("active", x === b),
  );
  renderLibrary();
};
$("#userSearch").oninput = renderUsers;
$("#resourceForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData();
  f.append("title", $("#resourceTitle").value);
  f.append("type", $("#resourceType").value);
  f.append("description", $("#resourceDescription").value);
  f.append("link", $("#resourceLink").value);
  if ($("#resourceFile").files[0])
    f.append("file", $("#resourceFile").files[0]);
  await api("/api/admin/resources", { method: "POST", body: f });
  e.target.reset();
  toast("Recurso publicado");
  await refresh();
};
$("#lessonForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData();
  f.append("title", $("#lessonTitle").value);
  f.append("level", $("#lessonLevel").value);
  f.append("format", $("#lessonFormat").value);
  f.append("link", $("#lessonLink").value);
  if ($("#lessonFile").files[0]) f.append("file", $("#lessonFile").files[0]);
  await api("/api/admin/lessons", { method: "POST", body: f });
  e.target.reset();
  toast("Lección publicada");
  await refresh();
};
$("#eventForm").onsubmit = async (e) => {
  e.preventDefault();
  await api("/api/admin/events", {
    method: "POST",
    body: JSON.stringify({
      title: $("#eventTitle").value,
      date: $("#eventDate").value,
      time: $("#eventTime").value,
      type: $("#eventType").value,
      description: $("#eventDescription").value,
      link: $("#eventLink").value,
    }),
  });
  e.target.reset();
  toast("Evento publicado");
  await refresh();
};
$("#addDemoUser").onclick = async () => {
  const firstName = prompt("Nombre del usuario:");
  if (!firstName) return;
  const lastName = prompt("Apellidos:") || "";
  const email = prompt("Email:");
  if (!email) return;
  const password = prompt(
    "Contraseña inicial (mín. 8 caracteres):",
    "momentum2026",
  );
  if (!password) return;
  try {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password,
        role: "member",
      }),
    });
    await refresh();
  } catch (e) {
    alert(e.message);
  }
};
$("#saveProfile").onclick = async () => {
  const d = await api("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({
      firstName: $("#profileFirstName").value,
      lastName: $("#profileLastName").value,
      phone: $("#profilePhone").value,
    }),
  });
  me = d.user;
  setIdentity();
  toast("Perfil actualizado");
};
$("#changePassword").onclick = async () => {
  try {
    await api("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: $("#currentPassword").value,
        newPassword: $("#newPassword").value,
      }),
    });
    $("#currentPassword").value = "";
    $("#newPassword").value = "";
    toast("Contraseña actualizada");
  } catch (e) {
    alert(e.message);
  }
};
$("#sendResetEmail").onclick = async () => {
  const d = await api("/api/auth/forgot", {
    method: "POST",
    body: JSON.stringify({ email: me.email }),
  });
  toast(d.message);
};
(async () => {
  try {
    const d = await api("/api/auth/me");
    await enter(d.user);
  } catch {}
})();

$("#resendVerification").onclick = async () => {
  const email = $("#loginEmail").value.trim();
  if (!email) {
    $("#loginError").textContent = "Introduce tu email primero.";
    $("#loginError").hidden = false;
    return;
  }
  try {
    const d = await api("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    $("#loginError").textContent = d.message;
    $("#loginError").hidden = false;
  } catch (e) {
    $("#loginError").textContent = e.message;
    $("#loginError").hidden = false;
  }
};
if (new URLSearchParams(location.search).has("verified")) {
  toast("Correo confirmado. Ya puedes iniciar sesión.");
  history.replaceState({}, "", location.pathname);
  dialog.showModal();
}

// Animaciones progresivas en la landing (respetan accesibilidad).
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -25px 0px" },
  );
  document
    .querySelectorAll(
      "#publicSite .section, #publicSite .cta, #publicSite .member-preview, #publicSite .hero-copy, #publicSite .hero-visual",
    )
    .forEach((el) => {
      el.classList.add("reveal-on-scroll");
      observer.observe(el);
    });
}
