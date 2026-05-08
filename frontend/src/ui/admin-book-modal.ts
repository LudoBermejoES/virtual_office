/**
 * Modal admin para reservar o liberar un puesto a nombre de cualquier usuario
 * (change 026).
 *
 * Se monta con `mountAdminBookModal({ desk, dateIso, dateLabel, mode, ... })`
 * y notifica las acciones del admin vía callbacks. Render según `mode`:
 *
 *  - `book`: input filtro + lista de usuarios (admin "(yo)" arriba) + botón
 *    "Reservar".
 *  - `release`: nombre del usuario que tiene la reserva + botón "Liberar".
 *  - `fixed`: aviso "Asignado fijo a <name>" + texto sobre admin panel; sin
 *    acciones.
 *
 * El modal se desmonta solo al confirmar acción exitosa, ESC o click fuera.
 * `mountAdminBookModal` es idempotente (si ya hay uno montado, lo desmonta).
 */

export interface AdminBookModalUser {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
}

/**
 * Mapa de weeklies activas en ESTE desk para cada usuario (change 027).
 * key = userId, value = lista de `[dow, weeklyId]` (necesitamos el id para
 * borrar al desmarcar).
 */
export type WeeklyByUser = Record<string, Array<{ dow: number; weeklyId: number }>>;

/**
 * Mapa de weeklies que cada user tiene en OTROS desks. Cada par (user, dow)
 * deshabilita el checkbox correspondiente en este modal. key = userId, value
 * = lista de dows ocupados.
 */
export type ConflictingDowsByUser = Record<string, number[]>;

/** Cambios acumulados al guardar el modal en modo book (change 027). */
export interface WeeklyChanges {
  /** Pares (userId, dow) a crear como weekly_assignments en este desk. */
  create: Array<{ userId: number; dow: number }>;
  /** Ids de weeklies existentes a borrar. */
  deleteIds: number[];
}

export type AdminBookModalMode =
  | {
      kind: "book";
      users: AdminBookModalUser[];
      meId: number;
      /** Weeklies actuales de cada user en este desk. Por defecto vacío. */
      weeklyByUser?: WeeklyByUser;
      /** Dows ocupados por user en otros desks. Por defecto vacío. */
      conflictingDowsByUser?: ConflictingDowsByUser;
    }
  | { kind: "release"; bookedBy: AdminBookModalUser }
  | { kind: "fixed"; assignedTo: AdminBookModalUser };

export interface AdminBookModalOpts {
  /** Información del puesto en cabecera. */
  deskLabel: string;
  /** Fecha en formato legible (ya formateada en español). */
  dateLabel: string;
  /** Modo del modal. */
  mode: AdminBookModalMode;
  /**
   * Llamado al confirmar reserva. `userId` puede ser null si el admin no
   * seleccionó usuario (solo cambió checkboxes). `weeklyChanges` contiene los
   * deltas pendientes de aplicar a la API de weekly_assignments.
   */
  onConfirmBook?: (userId: number | null, weeklyChanges: WeeklyChanges) => void | Promise<void>;
  /** Llamado al confirmar liberar. */
  onConfirmRelease?: () => void | Promise<void>;
  /** Llamado al desmontar (ESC, click fuera, X). */
  onClose?: () => void;
  /** Documento alternativo (para tests con FakeDoc). */
  doc?: Document;
}

let overlayEl: HTMLDivElement | null = null;
let escListener: ((ev: KeyboardEvent) => void) | null = null;
let attachedDoc: Document | null = null;

