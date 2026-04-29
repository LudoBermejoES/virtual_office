import { BASE_URL } from "../config.js";

interface Invitation {
  id: number;
  email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
}

export function mountInvitationsModal(parent: HTMLElement): () => void {
  const modal = document.createElement("div");
  modal.id = "invitations-modal";
  modal.innerHTML = `
    <div class="invitations-overlay">
      <div class="invitations-panel">
        <h2>INVITACIONES EXTERNAS</h2>
        <form id="invitations-form">
          <input type="email" id="invitations-email" placeholder="email@externo.com" required />
          <button type="submit">INVITAR</button>
        </form>
        <p id="invitations-feedback" role="status"></p>
        <ul id="invitations-list"></ul>
        <button type="button" id="invitations-close">CERRAR</button>
      </div>
    </div>
  `;
  parent.appendChild(modal);

  const list = modal.querySelector<HTMLUListElement>("#invitations-list")!;
  const form = modal.querySelector<HTMLFormElement>("#invitations-form")!;
  const emailInput = modal.querySelector<HTMLInputElement>("#invitations-email")!;
  const feedback = modal.querySelector<HTMLParagraphElement>("#invitations-feedback")!;
  const closeBtn = modal.querySelector<HTMLButtonElement>("#invitations-close")!;

  async function refresh(): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/invitations`, { credentials: "include" });
    if (!res.ok) {
      feedback.textContent = "No se pudo cargar el listado.";
      return;
    }
    const items = (await res.json()) as Invitation[];
    list.innerHTML = "";
    for (const inv of items) {
      const li = document.createElement("li");
      const url = `${window.location.origin}/invite/${inv.token}`;
      li.innerHTML = `
        <span>${inv.email}</span>
        <button type="button" data-copy="${inv.token}">COPIAR LINK</button>
        <button type="button" data-revoke="${inv.id}">REVOCAR</button>
      `;
      const copyBtn = li.querySelector<HTMLButtonElement>("[data-copy]")!;
      copyBtn.addEventListener("click", () => {
        void navigator.clipboard.writeText(url);
        feedback.textContent = `Link copiado: ${inv.email}`;
      });
      const revokeBtn = li.querySelector<HTMLButtonElement>("[data-revoke]")!;
      revokeBtn.addEventListener("click", async () => {
        const del = await fetch(`${BASE_URL}/api/invitations/${inv.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (del.status === 204) {
          feedback.textContent = `Revocada: ${inv.email}`;
          await refresh();
        }
      });
      list.appendChild(li);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await fetch(`${BASE_URL}/api/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: emailInput.value }),
    });
    if (res.status === 201) {
      const inv = (await res.json()) as Invitation & { url: string };
      feedback.textContent = `Invitación creada: ${inv.email}`;
      emailInput.value = "";
      await refresh();
    } else {
      const err = (await res.json().catch(() => ({}))) as { reason?: string };
      feedback.textContent = err.reason ? `Error: ${err.reason}` : "Error al invitar.";
    }
  });

  function close(): void {
    modal.remove();
  }

  closeBtn.addEventListener("click", close);

  void refresh();

  return close;
}
