import { BASE_URL } from "../config.js";
import { officesStore } from "../state/offices.js";

const TABS = ["OFICINAS", "USUARIOS", "FIJOS"] as const;
type Tab = (typeof TABS)[number];

let panelEl: HTMLDivElement | null = null;
let editDesksCallback: ((officeId: number) => void) | null = null;
let pickDeskCallback: ((onPicked: (deskId: number, deskLabel: string) => void) => void) | null = null;

export function setEditDesksCallback(cb: (officeId: number) => void): void {
  editDesksCallback = cb;
}

export function setPickDeskCallback(cb: (onPicked: (deskId: number, deskLabel: string) => void) => void): void {
  pickDeskCallback = cb;
}

export function mountAdminPanel(initialTab: Tab = "OFICINAS", preselectedDeskId?: number): void {
  if (panelEl) return;

  const overlay = document.createElement("div");
  overlay.id = "admin-panel";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.85)",
    zIndex: "100",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"Press Start 2P", monospace',
  });

  const box = document.createElement("div");
  Object.assign(box.style, {
    background: "#1a1a2e",
    border: "2px solid #36e36c",
    padding: "24px",
    minWidth: "640px",
    maxWidth: "90vw",
    maxHeight: "80vh",
    overflowY: "auto",
    position: "relative",
  });

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  });

  const title = document.createElement("span");
  title.textContent = "PANEL DE ADMIN";
  Object.assign(title.style, { color: "#36e36c", fontSize: "14px" });

  const closeBtn = document.createElement("button");
  closeBtn.id = "admin-panel-close";
  closeBtn.textContent = "✕";
  Object.assign(closeBtn.style, {
    background: "transparent",
    border: "none",
    color: "#f5f5f5",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "14px",
    cursor: "pointer",
  });
  closeBtn.addEventListener("click", () => unmountAdminPanel());

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Tab bar
  const tabBar = document.createElement("div");
  Object.assign(tabBar.style, {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    borderBottom: "1px solid #36e36c",
    paddingBottom: "8px",
  });

  // Content area
  const content = document.createElement("div");
  content.id = "admin-panel-content";

  let activeTab: Tab = initialTab;

  function renderTab(tab: Tab): void {
    activeTab = tab;
    // Update tab button styles
    tabBar.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
      const isActive = btn.dataset["tab"] === tab;
      btn.style.color = isActive ? "#36e36c" : "#8e92a8";
      btn.style.borderBottom = isActive ? "2px solid #36e36c" : "2px solid transparent";
    });

    content.innerHTML = "";
    if (tab === "OFICINAS") renderOficinas(content);
    else if (tab === "USUARIOS") renderUsuarios(content);
    else if (tab === "FIJOS") renderFijos(content, preselectedDeskId);
  }

  for (const tab of TABS) {
    const btn = document.createElement("button");
    btn.dataset["tab"] = tab;
    btn.textContent = tab;
    Object.assign(btn.style, {
      background: "transparent",
      border: "none",
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "10px",
      cursor: "pointer",
      paddingBottom: "4px",
    });
    btn.addEventListener("click", () => renderTab(tab));
    tabBar.appendChild(btn);
  }

  box.appendChild(header);
  box.appendChild(tabBar);
  box.appendChild(content);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  panelEl = overlay;

  renderTab(activeTab);
}

export function unmountAdminPanel(): void {
  panelEl?.remove();
  panelEl = null;
}

// ── Oficinas tab ──────────────────────────────────────────────────────────────

function renderOficinas(container: HTMLElement): void {
  container.innerHTML = '<p style="color:#8e92a8;font-size:10px">Cargando oficinas…</p>';

  fetch(`${BASE_URL}/api/offices`, { credentials: "include" })
    .then((r) => r.json())
    .then((offices: { id: number; name: string }[]) => {
      container.innerHTML = "";

      // Create form
      const form = buildCreateOfficeForm(() => renderOficinas(container));
      container.appendChild(form);

      // List
      if (offices.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No hay oficinas.";
        Object.assign(empty.style, { color: "#8e92a8", fontSize: "10px", marginTop: "12px" });
        container.appendChild(empty);
        return;
      }

      const list = document.createElement("div");
      list.style.marginTop = "16px";
      for (const o of offices) {
        list.appendChild(buildOfficeRow(o, () => renderOficinas(container)));
      }
      container.appendChild(list);
    })
    .catch(() => {
      container.innerHTML = '<p style="color:#e33636;font-size:10px">Error al cargar oficinas.</p>';
    });
}