export function mountAdminBookModal(opts: AdminBookModalOpts): void {
  unmountAdminBookModal();
  const doc = opts.doc ?? document;
  attachedDoc = doc;

  overlayEl = doc.createElement("div");
  overlayEl.id = "admin-book-modal-overlay";
  Object.assign(overlayEl.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    background: "rgba(0, 0, 0, 0.7)",
    zIndex: "10002",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"Press Start 2P", monospace',
  });

  const box = doc.createElement("div");
  Object.assign(box.style, {
    minWidth: "320px",
    maxWidth: "480px",
    maxHeight: "70vh",
    overflowY: "auto",
    background: "#0b0d1a",
    border: "2px solid #36e36c",
    color: "#e5e5e5",
    fontSize: "10px",
    padding: "16px",
    boxShadow: "0 0 12px rgba(54, 227, 108, 0.4)",
  });
  box.addEventListener("click", (ev) => ev.stopPropagation());
  overlayEl.appendChild(box);

  // Header
  const header = doc.createElement("div");
  header.id = "admin-book-modal-header";
  Object.assign(header.style, {
    color: "#36e36c",
    fontSize: "12px",
    marginBottom: "8px",
  });
  const title =
    opts.mode.kind === "book"
      ? `Reservar puesto ${opts.deskLabel}`
      : opts.mode.kind === "release"
        ? `Liberar puesto ${opts.deskLabel}`
        : `Puesto ${opts.deskLabel}`;
  header.textContent = title;
  box.appendChild(header);

  const dateRow = doc.createElement("div");
  dateRow.textContent = opts.dateLabel;
  Object.assign(dateRow.style, { color: "#8e92a8", fontSize: "9px", marginBottom: "12px" });
  box.appendChild(dateRow);

  if (opts.mode.kind === "book") {
    renderBookMode(doc, box, opts, opts.mode);
  } else if (opts.mode.kind === "release") {
    renderReleaseMode(doc, box, opts, opts.mode);
  } else {
    renderFixedMode(doc, box, opts.mode);
  }

  // Click fuera = cerrar
  overlayEl.addEventListener("click", () => {
    opts.onClose?.();
    unmountAdminBookModal();
  });

  doc.body.appendChild(overlayEl);

  // ESC
  escListener = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") {
      opts.onClose?.();
      unmountAdminBookModal();
    }
  };
  doc.addEventListener("keydown", escListener);
}

export function unmountAdminBookModal(): void {
  if (escListener && attachedDoc) {
    attachedDoc.removeEventListener("keydown", escListener);
  }
  escListener = null;
  attachedDoc = null;
  overlayEl?.remove();
  overlayEl = null;
}

const DOW_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;

