import { BASE_URL } from "../config.js";

const TABS = ["OFICINAS", "USUARIOS", "FIJOS"] as const;
type Tab = (typeof TABS)[number];

let panelEl: HTMLDivElement | null = null;
let editDesksCallback: ((officeId: number) => void) | null = null;

export function setEditDesksCallback(cb: (officeId: number) => void): void {
  editDesksCallback = cb;
}

export function mountAdminPanel(initialTab: Tab = "OFICINAS"): void {
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
    else if (tab === "FIJOS") renderFijos(content);
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

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".tmj,.json,.png,.webp";
  fileInput.multiple = true;
  fileInput.id = "admin-new-office-files";
  Object.assign(fileInput.style, { color: "#8e92a8", fontSize: "10px", marginRight: "8px" });
  wrap.appendChild(fileInput);

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
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    const fd = new FormData();
    fd.append("name", name);
    for (const f of Array.from(files)) fd.append("files", f);

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

  row.appendChild(nameEl);
  row.appendChild(editBtn);
  row.appendChild(adminsBtn);
  row.appendChild(delBtn);

  const wrap = document.createElement("div");
  wrap.appendChild(row);
  wrap.appendChild(adminsPanel);
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

function renderFijos(container: HTMLElement): void {
  container.innerHTML = '<p style="color:#8e92a8;font-size:10px">Cargando oficinas…</p>';

  fetch(`${BASE_URL}/api/offices`, { credentials: "include" })
    .then((r) => r.json())
    .then((offices: { id: number; name: string }[]) => {
      container.innerHTML = "";

      if (offices.length === 0) {
        container.innerHTML = '<p style="color:#8e92a8;font-size:10px">No hay oficinas.</p>';
        return;
      }

      const sel = document.createElement("select");
      sel.id = "admin-fijos-office-select";
      Object.assign(sel.style, {
        background: "#0d0d1a",
        border: "1px solid #36e36c",
        color: "#f5f5f5",
        fontFamily: '"VT323", monospace',
        fontSize: "18px",
        padding: "4px 8px",
        marginBottom: "12px",
      });
      for (const o of offices) {
        const opt = document.createElement("option");
        opt.value = String(o.id);
        opt.textContent = o.name;
        sel.appendChild(opt);
      }
      container.appendChild(sel);

      const listContainer = document.createElement("div");
      container.appendChild(listContainer);

      const loadFijos = (officeId: number): void => {
        listContainer.innerHTML = '<p style="color:#8e92a8;font-size:10px">Cargando…</p>';
        fetch(`${BASE_URL}/api/offices/${officeId}/fixed-assignments`, { credentials: "include" })
          .then((r) => r.json())
          .then(
            (
              assignments: {
                id: number;
                desk: { label: string };
                user: { name: string; email: string };
              }[],
            ) => {
              listContainer.innerHTML = "";
              if (assignments.length === 0) {
                listContainer.innerHTML =
                  '<p style="color:#8e92a8;font-size:10px">Sin asignaciones fijas.</p>';
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
                  fetch(`${BASE_URL}/api/desks/${a.id}/fixed`, {
                    method: "DELETE",
                    credentials: "include",
                  })
                    .then((r) => {
                      if (r.ok) loadFijos(officeId);
                    })
                    .catch(() => {});
                });
                row.appendChild(delBtn);
                listContainer.appendChild(row);
              }
            },
          )
          .catch(() => {
            listContainer.innerHTML = '<p style="color:#e33636;font-size:10px">Error.</p>';
          });
      };

      sel.addEventListener("change", () => {
        const id = parseInt(sel.value, 10);
        if (!isNaN(id)) loadFijos(id);
      });

      loadFijos(parseInt(sel.value, 10));
    })
    .catch(() => {
      container.innerHTML = '<p style="color:#e33636;font-size:10px">Error al cargar.</p>';
    });
}
