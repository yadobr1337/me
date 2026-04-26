const STORAGE_KEY = "watched-list-v1";
const PASSWORD = "101112";
const typeNames = {
  movie: "Фильм",
  series: "Сериал",
  anime: "Аниме",
};

let items = loadItems();
let currentType = "all";
let sortMode = "recent";
let selectedImage = "";
let deleteTargetId = null;

const grid = document.querySelector("#watchGrid");
const emptyState = document.querySelector("#emptyState");
const countText = document.querySelector("#countText");
const searchInput = document.querySelector("#searchInput");
const sortFilter = document.querySelector("#sortFilter");
const typeFilter = document.querySelector("#typeFilter");
const passwordModal = document.querySelector("#passwordModal");
const editorModal = document.querySelector("#editorModal");
const passwordInput = document.querySelector("#passwordInput");
const passwordError = document.querySelector("#passwordError");
const addForm = document.querySelector("#addForm");
const titleInput = document.querySelector("#titleInput");
const ratingInput = document.querySelector("#ratingInput");
const ratingValue = document.querySelector("#ratingValue");
const categoryInput = document.querySelector("#categoryInput");
const imageResults = document.querySelector("#imageResults");
const manualImage = document.querySelector("#manualImage");
const deleteSearch = document.querySelector("#deleteSearch");
const deleteButton = document.querySelector("#deleteButton");
const deleteHint = document.querySelector("#deleteHint");
const deleteResults = document.querySelector("#deleteResults");

createParticleField();

document.querySelector("#openAdd").addEventListener("click", () => {
  passwordInput.value = "";
  passwordError.textContent = "";
  passwordModal.showModal();
  setTimeout(() => passwordInput.focus(), 50);
});

document.querySelector("#passwordForm").addEventListener("submit", (event) => {
  event.preventDefault();
  unlockEditor();
});

document.querySelector("#closePassword").addEventListener("click", () => passwordModal.close());
document.querySelector("#passwordSubmit").addEventListener("click", unlockEditor);
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockEditor();
});

document.querySelector("#closeEditor").addEventListener("click", () => editorModal.close());

searchInput.addEventListener("input", render);

sortFilter.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-sort]");
  if (!button) return;
  sortMode = button.dataset.sort;
  sortFilter.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  smoothRender();
});

typeFilter.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-type]");
  if (!button) return;
  currentType = button.dataset.type;
  typeFilter.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
  smoothRender();
});

ratingInput.addEventListener("input", () => {
  ratingValue.textContent = ratingInput.value;
});

document.querySelector("#loadImages").addEventListener("click", loadImageChoices);
manualImage.addEventListener("input", () => {
  selectedImage = manualImage.value.trim();
  imageResults.querySelectorAll(".image-choice").forEach((choice) => choice.classList.remove("selected"));
});

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  const poster = selectedImage || manualImage.value.trim() || createFallbackPoster(title);
  items.unshift({
    id: createId(),
    title,
    rating: Number(ratingInput.value),
    type: categoryInput.value,
    poster,
    createdAt: Date.now(),
  });

  saveItems();
  resetForm();
  editorModal.close();
  render();
});

deleteSearch.addEventListener("input", updateDeleteTarget);
deleteButton.addEventListener("click", () => {
  if (!deleteTargetId) return;
  const target = items.find((item) => item.id === deleteTargetId);
  const confirmed = confirm(`Удалить "${target.title}" из списка?`);
  if (!confirmed) return;

  items = items.filter((item) => item.id !== deleteTargetId);
  saveItems();
  deleteSearch.value = "";
  updateDeleteTarget();
  render();
});

render();

function unlockEditor() {
  if (passwordInput.value !== PASSWORD) {
    passwordError.textContent = "Неверный пароль.";
    return;
  }

  passwordModal.close();
  resetForm();
  editorModal.showModal();
  setTimeout(() => titleInput.focus(), 50);
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const sorted = [...items]
    .filter((item) => currentType === "all" || item.type === currentType)
    .filter((item) => item.title.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sortMode === "rating") return b.rating - a.rating || b.createdAt - a.createdAt;
      return b.createdAt - a.createdAt;
    });

  grid.innerHTML = sorted
    .map((item, index) => {
      const searchUrl = `https://ya.ru/search/?text=${encodeURIComponent(item.title)}`;
      const isTopRated = item.rating > 8;
      const typeIcon = item.type === "movie" ? "film" : "tv";
      const viewName = createViewName(item.id);
      return `
        <a class="card ${isTopRated ? "top-rated" : ""}" href="${searchUrl}" target="_blank" rel="noopener noreferrer" style="--delay: ${index * 45}ms; view-transition-name: ${viewName}" aria-label="Открыть поиск Яндекса: ${escapeAttribute(item.title)}">
          <div class="poster-wrap">
            <img class="poster" src="${escapeAttribute(item.poster)}" alt="${escapeAttribute(item.title)}" loading="lazy" />
            <span class="poster-overlay"></span>
            <span class="poster-type">${typeNames[item.type]}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            ${isTopRated ? `<span class="top-line" aria-hidden="true"></span>` : ""}
            <div class="meta-row">
              <span class="rating">${iconSvg("star", 18, "star-icon")}<span>${item.rating}/10</span></span>
              <span class="media-icon">${iconSvg(typeIcon, 22)}</span>
            </div>
          </div>
        </a>
      `;
    })
    .join("");

  emptyState.classList.toggle("visible", sorted.length === 0);
  countText.textContent = getCountText(sorted.length);
}

function smoothRender() {
  if (!document.startViewTransition) {
    render();
    return;
  }

  document.startViewTransition(() => {
    render();
  });
}