function buildCreateOfficeForm(onCreated: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "12px";

  const label = document.createElement("p");
  label.textContent = "CREAR OFICINA";
  Object.assign(label.style, { color: "#36e36c", fontSize: "10px", marginBottom: "8px" });
  wrap.appendChild(label);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nombre";
  nameInput.id = "admin-new-office-name";
  Object.assign(nameInput.style, {
    background: "#0d0d1a",
    border: "1px solid #36e36c",
    color: "#f5f5f5",
    fontFamily: '"VT323", monospace',
    fontSize: "18px",
    padding: "4px 8px",
    marginRight: "8px",
    width: "200px",
  });
  wrap.appendChild(nameInput);

  const tmjLabel = document.createElement("label");
  tmjLabel.textContent = "Mapa .tmj:";
  Object.assign(tmjLabel.style, {
    color: "#8e92a8",
    fontSize: "9px",
    display: "block",
    marginTop: "6px",
  });
  wrap.appendChild(tmjLabel);

  const tmjInput = document.createElement("input");
  tmjInput.type = "file";
  tmjInput.accept = ".tmj,.json";
  tmjInput.id = "admin-new-office-tmj";
  Object.assign(tmjInput.style, {
    color: "#8e92a8",
    fontSize: "10px",
    display: "block",
    marginBottom: "4px",
  });
  wrap.appendChild(tmjInput);

  const tilesetsLabel = document.createElement("label");
  tilesetsLabel.textContent = "Tilesets (.png o .webp, uno o más):";
  Object.assign(tilesetsLabel.style, { color: "#8e92a8", fontSize: "9px", display: "block" });
  wrap.appendChild(tilesetsLabel);

  const tilesetsInput = document.createElement("input");
  tilesetsInput.type = "file";
  tilesetsInput.accept = ".png,.webp";
  tilesetsInput.multiple = true;
  tilesetsInput.id = "admin-new-office-tilesets";
  Object.assign(tilesetsInput.style, {
    color: "#8e92a8",
    fontSize: "10px",
    display: "block",
    marginBottom: "8px",
  });
  wrap.appendChild(tilesetsInput);

  const btn = document.createElement("button");
  btn.textContent = "CREAR";
  btn.id = "admin-create-office-btn";
  Object.assign(btn.style, {
    background: "#36e36c",
    border: "none",
    color: "#0d0d1a",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "10px",
    padding: "6px 12px",
    cursor: "pointer",
  });
  btn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) return;
    const tmjFile = tmjInput.files?.[0];
    if (!tmjFile) {
      btn.textContent = "FALTA .TMJ";
      return;
    }
    const tilesetFiles = tilesetsInput.files;
    if (!tilesetFiles || tilesetFiles.length === 0) {
      btn.textContent = "FALTA TILESET";
      return;
    }

    const fd = new FormData();
    fd.append("name", name);
    fd.append("tmj", tmjFile);
    for (const f of Array.from(tilesetFiles)) fd.append("tilesets", f);

    fetch(`${BASE_URL}/api/offices`, {
      method: "POST",
      credentials: "include",
      body: fd,
    })
      .then((r) => {
        if (!r.ok) throw new Error("error");
        onCreated();
      })
      .catch(() => {
        btn.textContent = "ERROR";
      });
  });
  wrap.appendChild(btn);

  return wrap;
}

