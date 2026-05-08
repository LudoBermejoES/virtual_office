/**
 * Pestaña "RECURRENCIAS" del admin panel (change 029).
 *
 * Lista todas las weeklies de la oficina con filtros (usuario, dow), badge de
 * excepciones futuras y acciones inline (borrar weekly, limpiar excepciones).
 *
 * Diseñada para ser unit-testable con un FakeDoc + fetch inyectado, igual que
 * `weekly-action-modal.ts`. El admin-panel principal la invoca con el
 * `document` real.
 */
import { DOW_LABELS_LONG_ES } from "@virtual-office/shared";

export interface WeeklyRow {
  id: number;
  desk: { id: number; label: string };
  user: { id: number; name: string; email: string; avatar_url: string | null };
  dow: number;
  created_at: string;
  exceptions: string[];
}

export interface OfficeOption {
  id: number;
  name: string;
}

export interface RecurrenciasTabOptions {
  doc: Document;
  container: HTMLElement;
  baseUrl: string;
  /** Lista de oficinas administrables. Si solo hay una se omite el selector. */
  offices: OfficeOption[];
  /** Override de fetch para tests. */
  fetchImpl?: typeof fetch;
  /** Override de window.confirm para tests. */
  confirmImpl?: (msg: string) => boolean;
}