function renderBookMode(
  doc: Document,
  box: HTMLElement,
  opts: AdminBookModalOpts,
  mode: {
    kind: "book";
    users: AdminBookModalUser[];
    meId: number;
    weeklyByUser?: WeeklyByUser;
    conflictingDowsByUser?: ConflictingDowsByUser;
  },
): void {
  // Ordenar usuarios: yo primero, resto alfabético por name (case-insensitive).
  const me = mode.users.find((u) => u.id === mode.meId);
  const others = mode.users
    .filter((u) => u.id !== mode.meId)
    .sort((a, b) => a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase(), "es"));
  const ordered = me ? [me, ...others] : others;

  let selectedUserId: number | null = me?.id ?? null;

  // Estado inicial de weeklies por usuario en este desk (set de dows).
  const initialDowsByUser = new Map<number, Set<number>>();
  // Mapa (userId, dow) → weeklyId para borrar al desmarcar.
  const weeklyIdAt = new Map<string, number>();
  for (const [userIdStr, weeklies] of Object.entries(mode.weeklyByUser ?? {})) {
    const userId = Number(userIdStr);
    const set = new Set<number>();
    for (const w of weeklies) {
      set.add(w.dow);
      weeklyIdAt.set(`${String(userId)}:${String(w.dow)}`, w.weeklyId);
    }
    initialDowsByUser.set(userId, set);
  }

  // Estado actual (mutable). Inicializamos desde el inicial.
  const currentDowsByUser = new Map<number, Set<number>>();
  for (const [u, dows] of initialDowsByUser) {
    currentDowsByUser.set(u, new Set(dows));
  }

  const conflictingDowsByUser = mode.conflictingDowsByUser ?? {};

  const filterInput = doc.createElement("input");
  filterInput.id = "admin-book-modal-filter";
  filterInput.type = "text";
  filterInput.placeholder = "Filtrar por nombre o email...";
  Object.assign(filterInput.style, {
    width: "100%",
    boxSizing: "border-box",
    background: "#11132a",
    color: "#e5e5e5",
    border: "1px solid #444",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "9px",
    padding: "6px",
    marginBottom: "8px",
  });
  box.appendChild(filterInput);

  const listEl = doc.createElement("div");
  listEl.id = "admin-book-modal-list";
  Object.assign(listEl.style, {
    maxHeight: "320px",
    overflowY: "auto",
    border: "1px solid #444",
    background: "#0b0d1a",
    marginBottom: "12px",
  });
  box.appendChild(listEl);

  const computeChanges = (): WeeklyChanges => {
    const create: WeeklyChanges["create"] = [];
    const deleteIds: number[] = [];
    // Recorremos ambos lados para detectar diffs.
    const allUsers = new Set<number>([...initialDowsByUser.keys(), ...currentDowsByUser.keys()]);
    for (const userId of allUsers) {
      const initial = initialDowsByUser.get(userId) ?? new Set<number>();
      const current = currentDowsByUser.get(userId) ?? new Set<number>();
      for (const dow of current) {
        if (!initial.has(dow)) create.push({ userId, dow });
      }
      for (const dow of initial) {
        if (!current.has(dow)) {
          const id = weeklyIdAt.get(`${String(userId)}:${String(dow)}`);
          if (id !== undefined) deleteIds.push(id);
        }
      }
    }
    return { create, deleteIds };
  };

  const renderList = (filter: string): void => {
    listEl.innerHTML = "";
    const f = filter.toLocaleLowerCase();
    const filtered = ordered.filter(
      (u) =>
        f === "" ||
        u.name.toLocaleLowerCase().includes(f) ||
        u.email.toLocaleLowerCase().includes(f),
    );
    if (filtered.length === 0) {
      const empty = doc.createElement("div");
      empty.textContent = "(sin coincidencias)";
      Object.assign(empty.style, { color: "#8e92a8", padding: "8px", fontSize: "9px" });
      listEl.appendChild(empty);
      return;
    }
    for (const u of filtered) {
      const isMe = u.id === mode.meId;
      const isSelected = u.id === selectedUserId;
      const userDows = currentDowsByUser.get(u.id) ?? new Set<number>();
      const conflictingDows = new Set(conflictingDowsByUser[String(u.id)] ?? []);

      const row = doc.createElement("div");
      row.dataset["userId"] = String(u.id);
      Object.assign(row.style, {
        padding: "6px 8px",
        background: isSelected ? "#36e36c" : "transparent",
        color: isSelected ? "#0b0d1a" : "#e5e5e5",
        borderBottom: "1px solid #1a1c30",
        fontSize: "9px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      });

      // Bloque nombre + email (clickable para seleccionar usuario)
      const labelWrap = doc.createElement("div");
      labelWrap.style.flex = "1";
      labelWrap.style.cursor = "pointer";
      labelWrap.textContent = isMe ? `${u.name} (yo)` : u.name;
      const email = doc.createElement("div");
      email.textContent = u.email;
      Object.assign(email.style, {
        color: isSelected ? "#0b0d1a" : "#8e92a8",
        fontSize: "7px",
        marginTop: "2px",
      });
      labelWrap.appendChild(email);
      labelWrap.addEventListener("click", () => {
        selectedUserId = u.id;
        renderList(filterInput.value);
      });
      row.appendChild(labelWrap);

      // Rejilla de 7 checkboxes L M X J V S D
      const dowGrid = doc.createElement("div");
      dowGrid.dataset["dowGridFor"] = String(u.id);
      Object.assign(dowGrid.style, { display: "flex", gap: "2px" });
      for (let dow = 0; dow < 7; dow++) {
        const cell = doc.createElement("label");
        cell.dataset["dow"] = String(dow);
        const isConflict = conflictingDows.has(dow);
        const isChecked = userDows.has(dow);
        Object.assign(cell.style, {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontSize: "7px",
          color: isSelected ? "#0b0d1a" : isConflict ? "#666" : "#8e92a8",
          cursor: isConflict ? "not-allowed" : "pointer",
          opacity: isConflict ? "0.4" : "1",
        });
        cell.title = isConflict
          ? `${u.name} ya tiene un fijo semanal en otro puesto este día`
          : `${DOW_LABELS[dow]} de ${u.name}`;

        const cb = doc.createElement("input");
        cb.type = "checkbox";
        cb.checked = isChecked;
        cb.disabled = isConflict;
        cb.dataset["userId"] = String(u.id);
        cb.dataset["dow"] = String(dow);
        Object.assign(cb.style, { margin: "0", cursor: isConflict ? "not-allowed" : "pointer" });
        cb.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (isConflict) return;
          const set = currentDowsByUser.get(u.id) ?? new Set<number>();
          if (cb.checked) set.add(dow);
          else set.delete(dow);
          currentDowsByUser.set(u.id, set);
          // Re-renderizar para reflejar el cambio en otros checkboxes
          // potencialmente afectados (no hay propagación cruzada por ahora).
        });
        cell.appendChild(cb);

        const labelText = doc.createElement("span");
        labelText.textContent = DOW_LABELS[dow]!;
        cell.appendChild(labelText);

        // Click en el label/cell también toggle del checkbox
        cell.addEventListener("click", (ev) => {
          ev.stopPropagation();
        });
        dowGrid.appendChild(cell);
      }
      row.appendChild(dowGrid);

      listEl.appendChild(row);
    }
  };
  renderList("");

  filterInput.addEventListener("input", () => renderList(filterInput.value));

  const btnRow = doc.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "8px", justifyContent: "flex-end" });
  box.appendChild(btnRow);

  const cancelBtn = makeButton(doc, "Cancelar", "#8e92a8");
  cancelBtn.addEventListener("click", () => {
    opts.onClose?.();
    unmountAdminBookModal();
  });
  btnRow.appendChild(cancelBtn);

  const confirmBtn = makeButton(doc, "Guardar", "#36e36c");
  confirmBtn.id = "admin-book-modal-confirm";
  confirmBtn.addEventListener("click", () => {
    void opts.onConfirmBook?.(selectedUserId, computeChanges());
  });
  btnRow.appendChild(confirmBtn);
}