function buildOfficeRow(office: { id: number; name: string }, onChanged: () => void): HTMLElement {
  const row = document.createElement("div");
  row.dataset["officeId"] = String(office.id);
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "8px",
    color: "#f5f5f5",
    fontSize: "10px",
  });

  const nameEl = document.createElement("span");
  nameEl.textContent = office.name;
  nameEl.style.flex = "1";
  nameEl.style.cursor = "pointer";
  nameEl.title = "Clic para renombrar";
  nameEl.addEventListener("click", () => {
    const newName = prompt("Nuevo nombre:", office.name);
    if (!newName || newName === office.name) return;
    fetch(`${BASE_URL}/api/offices/${office.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    })
      .then((r) => {
        if (r.ok) onChanged();
      })
      .catch(() => {});
  });

  const delBtn = document.createElement("button");
  delBtn.textContent = "Eliminar";
  Object.assign(delBtn.style, {
    background: "transparent",
    border: "1px solid #e33636",
    color: "#e33636",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "8px",
    padding: "4px 6px",
    cursor: "pointer",
  });
  delBtn.addEventListener("click", () => {
    if (!confirm(`¿Eliminar "${office.name}"?`)) return;
    fetch(`${BASE_URL}/api/offices/${office.id}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((r) => {
        if (r.ok) onChanged();
      })
      .catch(() => {});
  });

  const editBtn = document.createElement("button");
  editBtn.textContent = "Editar puestos";
  Object.assign(editBtn.style, {
    background: "transparent",
    border: "1px solid #8e92a8",
    color: "#8e92a8",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "8px",
    padding: "4px 6px",
    cursor: "pointer",
  });
  editBtn.addEventListener("click", () => {
    unmountAdminPanel();
    editDesksCallback?.(office.id);
  });

  const adminsBtn = document.createElement("button");
  adminsBtn.textContent = "Admins";
  Object.assign(adminsBtn.style, {
    background: "transparent",
    border: "1px solid #36e36c",
    color: "#36e36c",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "8px",
    padding: "4px 6px",
    cursor: "pointer",
  });

  const adminsPanel = document.createElement("div");
  adminsPanel.style.display = "none";
  adminsPanel.style.marginTop = "8px";
  adminsPanel.style.paddingLeft = "12px";

  adminsBtn.addEventListener("click", () => {
    if (adminsPanel.style.display === "none") {
      loadOfficeAdmins(office.id, adminsPanel);
      adminsPanel.style.display = "block";
    } else {
      adminsPanel.style.display = "none";
    }
  });

  const updateMapBtn = document.createElement("button");
  updateMapBtn.textContent = "Actualizar mapa ▼";
  Object.assign(updateMapBtn.style, {
    background: "transparent",
    border: "1px solid #8e92a8",
    color: "#8e92a8",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "8px",
    padding: "4px 6px",
    cursor: "pointer",
  });

  const updateMapForm = buildUpdateMapForm(office.id, () => {
    updateMapForm.style.display = "none";
    updateMapBtn.textContent = "Actualizar mapa ▼";
    onChanged();
  });
  updateMapForm.style.display = "none";

  updateMapBtn.addEventListener("click", () => {
    const open = updateMapForm.style.display !== "none";
    updateMapForm.style.display = open ? "none" : "block";
    updateMapBtn.textContent = open ? "Actualizar mapa ▼" : "Actualizar mapa ▲";
  });

  row.appendChild(nameEl);
  row.appendChild(updateMapBtn);
  row.appendChild(editBtn);
  row.appendChild(adminsBtn);
  row.appendChild(delBtn);

  const wrap = document.createElement("div");
  wrap.appendChild(row);
  wrap.appendChild(updateMapForm);
  wrap.appendChild(adminsPanel);
  return wrap;
}