export function renderRecurrenciasTab(opts: RecurrenciasTabOptions): void {
  const doc = opts.doc;
  const container = opts.container;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const confirmImpl = opts.confirmImpl ?? ((m: string) => (doc.defaultView ?? window).confirm(m));

  container.innerHTML = "";

  if (opts.offices.length === 0) {
    const empty = doc.createElement("p");
    empty.textContent = "No tienes oficinas administrables.";
    Object.assign(empty.style, { color: "#8e92a8", fontSize: "10px" });
    container.appendChild(empty);
    return;
  }

  // Selector de oficina (si hay >1).
  let currentOfficeId = opts.offices[0]!.id;
  if (opts.offices.length > 1) {
    const sel = doc.createElement("select") as HTMLSelectElement;
    sel.id = "admin-rec-office-sel";
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
    for (const o of opts.offices) {
      const opt = doc.createElement("option") as HTMLOptionElement;
      opt.value = String(o.id);
      opt.textContent = o.name;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => {
      const id = parseInt(sel.value, 10);
      if (!Number.isNaN(id)) {
        currentOfficeId = id;
        load();
      }
    });
    container.appendChild(sel);
  }

  // Barra de filtros.
  const filters = doc.createElement("div");
  filters.id = "admin-rec-filters";
  Object.assign(filters.style, {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    marginBottom: "12px",
    flexWrap: "wrap",
  });

  const userFilter = doc.createElement("input") as HTMLInputElement;
  userFilter.id = "admin-rec-filter-user";
  userFilter.type = "text";
  userFilter.placeholder = "Filtrar por usuario";
  Object.assign(userFilter.style, {
    background: "#0d0d1a",
    border: "1px solid #8e92a8",
    color: "#f5f5f5",
    fontFamily: '"VT323", monospace',
    fontSize: "16px",
    padding: "4px 8px",
  });

  const dowFilter = doc.createElement("select") as HTMLSelectElement;
  dowFilter.id = "admin-rec-filter-dow";
  Object.assign(dowFilter.style, {
    background: "#0d0d1a",
    border: "1px solid #8e92a8",
    color: "#f5f5f5",
    fontFamily: '"VT323", monospace',
    fontSize: "16px",
    padding: "4px 8px",
  });
  const allOpt = doc.createElement("option") as HTMLOptionElement;
  allOpt.value = "";
  allOpt.textContent = "Todos los días";
  dowFilter.appendChild(allOpt);
  for (let d = 0; d < 7; d++) {
    const opt = doc.createElement("option") as HTMLOptionElement;
    opt.value = String(d);
    opt.textContent = DOW_LABELS_LONG_ES[d]!;
    dowFilter.appendChild(opt);
  }

  filters.appendChild(userFilter);
  filters.appendChild(dowFilter);
  container.appendChild(filters);

  // Tabla.
  const table = doc.createElement("div");
  table.id = "admin-rec-table";
  Object.assign(table.style, {
    border: "1px solid #36e36c",
    fontSize: "11px",
    color: "#f5f5f5",
  });
  container.appendChild(table);

  let allRows: WeeklyRow[] = [];

  function applyFilters(): WeeklyRow[] {
    const userQ = userFilter.value.trim().toLowerCase();
    const dowQ = dowFilter.value;
    return allRows.filter((r) => {
      if (userQ && !r.user.name.toLowerCase().includes(userQ)) return false;
      if (dowQ !== "" && r.dow !== parseInt(dowQ, 10)) return false;
      return true;
    });
  }

  function renderTable(): void {
    table.innerHTML = "";
    const rows = applyFilters()
      .slice()
      .sort((a, b) => {
        if (a.dow !== b.dow) return a.dow - b.dow;
        return a.desk.label.localeCompare(b.desk.label);
      });

    if (rows.length === 0) {
      const empty = doc.createElement("p");
      empty.textContent = "Sin recurrencias.";
      Object.assign(empty.style, { color: "#8e92a8", padding: "8px" });
      table.appendChild(empty);
      return;
    }

    for (const r of rows) {
      const row = doc.createElement("div");
      row.dataset["weeklyId"] = String(r.id);
      Object.assign(row.style, {
        display: "grid",
        gridTemplateColumns: "1fr 1.5fr 1fr auto",
        gap: "8px",
        alignItems: "center",
        padding: "6px 8px",
        borderBottom: "1px solid #2a2a3e",
      });

      const deskCell = doc.createElement("span");
      deskCell.textContent = r.desk.label;
      row.appendChild(deskCell);

      const userCell = doc.createElement("span");
      userCell.textContent = r.user.name;
      row.appendChild(userCell);

      const dowCell = doc.createElement("span");
      dowCell.textContent = DOW_LABELS_LONG_ES[r.dow] ?? String(r.dow);
      row.appendChild(dowCell);

      const actions = doc.createElement("span");
      Object.assign(actions.style, { display: "flex", gap: "6px", alignItems: "center" });

      if (r.exceptions.length > 0) {
        const badge = doc.createElement("button");
        badge.dataset["role"] = "exceptions-badge";
        badge.textContent = `${r.exceptions.length} excepciones`;
        Object.assign(badge.style, {
          background: "transparent",
          border: "1px solid #b66dff",
          color: "#b66dff",
          fontFamily: '"Press Start 2P", monospace',
          fontSize: "8px",
          padding: "4px 6px",
          cursor: "pointer",
        });
        badge.addEventListener("click", () => openExceptionsPopover(r, badge));
        actions.appendChild(badge);
      }

      const delBtn = doc.createElement("button");
      delBtn.dataset["role"] = "delete-weekly";
      delBtn.textContent = "Borrar";
      Object.assign(delBtn.style, {
        background: "transparent",
        border: "1px solid #e33636",
        color: "#e33636",
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "8px",
        padding: "4px 6px",
        cursor: "pointer",
      });
      delBtn.addEventListener("click", async () => {
        const dowName = (DOW_LABELS_LONG_ES[r.dow] ?? "").toLowerCase();
        const ok = confirmImpl(
          `¿Borrar la asignación recurrente de ${r.user.name} en ${r.desk.label} los ${dowName}?`,
        );
        if (!ok) return;
        const res = await fetchImpl(`${opts.baseUrl}/api/desks/${r.desk.id}/weekly/${r.id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          allRows = allRows.filter((x) => x.id !== r.id);
          renderTable();
        }
      });
      actions.appendChild(delBtn);

      row.appendChild(actions);
      table.appendChild(row);
    }
  }

  function openExceptionsPopover(r: WeeklyRow, anchor: HTMLElement): void {
    const existing = doc.getElementById("admin-rec-exceptions-popover");
    if (existing) existing.remove();

    const pop = doc.createElement("div");
    pop.id = "admin-rec-exceptions-popover";
    Object.assign(pop.style, {
      position: "absolute",
      background: "#1a1a2e",
      border: "1px solid #b66dff",
      padding: "8px",
      zIndex: "200",
      fontSize: "11px",
      color: "#f5f5f5",
    });

    const list = doc.createElement("ul");
    Object.assign(list.style, { listStyle: "none", padding: "0", margin: "0 0 8px 0" });
    for (const d of r.exceptions) {
      const li = doc.createElement("li");
      li.textContent = d;
      list.appendChild(li);
    }
    pop.appendChild(list);

    const clearBtn = doc.createElement("button");
    clearBtn.dataset["role"] = "clear-exceptions";
    clearBtn.textContent = "Limpiar todas";
    Object.assign(clearBtn.style, {
      background: "transparent",
      border: "1px solid #b66dff",
      color: "#b66dff",
      fontFamily: '"Press Start 2P", monospace',
      fontSize: "8px",
      padding: "4px 6px",
      cursor: "pointer",
    });
    clearBtn.addEventListener("click", async () => {
      const ok = confirmImpl(
        `¿Limpiar las ${String(r.exceptions.length)} excepciones de ${r.user.name} en ${r.desk.label}?`,
      );
      if (!ok) return;
      for (const date of [...r.exceptions]) {
        await fetchImpl(`${opts.baseUrl}/api/desks/${r.desk.id}/weekly/${r.id}/exceptions`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        });
      }
      const idx = allRows.findIndex((x) => x.id === r.id);
      if (idx >= 0) allRows[idx] = { ...allRows[idx]!, exceptions: [] };
      pop.remove();
      renderTable();
    });
    pop.appendChild(clearBtn);

    anchor.parentElement?.appendChild(pop);
  }

  userFilter.addEventListener("input", renderTable);
  dowFilter.addEventListener("change", renderTable);

  function load(): void {
    table.innerHTML = "";
    const loading = doc.createElement("p");
    loading.textContent = "Cargando…";
    Object.assign(loading.style, { color: "#8e92a8", padding: "8px" });
    table.appendChild(loading);

    fetchImpl(`${opts.baseUrl}/api/offices/${currentOfficeId}/weekly`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data: WeeklyRow[]) => {
        allRows = data;
        renderTable();
      })
      .catch(() => {
        table.innerHTML = "";
        const err = doc.createElement("p");
        err.textContent = "Error al cargar.";
        Object.assign(err.style, { color: "#e33636", padding: "8px" });
        table.appendChild(err);
      });
  }

  load();
}