function renderReleaseMode(
  doc: Document,
  box: HTMLElement,
  opts: AdminBookModalOpts,
  mode: { kind: "release"; bookedBy: AdminBookModalUser },
): void {
  const info = doc.createElement("div");
  info.textContent = `Reservado por ${mode.bookedBy.name}`;
  Object.assign(info.style, { color: "#e5e5e5", marginBottom: "4px" });
  box.appendChild(info);

  const email = doc.createElement("div");
  email.textContent = mode.bookedBy.email;
  Object.assign(email.style, { color: "#8e92a8", fontSize: "8px", marginBottom: "16px" });
  box.appendChild(email);

  const btnRow = doc.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "8px", justifyContent: "flex-end" });
  box.appendChild(btnRow);

  const cancelBtn = makeButton(doc, "Cancelar", "#8e92a8");
  cancelBtn.addEventListener("click", () => {
    opts.onClose?.();
    unmountAdminBookModal();
  });
  btnRow.appendChild(cancelBtn);

  const releaseBtn = makeButton(doc, "Liberar reserva", "#ff5c5c");
  releaseBtn.id = "admin-book-modal-release";
  releaseBtn.addEventListener("click", () => {
    void opts.onConfirmRelease?.();
  });
  btnRow.appendChild(releaseBtn);
}

function renderFixedMode(
  doc: Document,
  box: HTMLElement,
  mode: { kind: "fixed"; assignedTo: AdminBookModalUser },
): void {
  const info = doc.createElement("div");
  info.textContent = `Asignado fijo a ${mode.assignedTo.name}`;
  Object.assign(info.style, { color: "#f5b400", marginBottom: "8px" });
  box.appendChild(info);

  const tip = doc.createElement("div");
  tip.textContent = "Para gestionar fijos, usa el admin panel.";
  Object.assign(tip.style, { color: "#8e92a8", fontSize: "8px", marginBottom: "16px" });
  box.appendChild(tip);

  const btnRow = doc.createElement("div");
  Object.assign(btnRow.style, { display: "flex", justifyContent: "flex-end" });
  box.appendChild(btnRow);

  const closeBtn = makeButton(doc, "Cerrar", "#8e92a8");
  closeBtn.addEventListener("click", () => unmountAdminBookModal());
  btnRow.appendChild(closeBtn);
}

function makeButton(doc: Document, label: string, color: string): HTMLButtonElement {
  const btn = doc.createElement("button");
  btn.textContent = label;
  Object.assign(btn.style, {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "9px",
    padding: "6px 12px",
    cursor: "pointer",
  });
  return btn;
}
