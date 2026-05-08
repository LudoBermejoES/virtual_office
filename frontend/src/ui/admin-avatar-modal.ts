/**
 * Modal admin para gestionar el avatar custom de un usuario (change 030).
 *
 * Doc-injection para unit tests (igual patrón que `weekly-action-modal.ts`).
 * Operaciones:
 *   - Subir avatar: POST /api/users/:id/avatar  multipart parte `file`.
 *   - Resetear (solo si `avatar_locked = 1`): DELETE /api/users/:id/avatar.
 */

export interface AvatarModalUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  avatar_locked: number;
}

export interface MountAvatarModalOptions {
  doc: Document;
  user: AvatarModalUser;
  onClose?: () => void;
  /** Llamado tras subida o reset con éxito. La caller suele recargar la lista. */
  onChanged?: () => void;
  /** Override fetch para tests. */
  fetchImpl?: typeof fetch;
  /** Override confirm para tests. */
  confirmImpl?: (msg: string) => boolean;
  /** Base URL del backend (para tests). */
  baseUrl?: string;
}

let modalEl: HTMLElement | null = null;
let escListener: ((ev: KeyboardEvent) => void) | null = null;
let docRef: Document | null = null;

const OVERLAY_ID = "admin-avatar-modal-overlay";
const HEADER_ID = "admin-avatar-modal-header";
const FILE_ID = "admin-avatar-modal-file";
const UPLOAD_ID = "admin-avatar-modal-upload";
const RESET_ID = "admin-avatar-modal-reset";
const CANCEL_ID = "admin-avatar-modal-cancel";
const ORIGIN_ID = "admin-avatar-modal-origin";

export function mountAdminAvatarModal(opts: MountAvatarModalOptions): void {
  unmountAdminAvatarModal();

  const doc = opts.doc;
  docRef = doc;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const confirmImpl = opts.confirmImpl ?? ((m: string) => (doc.defaultView ?? window).confirm(m));
  const baseUrl = opts.baseUrl ?? "";

  const overlay = doc.createElement("div");
  overlay.id = OVERLAY_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.85)",
    zIndex: "200",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: '"Press Start 2P", monospace',
  });

  const box = doc.createElement("div");
  Object.assign(box.style, {
    background: "#1a1a2e",
    border: "2px solid #36e36c",
    padding: "20px",
    minWidth: "360px",
    maxWidth: "90vw",
    color: "#f5f5f5",
    fontSize: "11px",
  });
  box.addEventListener("click", (ev) => {
    (ev as Event).stopPropagation();
  });

  const header = doc.createElement("p");
  header.id = HEADER_ID;
  header.textContent = `Avatar de ${opts.user.name}`;
  Object.assign(header.style, { color: "#36e36c", marginBottom: "12px", fontSize: "12px" });
  box.appendChild(header);

  // Preview.
  const previewWrap = doc.createElement("div");
  Object.assign(previewWrap.style, {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  });

  if (opts.user.avatar_url) {
    const img = doc.createElement("img") as HTMLImageElement;
    img.src = opts.user.avatar_url;
    Object.assign(img.style, {
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      objectFit: "cover",
      border: "2px solid #36e36c",
    });
    previewWrap.appendChild(img);
  } else {
    const placeholder = doc.createElement("div");
    placeholder.textContent = opts.user.name.slice(0, 2).toUpperCase();
    Object.assign(placeholder.style, {
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      background: "#b66dff",
      color: "#0d0d1a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "16px",
    });
    previewWrap.appendChild(placeholder);
  }

  const origin = doc.createElement("p");
  origin.id = ORIGIN_ID;
  origin.textContent = !opts.user.avatar_url
    ? "Origen: Sin avatar"
    : opts.user.avatar_locked === 1
      ? "Origen: Custom"
      : "Origen: Google";
  Object.assign(origin.style, { color: "#8e92a8", fontSize: "10px" });
  previewWrap.appendChild(origin);

  box.appendChild(previewWrap);

  // File input.
  const fileInput = doc.createElement("input") as HTMLInputElement;
  fileInput.id = FILE_ID;
  fileInput.type = "file";
  fileInput.accept = "image/png,image/webp,image/jpeg";
  Object.assign(fileInput.style, {
    display: "block",
    marginBottom: "12px",
    color: "#f5f5f5",
    fontFamily: '"VT323", monospace',
    fontSize: "14px",
  });
  box.appendChild(fileInput);

  // Botones.
  const btnRow = doc.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "8px", flexWrap: "wrap" });

  const uploadBtn = doc.createElement("button");
  uploadBtn.id = UPLOAD_ID;
  uploadBtn.textContent = "Subir";
  Object.assign(uploadBtn.style, {
    background: "#36e36c",
    border: "none",
    color: "#0d0d1a",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "9px",
    padding: "6px 12px",
    cursor: "pointer",
  });
  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    uploadBtn.textContent = "…";
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetchImpl(`${baseUrl}/api/users/${String(opts.user.id)}/avatar`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (res.ok) {
        unmountAdminAvatarModal();
        opts.onChanged?.();
      } else {
        uploadBtn.textContent = "ERROR";
        setTimeout(() => {
          uploadBtn.textContent = "Subir";
        }, 2000);
      }
    } catch {
      uploadBtn.textContent = "ERROR";
    }
  });
  btnRow.appendChild(uploadBtn);

  if (opts.user.avatar_locked === 1) {
    const resetBtn = doc.createElement("button");
    resetBtn.id = RESET_ID;
    resetBtn.textContent = "Resetear";
    Object.assign(resetBtn.style, {
      background: "transparent",
      border: "1px solid #e33636",
      color: "#e33636",
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "9px",
      padding: "6px 12px",
      cursor: "pointer",
    });
    resetBtn.addEventListener("click", async () => {
      const ok = confirmImpl(
        `¿Quitar el avatar custom de ${opts.user.name}? Volverá a usarse el de Google en su próximo login.`,
      );
      if (!ok) return;
      const res = await fetchImpl(`${baseUrl}/api/users/${String(opts.user.id)}/avatar`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        unmountAdminAvatarModal();
        opts.onChanged?.();
      }
    });
    btnRow.appendChild(resetBtn);
  }

  const cancelBtn = doc.createElement("button");
  cancelBtn.id = CANCEL_ID;
  cancelBtn.textContent = "Cancelar";
  Object.assign(cancelBtn.style, {
    background: "transparent",
    border: "1px solid #8e92a8",
    color: "#8e92a8",
    fontFamily: '"Press Start 2P", monospace',
    fontSize: "9px",
    padding: "6px 12px",
    cursor: "pointer",
  });
  cancelBtn.addEventListener("click", () => {
    unmountAdminAvatarModal();
    opts.onClose?.();
  });
  btnRow.appendChild(cancelBtn);

  box.appendChild(btnRow);

  overlay.appendChild(box);
  overlay.addEventListener("click", () => {
    unmountAdminAvatarModal();
    opts.onClose?.();
  });

  doc.body.appendChild(overlay);
  modalEl = overlay as unknown as HTMLElement;

  escListener = (ev) => {
    if ((ev as KeyboardEvent).key === "Escape") {
      unmountAdminAvatarModal();
      opts.onClose?.();
    }
  };
  doc.addEventListener("keydown", escListener as unknown as EventListener);
}

export function unmountAdminAvatarModal(): void {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
  if (escListener && docRef) {
    docRef.removeEventListener("keydown", escListener as unknown as EventListener);
    escListener = null;
  }
  docRef = null;
}