async function loadImageChoices() {
  const title = titleInput.value.trim();
  if (!title) {
    showImageMessage("Сначала введите название.");
    titleInput.focus();
    return;
  }

  showImageMessage("Ищу изображения...");
  selectedImage = "";

  try {
    const urls = await searchYandexImages(title);
    if (urls.length === 0) {
      showImageMessage("Не получилось найти фото. Можно вставить ссылку вручную ниже.");
      return;
    }

    imageResults.innerHTML = urls
      .slice(0, 3)
      .map(
        (url, index) => `
          <div class="image-choice">
            <img src="${escapeAttribute(url)}" alt="Вариант обложки ${index + 1}" />
            <button type="button" data-url="${escapeAttribute(url)}" aria-label="Выбрать обложку ${index + 1}"></button>
          </div>
        `,
      )
      .join("");

    imageResults.querySelectorAll("button[data-url]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedImage = button.dataset.url;
        manualImage.value = selectedImage;
        imageResults.querySelectorAll(".image-choice").forEach((choice) => choice.classList.remove("selected"));
        button.parentElement.classList.add("selected");
      });
    });
  } catch (error) {
    showImageMessage("Поиск временно недоступен. Вставьте ссылку на фото вручную.");
  }
}

async function searchYandexImages(query) {
  const yandexUrl = `https://yandex.ru/images/search?text=${encodeURIComponent(query)}`;
  const proxyUrl = `https://r.jina.ai/http://${yandexUrl}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error("Image search failed");

  const markdown = await response.text();
  const matches = [...markdown.matchAll(/!\[[^\]]*]\((https:\/\/avatars\.mds\.yandex\.net\/[^)]+)\)/g)];
  return [...new Set(matches.map((match) => match[1].replace(/&amp;/g, "&")))];
}

function showImageMessage(text) {
  imageResults.innerHTML = `<div class="image-message">${escapeHtml(text)}</div>`;
}

function updateDeleteTarget() {
  const query = deleteSearch.value.trim().toLowerCase();
  deleteTargetId = null;
  deleteResults.innerHTML = "";

  if (!query) {
    deleteHint.textContent = "Начните вводить название записи.";
    deleteButton.disabled = true;
    return;
  }

  const matches = items.filter((item) => item.title.toLowerCase().includes(query)).slice(0, 6);
  if (matches.length === 0) {
    deleteHint.textContent = "Ничего не найдено.";
    deleteButton.disabled = true;
    return;
  }

  deleteHint.textContent = "Выберите запись из списка.";
  deleteResults.innerHTML = matches
    .map(
      (item) => `
        <button class="delete-result" type="button" data-id="${escapeAttribute(item.id)}">
          <img src="${escapeAttribute(item.poster)}" alt="" loading="lazy" />
          <span>${escapeHtml(item.title)}</span>
          <strong>${item.rating}/10</strong>
        </button>
      `,
    )
    .join("");

  deleteResults.querySelectorAll(".delete-result").forEach((button) => {
    button.addEventListener("click", () => {
      deleteTargetId = button.dataset.id;
      deleteResults.querySelectorAll(".delete-result").forEach((item) => item.classList.toggle("selected", item === button));
      const target = items.find((item) => item.id === deleteTargetId);
      deleteHint.textContent = `Выбрано для удаления: ${target.title}`;
      deleteButton.disabled = false;
    });
  });
}

function resetForm() {
  addForm.reset();
  ratingInput.value = "8";
  ratingValue.textContent = "8";
  selectedImage = "";
  deleteTargetId = null;
  deleteSearch.value = "";
  deleteResults.innerHTML = "";
  deleteHint.textContent = "Начните вводить название записи.";
  deleteButton.disabled = true;
  showImageMessage("Здесь появятся найденные фото.");
}

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function createFallbackPoster(title) {
  const safeTitle = encodeURIComponent(title);
  return `https://placehold.co/600x800/121826/f8fafc?text=${safeTitle}`;
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createViewName(id) {
  return `card-${String(id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function getCountText(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} записей`;
  if (last === 1) return `${count} запись`;
  if (last >= 2 && last <= 4) return `${count} записи`;
  return `${count} записей`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(String(value));
}

function createParticleField() {
  const field = document.querySelector("#particleField");
  if (!field || field.children.length > 0) return;

  const particles = Array.from({ length: 22 }, (_, index) => ({
    left: `${(index * 37) % 100}%`,
    top: `${-18 + ((index * 19) % 38)}%`,
    size: 1 + (index % 3),
    duration: 14 + (index % 8),
    delay: (index % 9) * 0.55,
    driftX: index % 2 === 0 ? 18 + index : -18 - index,
    driftY: 118 + index * 7,
  }));

  const fragment = document.createDocumentFragment();
  particles.forEach((particle) => {
    const star = document.createElement("span");
    star.className = "particle";
    star.style.setProperty("--left", particle.left);
    star.style.setProperty("--top", particle.top);
    star.style.setProperty("--size", `${particle.size}px`);
    star.style.setProperty("--duration", `${particle.duration}s`);
    star.style.setProperty("--delay", `${particle.delay}s`);
    star.style.setProperty("--drift-x", `${particle.driftX}px`);
    star.style.setProperty("--drift-y", `${particle.driftY}px`);
    fragment.appendChild(star);
  });

  field.appendChild(fragment);
}

function iconSvg(name, size = 22, className = "") {
  const icons = {
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.1L12 17.2 6.4 20.1 7.5 14 3 9.6l6.2-.9L12 3Z" />',
    film: '<rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" />',
    tv: '<rect x="4" y="6" width="16" height="11" rx="2" /><path d="M8 21h8M12 17v4" />',
  };

  return `
    <svg class="${escapeAttribute(className)}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      ${icons[name] || ""}
    </svg>
  `;
}
