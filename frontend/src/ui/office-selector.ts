import type { OfficeSummary } from "@virtual-office/shared";

export function mountOfficeSelector(
  parent: HTMLElement,
  currentId: number,
  offices: OfficeSummary[],
  onChange: (id: number) => void,
): void {
  parent.innerHTML = "";

  const current = offices.find((o) => o.id === currentId);
  const currentName = current?.name ?? String(currentId);

  const wrapper = document.createElement("div");
  wrapper.className = "office-selector";

  const label = document.createElement("span");
  label.className = "office-selector__current";
  label.textContent = currentName;
  wrapper.appendChild(label);

  if (offices.length > 1) {
    const menu = document.createElement("ul");
    menu.className = "office-selector__menu";

    for (const office of offices) {
      if (office.id === currentId) continue;
      const item = document.createElement("li");
      item.className = "office-selector__item";
      item.dataset.officeId = String(office.id);
      item.textContent = office.name;
      item.addEventListener("click", () => onChange(office.id));
      menu.appendChild(item);
    }

    wrapper.appendChild(menu);
  }

  parent.appendChild(wrapper);
}