function buildUpdateMapForm(officeId: number, onSaved: () => void): HTMLElement {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    padding: "10px 0 10px 12px",
    borderLeft: "2px solid #8e92a8",
    marginBottom: "8px",
  });

  const tmjLabel = document.createElement("label");
  tmjLabel.textContent = "Mapa .tmj:";
  Object.assign(tmjLabel.style, {
    color: "#8e92a8",
    fontSize: "9px",
    display: "block",
    marginBottom: "4px",
  });
  wrap.appendChild(tmjLabel);

  const tmjInput = document.createElement("input");
  tmjInput.type = "file";
  tmjInput.accept = ".tmj,.json";
  Object.assign(tmjInput.style, {
    color: "#8e92a8",
    fontSize: "10px",
    display: "block",
    marginBottom: "6px",
  });
  wrap.appendChild(tmjInput);

  const tilesetsLabel = document.createElement("label");
  tilesetsLabel.textContent = "Tilesets (.png o .webp, uno o más):";
  Object.assign(tilesetsLabel.style, {
    color: "#8e92a8",
    fontSize: "9px",
    display: "block",
    marginBottom: "4px",
  });
  wrap.appendChild(tilesetsLabel);

  const tilesetsInput = document.createElement("input");
  tilesetsInput.type = "file";
  tilesetsInput.accept = ".png,.webp";
  tilesetsInput.multiple = true;
  Object.assign(tilesetsInput.style, {
    color: "#8e92a8",
    fontSize: "10px",
    display: "block",
    marginBottom: "8px",
  });
  wrap.appendChild(tilesetsInput);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "GUARDAR";
  Object.assign(saveBtn.style, {
    background: "#36e36c",
    border: "none",
    color: "#0d0d1a",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "10px",
    padding: "6px 12px",
    cursor: "pointer",
  });

  saveBtn.addEventListener("click", () => {
    const tmjFile = tmjInput.files?.[0];
    if (!tmjFile) {
      saveBtn.textContent = "FALTA .TMJ";
      return;
    }
    const tilesetFiles = tilesetsInput.files;
    if (!tilesetFiles || tilesetFiles.length === 0) {
      saveBtn.textContent = "FALTA TILESET";
      return;
    }

    saveBtn.textContent = "GUARDANDO…";
    saveBtn.disabled = true;

    const fd = new FormData();
    fd.append("tmj", tmjFile);
    for (const f of Array.from(tilesetFiles)) fd.append("tilesets", f);

    fetch(`${BASE_URL}/api/offices/${officeId}`, {
      method: "PATCH",
      credentials: "include",
      body: fd,
    })
      .then((r) => {
        if (!r.ok) throw new Error("error");
        onSaved();
      })
      .catch(() => {
        saveBtn.textContent = "ERROR";
        saveBtn.disabled = false;
      });
  });

  wrap.appendChild(saveBtn);
  return wrap;
}

function loadOfficeAdmins(officeId: number, container: HTMLElement): void {
  container.innerHTML = '<p style="color:#8e92a8;font-size:10px">Cargando admins…</p>';
  fetch(`${BASE_URL}/api/offices/${officeId}/admins`, { credentials: "include" })
    .then((r) => r.json())
    .then((admins: { id: number; name: string; email: string }[]) => {
      container.innerHTML = "";
      if (admins.length === 0) {
        container.innerHTML = '<p style="color:#8e92a8;font-size:10px">Sin admins asignados.</p>';
        return;
      }
      for (const a of admins) {
        const line = document.createElement("p");
        line.textContent = `${a.name} (${a.email})`;
        Object.assign(line.style, { color: "#f5f5f5", fontSize: "10px", margin: "2px 0" });
        container.appendChild(line);
      }
    })
    .catch(() => {
      container.innerHTML = '<p style="color:#e33636;font-size:10px">Error.</p>';
    });
}

// ── Usuarios tab ──────────────────────────────────────────────────────────────

function renderUsuarios(container: HTMLElement): void {
  container.innerHTML = '<p style="color:#8e92a8;font-size:10px">Cargando usuarios…</p>';

  Promise.all([
    fetch(`${BASE_URL}/api/users`, { credentials: "include" }).then((r) => r.json()),
    fetch(`${BASE_URL}/api/invitations?include=all`, { credentials: "include" }).then((r) =>
      r.json(),
    ),
  ])
    .then(
      ([users, invitations]: [
        { id: number; name: string; email: string; role: string }[],
        {
          id: number;
          email: string;
          expires_at: string;
          accepted_at: string | null;
          invited_by_name: string;
        }[],
      ]) => {
        container.innerHTML = "";

        // Users section
        const userTitle = document.createElement("p");
        userTitle.textContent = "USUARIOS";
        Object.assign(userTitle.style, { color: "#36e36c", fontSize: "10px", marginBottom: "8px" });
        container.appendChild(userTitle);

        for (const u of users) {
          container.appendChild(buildUserRow(u, () => renderUsuarios(container)));
        }

        // Invitations section
        const invTitle = document.createElement("p");
        invTitle.textContent = "INVITACIONES";
        Object.assign(invTitle.style, { color: "#36e36c", fontSize: "10px", margin: "16px 0 8px" });
        container.appendChild(invTitle);

        container.appendChild(buildInviteForm(() => renderUsuarios(container)));

        for (const inv of invitations) {
          container.appendChild(buildInvRow(inv, () => renderUsuarios(container)));
        }
      },
    )
    .catch(() => {
      container.innerHTML = '<p style="color:#e33636;font-size:10px">Error al cargar.</p>';
    });
}

