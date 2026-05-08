/**
 * Modal que aparece cuando un usuario pulsa un puesto cuya reserva visible
 * es de tipo `weekly` (change 028). Distintas acciones según rol:
 *
 *  - `user_self`: el dueño puede saltarse el día concreto.
 *  - `user_self_with_exception`: el dueño ya creó excepción, puede deshacerla.
 *  - `admin`: puede saltar este día o quitar la weekly entera.
 *
 * El modal HTML overlay se monta sobre el canvas Phaser y se desmonta al
 * confirmar acción exitosa, ESC o click fuera.
 */

export type WeeklyActionMode =
  | { kind: "user_self" }
  | { kind: "user_self_with_exception" }
  | { kind: "admin"; targetUserName: string };

export interface WeeklyActionModalOpts {
  /** Etiqueta del puesto (ej. "D5"). */
  deskLabel: string;
  /** Fecha en formato legible. */
  dateLabel: string;
  /** Etiqueta del día de la semana (ej. "lunes"). */
  dowLabel: string;
  /** Modo según rol/estado. */
  mode: WeeklyActionMode;
  /** Llamado cuando el caller pulsa "Saltarme hoy" / "Saltar este día". */
  onSkipDay?: () => void | Promise<void>;
  /** Llamado cuando el dueño pulsa "Recuperar mi puesto". */
  onUnskipDay?: () => void | Promise<void>;
  /** Llamado cuando el admin pulsa "Quitar todos los <día>" tras confirm. */
  onDeleteWeekly?: () => void | Promise<void>;
  /** Llamado al cerrar. */
  onClose?: () => void;
  /** Document alternativo (tests). */
  doc?: Document;
}

let overlayEl: HTMLDivElement | null = null;
let escListener: ((ev: KeyboardEvent) => void) | null = null;
let attachedDoc: Document | null = null;

export function mountWeeklyActionModal(opts: WeeklyActionModalOpts): void {
  unmountWeeklyActionModal();
  const doc = opts.doc ?? document;
  attachedDoc = doc;

  overlayEl = doc.createElement("div");
  overlayEl.id = "weekly-action-modal-overlay";
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
    background: "#0b0d1a",
    border: "2px solid #5cf6ff",
    color: "#e5e5e5",
    fontSize: "10px",
    padding: "16px",
    boxShadow: "0 0 12px rgba(92, 246, 255, 0.4)",
  });
  box.addEventListener("click", (ev) => ev.stopPropagation());
  overlayEl.appendChild(box);

  const header = doc.createElement("div");
  header.id = "weekly-action-modal-header";
  Object.assign(header.style, { color: "#5cf6ff", fontSize: "12px", marginBottom: "8px" });
  header.textContent =
    opts.mode.kind === "admin"
      ? `Puesto recurrente de ${opts.mode.targetUserName} — ${opts.deskLabel}`
      : `Tu puesto fijo recurrente — ${opts.deskLabel}`;
  box.appendChild(header);

  const dateRow = doc.createElement("div");
  dateRow.textContent = opts.dateLabel;
  Object.assign(dateRow.style, { color: "#8e92a8", fontSize: "9px", marginBottom: "16px" });
  box.appendChild(dateRow);

  const btnRow = doc.createElement("div");
  Object.assign(btnRow.style, { display: "flex", flexDirection: "column", gap: "8px" });
  box.appendChild(btnRow);

  if (opts.mode.kind === "user_self") {
    const skip = makeButton(doc, "Saltarme hoy", "#f5b400");
    skip.id = "weekly-action-modal-skip";
    skip.addEventListener("click", () => void opts.onSkipDay?.());
    btnRow.appendChild(skip);
  } else if (opts.mode.kind === "user_self_with_exception") {
    const unskip = makeButton(doc, "Recuperar mi puesto", "#36e36c");
    unskip.id = "weekly-action-modal-unskip";
    unskip.addEventListener("click", () => void opts.onUnskipDay?.());
    btnRow.appendChild(unskip);
  } else {
    // admin
    const skip = makeButton(doc, `Saltar este ${opts.dowLabel}`, "#f5b400");
    skip.id = "weekly-action-modal-skip";
    skip.addEventListener("click", () => void opts.onSkipDay?.());
    btnRow.appendChild(skip);

    const remove = makeButton(doc, `Quitar todos los ${opts.dowLabel}`, "#ff5c5c");
    remove.id = "weekly-action-modal-delete";
    remove.addEventListener("click", () => {
      const ok = doc.defaultView?.confirm(
        `¿Quitar la asignación recurrente entera? Esto afectará a todos los ${opts.dowLabel} futuros.`,
      );
      if (ok) void opts.onDeleteWeekly?.();
    });
    btnRow.appendChild(remove);
  }

  const cancel = makeButton(doc, "Cancelar", "#8e92a8");
  cancel.id = "weekly-action-modal-cancel";
  cancel.addEventListener("click", () => {
    opts.onClose?.();
    unmountWeeklyActionModal();
  });
  btnRow.appendChild(cancel);

  // Click fuera = cerrar
  overlayEl.addEventListener("click", () => {
    opts.onClose?.();
    unmountWeeklyActionModal();
  });

  doc.body.appendChild(overlayEl);

  escListener = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") {
      opts.onClose?.();
      unmountWeeklyActionModal();
    }
  };
  doc.addEventListener("keydown", escListener);
}

export function unmountWeeklyActionModal(): void {
  if (escListener && attachedDoc) {
    attachedDoc.removeEventListener("keydown", escListener);
  }
  escListener = null;
  attachedDoc = null;
  overlayEl?.remove();
  overlayEl = null;
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
    padding: "8px 12px",
    cursor: "pointer",
    width: "100%",
  });
  return btn;
}
