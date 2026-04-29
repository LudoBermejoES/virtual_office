import { BASE_URL } from "../config.js";

interface ParsedTmj {
  tilesets: Array<{ image: string }>;
}

const MAX_TMJ = 1_048_576;
const MAX_TILESET = 2_097_152;
const MAX_TOTAL = 10_485_760;

export function mountUploadMapModal(parent: HTMLElement, onUploaded?: () => void): () => void {
  const modal = document.createElement("div");
  modal.id = "upload-map-modal";
  modal.innerHTML = `
    <div class="upload-overlay">
      <div class="upload-panel">
        <h2>SUBIR MAPA TILED</h2>
        <label>Nombre <input type="text" id="upload-name" maxlength="80" required /></label>
        <input type="file" id="upload-files" accept=".tmj,.png,.webp" multiple />
        <ul id="upload-validation"></ul>
        <p id="upload-feedback" role="status"></p>
        <button type="button" id="upload-submit" disabled>GUARDAR</button>
        <button type="button" id="upload-cancel">CANCELAR</button>
      </div>
    </div>
  `;
  parent.appendChild(modal);

  const fileInput = modal.querySelector<HTMLInputElement>("#upload-files")!;
  const validationList = modal.querySelector<HTMLUListElement>("#upload-validation")!;
  const feedback = modal.querySelector<HTMLParagraphElement>("#upload-feedback")!;
  const submitBtn = modal.querySelector<HTMLButtonElement>("#upload-submit")!;
  const cancelBtn = modal.querySelector<HTMLButtonElement>("#upload-cancel")!;
  const nameInput = modal.querySelector<HTMLInputElement>("#upload-name")!;

  let currentTmj: { file: File; parsed: ParsedTmj } | null = null;
  let currentTilesets: File[] = [];

  async function validate(): Promise<void> {
    validationList.innerHTML = "";
    submitBtn.disabled = true;
    feedback.textContent = "";

    const files = Array.from(fileInput.files ?? []);
    const tmjFiles = files.filter((f) => f.name.endsWith(".tmj"));
    const imageFiles = files.filter((f) => f.name.endsWith(".png") || f.name.endsWith(".webp"));

    if (tmjFiles.length !== 1) {
      feedback.textContent = "Selecciona exactamente 1 fichero .tmj";
      return;
    }

    const tmjFile = tmjFiles[0]!;
    if (tmjFile.size > MAX_TMJ) {
      feedback.textContent = `El .tmj supera ${MAX_TMJ} bytes`;
      return;
    }
    let parsed: ParsedTmj;
    try {
      const text = await tmjFile.text();
      parsed = JSON.parse(text) as ParsedTmj;
    } catch {
      feedback.textContent = "El .tmj no es JSON válido";
      return;
    }

    const expected = (parsed.tilesets ?? []).map((t) => t.image);
    const received = imageFiles.map((f) => f.name);
    const missing = expected.filter((x) => !received.includes(x));
    const extra = received.filter((x) => !expected.includes(x));

    for (const m of missing) {
      const li = document.createElement("li");
      li.textContent = `✗ Falta: ${m}`;
      li.classList.add("missing");
      validationList.appendChild(li);
    }
    for (const e of extra) {
      const li = document.createElement("li");
      li.textContent = `✗ Sobra: ${e}`;
      li.classList.add("extra");
      validationList.appendChild(li);
    }

    let totalBytes = tmjFile.size;
    let oversize = false;
    for (const f of imageFiles) {
      totalBytes += f.size;
      if (f.size > MAX_TILESET) {
        oversize = true;
        const li = document.createElement("li");
        li.textContent = `✗ ${f.name} > 2 MB`;
        validationList.appendChild(li);
      }
    }
    if (totalBytes > MAX_TOTAL) {
      feedback.textContent = "El total supera 10 MB";
      return;
    }

    if (missing.length === 0 && extra.length === 0 && !oversize) {
      currentTmj = { file: tmjFile, parsed };
      currentTilesets = imageFiles;
      submitBtn.disabled = false;
      feedback.textContent = `OK: ${expected.length} tilesets coinciden con el .tmj`;
    } else {
      currentTmj = null;
      currentTilesets = [];
    }
  }

  fileInput.addEventListener("change", () => {
    void validate();
  });

  submitBtn.addEventListener("click", async () => {
    if (!currentTmj) return;
    const form = new FormData();
    form.append("name", nameInput.value || "Office");
    form.append("tmj", currentTmj.file);
    for (const t of currentTilesets) form.append("tilesets", t);

    submitBtn.disabled = true;
    feedback.textContent = "Subiendo…";
    try {
      const res = await fetch(`${BASE_URL}/api/offices`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { reason?: string; details?: string[] };
        feedback.textContent = `Error: ${err.reason ?? res.status}${
          err.details?.length ? " - " + err.details.join(", ") : ""
        }`;
        submitBtn.disabled = false;
        return;
      }
      feedback.textContent = "Mapa subido";
      onUploaded?.();
      close();
    } catch {
      feedback.textContent = "Error de red";
      submitBtn.disabled = false;
    }
  });

  function close(): void {
    modal.remove();
  }

  cancelBtn.addEventListener("click", close);

  return close;
}