function buildUserRow(
  user: { id: number; name: string; email: string; role: string },
  onChanged: () => void,
): HTMLElement {
  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "6px",
    fontSize: "10px",
    color: "#f5f5f5",
  });

  const info = document.createElement("span");
  info.textContent = `${user.name} (${user.email}) — ${user.role}`;
  info.style.flex = "1";
  row.appendChild(info);

  const isAdmin = user.role === "admin";
  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = isAdmin ? "Degradar" : "Promover";
  Object.assign(toggleBtn.style, {
    background: "transparent",
    border: `1px solid ${isAdmin ? "#e36c36" : "#36e36c"}`,
    color: isAdmin ? "#e36c36" : "#36e36c",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "8px",
    padding: "4px 6px",
    cursor: "pointer",
  });
  toggleBtn.addEventListener("click", () => {
    fetch(`${BASE_URL}/api/users/${user.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: isAdmin ? "member" : "admin" }),
    })
      .then((r) => {
        if (r.ok) onChanged();
      })
      .catch(() => {});
  });
  row.appendChild(toggleBtn);

  return row;
}

function buildInviteForm(onCreated: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "8px";

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.placeholder = "email@externo.com";
  emailInput.id = "admin-invite-email";
  Object.assign(emailInput.style, {
    background: "#0d0d1a",
    border: "1px solid #36e36c",
    color: "#f5f5f5",
    fontFamily: '"VT323", monospace',
    fontSize: "18px",
    padding: "4px 8px",
    marginRight: "8px",
    width: "220px",
  });
  wrap.appendChild(emailInput);

  const btn = document.createElement("button");
  btn.textContent = "INVITAR";
  btn.id = "admin-invite-btn";
  Object.assign(btn.style, {
    background: "#36e36c",
    border: "none",
    color: "#0d0d1a",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "10px",
    padding: "6px 12px",
    cursor: "pointer",
  });
  btn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    if (!email) return;
    fetch(`${BASE_URL}/api/invitations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("error");
        emailInput.value = "";
        onCreated();
      })
      .catch(() => {
        btn.textContent = "ERROR";
      });
  });
  wrap.appendChild(btn);

  return wrap;
}

function buildInvRow(
  inv: {
    id: number;
    email: string;
    expires_at: string;
    accepted_at: string | null;
    invited_by_name: string;
  },
  onChanged: () => void,
): HTMLElement {
  const now = Date.now();
  const expired = new Date(inv.expires_at).getTime() < now;
  const accepted = inv.accepted_at != null;
  const statusIcon = accepted ? "✅" : expired ? "🔴" : "🟢";

  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "6px",
    fontSize: "10px",
    color: "#f5f5f5",
  });

  const info = document.createElement("span");
  info.textContent = `${statusIcon} ${inv.email}`;
  info.style.flex = "1";
  row.appendChild(info);

  if (!accepted) {
    const revokeBtn = document.createElement("button");
    revokeBtn.textContent = "Revocar";
    Object.assign(revokeBtn.style, {
      background: "transparent",
      border: "1px solid #e33636",
      color: "#e33636",
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "8px",
      padding: "4px 6px",
      cursor: "pointer",
    });
    revokeBtn.addEventListener("click", () => {
      fetch(`${BASE_URL}/api/invitations/${inv.id}`, {
        method: "DELETE",
        credentials: "include",
      })
        .then((r) => {
          if (r.ok) onChanged();
        })
        .catch(() => {});
    });
    row.appendChild(revokeBtn);
  }

  if (expired || accepted) {
    const renewBtn = document.createElement("button");
    renewBtn.textContent = "Renovar";
    Object.assign(renewBtn.style, {
      background: "transparent",
      border: "1px solid #36e36c",
      color: "#36e36c",
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "8px",
      padding: "4px 6px",
      cursor: "pointer",
    });
    renewBtn.addEventListener("click", () => {
      fetch(`${BASE_URL}/api/invitations/${inv.id}/renew`, {
        method: "POST",
        credentials: "include",
      })
        .then((r) => {
          if (r.ok) onChanged();
        })
        .catch(() => {});
    });
    row.appendChild(renewBtn);
  }

  return row;
}

// ── Fijos tab ─────────────────────────────────────────────────────────────────

type UserRow = { id: number; name: string; email: string; avatarUrl?: string | null };
type DeskRow = { id: number; label: string };
type AssignmentRow = { id: number; desk: { label: string }; user: { name: string; email: string } };

function renderFijos(container: HTMLElement, preselectedDeskId?: number): void {
  container.innerHTML = '<p style="color:#8e92a8;font-size:10px">Cargando oficinas…</p>';

  Promise.all([
    fetch(`${BASE_URL}/api/offices`, { credentials: "include" }).then((r) => r.json()) as Promise<{ id: number; name: string }[]>,
    fetch(`${BASE_URL}/api/users`, { credentials: "include" }).then((r) => r.json()) as Promise<UserRow[]>,
  ])
    .then(([offices, users]) => {
      container.innerHTML = "";

      if (offices.length === 0) {
        container.innerHTML = '<p style="color:#8e92a8;font-size:10px">No hay oficinas.</p>';
        return;
      }

      // Office selector
      const sel = document.createElement("select");
      Object.assign(sel.style, {
        background: "#0d0d1a",
        border: "1px solid #36e36c",
        color: "#f5f5f5",
        fontFamily: '"VT323", monospace',
        fontSize: "18px",
        padding: "4px 8px",
        marginBottom: "12px",
        display: "block",
      });
      for (const o of offices) {
        const opt = document.createElement("option");
        opt.value = String(o.id);
        opt.textContent = o.name;
        sel.appendChild(opt);
      }
      container.appendChild(sel);

      // New assignment form
      const formWrap = document.createElement("div");
      Object.assign(formWrap.style, {
        borderLeft: "2px solid #b66dff",
        paddingLeft: "10px",
        marginBottom: "16px",
      });

      const formTitle = document.createElement("p");
      formTitle.textContent = "NUEVA ASIGNACIÓN FIJA";
      Object.assign(formTitle.style, { color: "#b66dff", fontSize: "9px", marginBottom: "8px" });
      formWrap.appendChild(formTitle);

      // Desk selector (populated on office change)
      const deskSel = document.createElement("select");
      deskSel.id = "admin-fijos-desk-sel";
      Object.assign(deskSel.style, {
        background: "#0d0d1a",
        border: "1px solid #8e92a8",
        color: "#f5f5f5",
        fontFamily: '"VT323", monospace',
        fontSize: "16px",
        padding: "4px 8px",
        marginBottom: "8px",
        display: "block",
        width: "100%",
      });
      formWrap.appendChild(deskSel);

      // Pick desk from map button
      if (pickDeskCallback) {
        const pickBtn = document.createElement("button");
        pickBtn.textContent = "📍 Seleccionar en mapa";
        Object.assign(pickBtn.style, {
          background: "transparent",
          border: "1px solid #5cf6ff",
          color: "#5cf6ff",
          fontFamily: '"Press Start 2P", monospace',
          fontSize: "8px",
          padding: "5px 10px",
          cursor: "pointer",
          marginBottom: "8px",
          display: "block",
        });
        pickBtn.addEventListener("click", () => {
          unmountAdminPanel();
          pickDeskCallback!((deskId, _deskLabel) => {
            mountAdminPanel("FIJOS", deskId);
          });
        });
        formWrap.appendChild(pickBtn);
      }

      // User list with avatar
      const userList = document.createElement("div");
      Object.assign(userList.style, {
        maxHeight: "160px",
        overflowY: "auto",
        marginBottom: "8px",
        border: "1px solid #8e92a8",
      });

      let selectedUserId: number | null = officesStore.getState().meId;

      const renderUserList = (): void => {
        userList.innerHTML = "";
        for (const u of users) {
          const row = document.createElement("div");
          Object.assign(row.style, {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 8px",
            cursor: "pointer",
            background: u.id === selectedUserId ? "#1a1a2e" : "transparent",
            borderBottom: "1px solid #1a1a2e",
          });

          if (u.avatarUrl) {
            const img = document.createElement("img");
            img.src = u.avatarUrl;
            Object.assign(img.style, {
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: "0",
            });
            row.appendChild(img);
          } else {
            const initials = document.createElement("div");
            initials.textContent = u.name.slice(0, 2).toUpperCase();
            Object.assign(initials.style, {
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "#b66dff",
              color: "#0d0d1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontFamily: '"Press Start 2P", monospace',
              flexShrink: "0",
            });
            row.appendChild(initials);
          }

          const info = document.createElement("div");
          info.style.overflow = "hidden";
          const name = document.createElement("p");
          name.textContent = u.name;
          Object.assign(name.style, { color: "#f5f5f5", fontSize: "11px", margin: "0" });
          const email = document.createElement("p");
          email.textContent = u.email;
          Object.assign(email.style, { color: "#8e92a8", fontSize: "10px", margin: "0" });
          info.appendChild(name);
          info.appendChild(email);
          row.appendChild(info);

          row.addEventListener("click", () => {
            selectedUserId = u.id;
            renderUserList();
          });
          userList.appendChild(row);
        }
      };
      renderUserList();
      formWrap.appendChild(userList);

      const assignBtn = document.createElement("button");
      assignBtn.textContent = "ASIGNAR";
      Object.assign(assignBtn.style, {
        background: "#b66dff",
        border: "none",
        color: "#0d0d1a",
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "9px",
        padding: "6px 12px",
        cursor: "pointer",
      });
      assignBtn.addEventListener("click", () => {
        const deskId = parseInt(deskSel.value, 10);
        if (!deskId || !selectedUserId) return;
        assignBtn.textContent = "…";
        fetch(`${BASE_URL}/api/desks/${deskId}/fixed`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUserId }),
        })
          .then((r) => {
            if (r.ok) {
              assignBtn.textContent = "ASIGNAR";
              loadFijos(parseInt(sel.value, 10));
            } else {
              assignBtn.textContent = "ERROR";
              setTimeout(() => { assignBtn.textContent = "ASIGNAR"; }, 2000);
            }
          })
          .catch(() => { assignBtn.textContent = "ERROR"; });
      });
      formWrap.appendChild(assignBtn);
      container.appendChild(formWrap);

      // Assignments list
      const listContainer = document.createElement("div");
      container.appendChild(listContainer);

      const loadDesks = (officeId: number): void => {
        fetch(`${BASE_URL}/api/offices/${officeId}`, { credentials: "include" })
          .then((r) => r.json())
          .then((detail: { desks: DeskRow[] }) => {
            deskSel.innerHTML = "";
            for (const d of detail.desks) {
              const opt = document.createElement("option");
              opt.value = String(d.id);
              opt.textContent = d.label;
              deskSel.appendChild(opt);
            }
            if (preselectedDeskId != null) {
              deskSel.value = String(preselectedDeskId);
            }
          })
          .catch(() => {});
      };

      const loadFijos = (officeId: number): void => {
        listContainer.innerHTML = '<p style="color:#8e92a8;font-size:10px">Cargando…</p>';
        fetch(`${BASE_URL}/api/offices/${officeId}/fixed-assignments`, { credentials: "include" })
          .then((r) => r.json())
          .then((assignments: AssignmentRow[]) => {
            listContainer.innerHTML = "";
            if (assignments.length === 0) {
              listContainer.innerHTML = '<p style="color:#8e92a8;font-size:10px">Sin asignaciones fijas.</p>';
              return;
            }
            for (const a of assignments) {
              const row = document.createElement("div");
              Object.assign(row.style, {
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
                fontSize: "10px",
                color: "#f5f5f5",
              });
              const info = document.createElement("span");
              info.textContent = `${a.desk.label} → ${a.user.name} (${a.user.email})`;
              info.style.flex = "1";
              row.appendChild(info);
              const delBtn = document.createElement("button");
              delBtn.textContent = "Eliminar";
              Object.assign(delBtn.style, {
                background: "transparent",
                border: "1px solid #e33636",
                color: "#e33636",
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "8px",
                padding: "4px 6px",
                cursor: "pointer",
              });
              delBtn.addEventListener("click", () => {
                fetch(`${BASE_URL}/api/desks/${a.id}/fixed`, { method: "DELETE", credentials: "include" })
                  .then((r) => { if (r.ok) loadFijos(officeId); })
                  .catch(() => {});
              });
              row.appendChild(delBtn);
              listContainer.appendChild(row);
            }
          })
          .catch(() => {
            listContainer.innerHTML = '<p style="color:#e33636;font-size:10px">Error.</p>';
          });
      };

      sel.addEventListener("change", () => {
        const id = parseInt(sel.value, 10);
        if (!isNaN(id)) { loadDesks(id); loadFijos(id); }
      });

      const initialId = parseInt(sel.value, 10);
      loadDesks(initialId);
      loadFijos(initialId);
    })
    .catch(() => {
      container.innerHTML = '<p style="color:#e33636;font-size:10px">Error al cargar.</p>';
    });
}
