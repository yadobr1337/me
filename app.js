const STORAGE_KEY = "watched-list-v1";
const DELETED_IDS_KEY = "watched-list-deleted-v1";
const LOCAL_CHANGES_KEY = "watched-list-local-changes-v1";
const API_URL = "/api/items";
const PASSWORD = "101112";
const typeNames = {
  movie: "Фильм",
  series: "Сериал",
  anime: "Аниме",
};
const statusNames = {
  watched: "Просмотрено",
  planned: "Запланировано",
};
const imageSearchCategoryNames = {
  movie: "фильм",
  series: "сериал",
  anime: "аниме",
};

let deletedIds = loadDeletedIds();
let items = loadItems();
let hasLocalChanges = loadLocalChangesFlag();
let currentType = "all";
let currentStatus = "watched";
let sortMode = "recent";
let selectedImage = "";
let selectedEditImage = "";
let deleteTargetId = null;
let editTargetId = null;
let posterLoadRunId = 0;
let posterObserver = null;
let pageIsLoaded = document.readyState === "complete";
let remoteSyncEnabled = false;
let remoteSaveTimer = null;

const grid = document.querySelector("#watchGrid");
const emptyState = document.querySelector("#emptyState");
const countText = document.querySelector("#countText");
const searchInput = document.querySelector("#searchInput");
const mobileSearchInput = document.querySelector("#mobileSearchInput");
const sortFilter = document.querySelector("#sortFilter");
const typeFilter = document.querySelector("#typeFilter");
const statusFilter = document.querySelector("#statusFilter");
const filtersPanel = document.querySelector("#filtersPanel");
const openFiltersButton = document.querySelector("#openFilters");
const closeFiltersButton = document.querySelector("#closeFilters");
const filterBackdrop = document.querySelector("#filterBackdrop");
const passwordModal = document.querySelector("#passwordModal");
const editorModal = document.querySelector("#editorModal");
const passwordInput = document.querySelector("#passwordInput");
const passwordError = document.querySelector("#passwordError");
const addForm = document.querySelector("#addForm");
const titleInput = document.querySelector("#titleInput");
const ratingField = document.querySelector("#ratingField");
const ratingInput = document.querySelector("#ratingInput");
const ratingValue = document.querySelector("#ratingValue");
const ratingSuffix = document.querySelector("#ratingSuffix");
const categoryInput = document.querySelector("#categoryInput");
const statusInput = document.querySelector("#statusInput");
const imageResults = document.querySelector("#imageResults");
const manualImage = document.querySelector("#manualImage");
const editSearch = document.querySelector("#editSearch");
const editResults = document.querySelector("#editResults");
const editHint = document.querySelector("#editHint");
const editFields = document.querySelector("#editFields");
const editTitle = document.querySelector("#editTitle");
const editRatingField = document.querySelector("#editRatingField");
const editRatingInput = document.querySelector("#editRatingInput");
const editRatingValue = document.querySelector("#editRatingValue");
const editRatingSuffix = document.querySelector("#editRatingSuffix");
const editLoadImages = document.querySelector("#editLoadImages");
const editImageResults = document.querySelector("#editImageResults");
const editManualImage = document.querySelector("#editManualImage");
const editSaveButton = document.querySelector("#editSaveButton");
const deleteSearch = document.querySelector("#deleteSearch");
const deleteButton = document.querySelector("#deleteButton");
const deleteHint = document.querySelector("#deleteHint");
const deleteResults = document.querySelector("#deleteResults");

scheduleBackgroundEffects();

window.addEventListener(
  "load",
  () => {
    pageIsLoaded = true;
  },
  { once: true },
);

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

searchInput.addEventListener("input", () => {
  syncSearchInput(searchInput, mobileSearchInput);
  render();
});

mobileSearchInput.addEventListener("input", () => {
  syncSearchInput(mobileSearchInput, searchInput);
  render();
});

setupFilterDropdown(typeFilter, "type", (value) => {
  currentType = value;
});

setupFilterDropdown(sortFilter, "sort", (value) => {
  sortMode = value;
});

setupFilterDropdown(statusFilter, "status", (value) => {
  currentStatus = value;
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".filter-dropdown")) return;
  closeAllDropdowns();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (document.body.classList.contains("filter-sheet-open")) {
    setFilterSheetOpen(false);
    return;
  }

  closeAllDropdowns();
});

openFiltersButton.addEventListener("click", () => setFilterSheetOpen(true));
closeFiltersButton.addEventListener("click", () => setFilterSheetOpen(false));
filterBackdrop.addEventListener("click", () => setFilterSheetOpen(false));

ratingInput.addEventListener("input", () => {
  ratingValue.textContent = ratingInput.value;
});
statusInput.addEventListener("change", updateAddRatingAvailability);

document.querySelector("#loadImages").addEventListener("click", loadAddImageChoices);
manualImage.addEventListener("input", () => {
  selectedImage = manualImage.value.trim();
  imageResults.querySelectorAll(".image-choice").forEach((choice) => choice.classList.remove("selected"));
});

editSearch.addEventListener("input", updateEditTarget);
editRatingInput.addEventListener("input", () => {
  editRatingValue.textContent = editRatingInput.value;
});
editLoadImages.addEventListener("click", loadEditImageChoices);
editManualImage.addEventListener("input", () => {
  selectedEditImage = editManualImage.value.trim();
  editImageResults.querySelectorAll(".image-choice").forEach((choice) => choice.classList.remove("selected"));
});
editSaveButton.addEventListener("click", saveEditedItem);

addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  const poster = selectedImage || manualImage.value.trim() || createFallbackPoster(title);
  items.unshift({
    id: createId(),
    title,
    rating: getRatingForStatus(statusInput.value, ratingInput.value),
    type: categoryInput.value,
    status: statusInput.value,
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
  if (!target) return;
  const confirmed = confirm(`Удалить "${target.title}" из списка?`);
  if (!confirmed) return;

  deletedIds.add(deleteTargetId);
  saveDeletedIds();
  items = items.filter((item) => item.id !== deleteTargetId);
  saveItems();
  deleteSearch.value = "";
  updateDeleteTarget();
  render();
});

render();
syncItemsFromServer();

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
    .filter((item) => currentStatus === "all" || getItemStatus(item) === currentStatus)
    .filter((item) => item.title.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sortMode === "rating") return getSortableRating(b) - getSortableRating(a) || b.createdAt - a.createdAt;
      return b.createdAt - a.createdAt;
    });

  grid.innerHTML = sorted
    .map((item, index) => {
      const searchUrl = `https://ya.ru/search/?text=${encodeURIComponent(item.title)}`;
      const rating = normalizeRating(item.rating);
      const isTopRated = rating > 8;
      const typeIcon = item.type === "movie" ? "film" : "tv";
      const viewName = createViewName(item.id);
      const status = getItemStatus(item);
      const placeholder = createPosterPlaceholder(item.title);
      return `
        <a class="card ${isTopRated ? "top-rated" : ""}" href="${searchUrl}" target="_blank" rel="noopener noreferrer" style="--delay: ${index * 45}ms; view-transition-name: ${viewName}" aria-label="Открыть поиск Яндекса: ${escapeAttribute(item.title)}">
          <div class="poster-wrap">
            <img class="poster" src="${escapeAttribute(placeholder)}" data-src="${escapeAttribute(item.poster)}" alt="${escapeAttribute(item.title)}" loading="lazy" decoding="async" />
            <span class="poster-overlay"></span>
            <span class="poster-type">${typeNames[item.type]}</span>
            <span class="poster-status">${statusNames[status]}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            ${isTopRated ? `<span class="top-line" aria-hidden="true"></span>` : ""}
            <div class="meta-row">
              <span class="rating ${rating === null ? "no-rating" : ""}">${iconSvg("star", 18, "star-icon")}<span>${formatRatingText(item)}</span></span>
              <span class="media-icon" title="${statusNames[status]}">${iconSvg(typeIcon, 22)}</span>
            </div>
          </div>
        </a>
      `;
    })
    .join("");

  emptyState.classList.toggle("visible", sorted.length === 0);
  countText.textContent = getCountText(sorted.length);
  schedulePosterLoading();
}

function smoothRender() {
  render();
}

function syncSearchInput(source, target) {
  if (target.value !== source.value) target.value = source.value;
}

function setupFilterDropdown(dropdown, dataName, onChange) {
  const trigger = dropdown.querySelector(".dropdown-trigger");
  const valueText = dropdown.querySelector(".dropdown-value");
  const optionSelector = `button[data-${dataName}]`;

  trigger.addEventListener("click", () => {
    const willOpen = !dropdown.classList.contains("open");
    closeAllDropdowns();
    setDropdownOpen(dropdown, willOpen);
  });

  dropdown.addEventListener("click", (event) => {
    const button = event.target.closest(optionSelector);
    if (!button) return;

    onChange(button.dataset[dataName]);
    dropdown.querySelectorAll(optionSelector).forEach((item) => item.classList.toggle("active", item === button));
    valueText.textContent = button.textContent.trim();
    setDropdownOpen(dropdown, false);
    smoothRender();
  });

  const activeButton = dropdown.querySelector(`${optionSelector}.active`);
  if (activeButton) valueText.textContent = activeButton.textContent.trim();
}

function setDropdownOpen(dropdown, open) {
  dropdown.classList.toggle("open", open);
  dropdown.querySelector(".dropdown-trigger").setAttribute("aria-expanded", String(open));
}

function closeAllDropdowns() {
  document.querySelectorAll(".filter-dropdown.open").forEach((dropdown) => setDropdownOpen(dropdown, false));
}

function setFilterSheetOpen(open) {
  document.body.classList.toggle("filter-sheet-open", open);
  filtersPanel.classList.toggle("open", open);
  openFiltersButton.setAttribute("aria-expanded", String(open));
  if (!open) closeAllDropdowns();
}

function updateAddRatingAvailability() {
  const disabled = statusInput.value === "planned";
  ratingInput.disabled = disabled;
  ratingField.classList.toggle("disabled", disabled);
  ratingSuffix.hidden = disabled;
  ratingValue.textContent = disabled ? "после просмотра" : ratingInput.value;
}

async function loadAddImageChoices() {
  const title = titleInput.value.trim();
  if (!title) {
    showImageMessage("Сначала введите название.", imageResults);
    titleInput.focus();
    return;
  }

  showImageMessage("Ищу изображения...", imageResults);
  selectedImage = "";

  try {
    const urls = await searchYandexImages(createImageSearchQuery(categoryInput.value, title));
    if (urls.length === 0) {
      showImageMessage("Не получилось найти фото. Можно вставить ссылку вручную ниже.", imageResults);
      return;
    }

    renderImageChoices(urls, imageResults, manualImage, (url) => {
      selectedImage = url;
    });
  } catch (error) {
    showImageMessage("Поиск временно недоступен. Вставьте ссылку на фото вручную.", imageResults);
  }
}

async function loadEditImageChoices() {
  const target = getEditTarget();
  const title = editTitle.value.trim();
  if (!target || !title) {
    showImageMessage("Сначала выберите запись и введите название.", editImageResults);
    return;
  }

  showImageMessage("Ищу изображения...", editImageResults);
  selectedEditImage = "";

  try {
    const urls = await searchYandexImages(createImageSearchQuery(target.type, title));
    if (urls.length === 0) {
      showImageMessage("Не получилось найти фото. Можно вставить ссылку вручную ниже.", editImageResults);
      return;
    }

    renderImageChoices(urls, editImageResults, editManualImage, (url) => {
      selectedEditImage = url;
    });
  } catch (error) {
    showImageMessage("Поиск временно недоступен. Вставьте ссылку на фото вручную.", editImageResults);
  }
}

function renderImageChoices(urls, target, manualInput, onSelect) {
  target.innerHTML = urls
    .slice(0, 3)
    .map(
      (url, index) => `
        <div class="image-choice">
          <img src="${escapeAttribute(url)}" alt="Вариант обложки ${index + 1}" loading="lazy" decoding="async" />
          <button type="button" data-url="${escapeAttribute(url)}" aria-label="Выбрать обложку ${index + 1}"></button>
        </div>
      `,
    )
    .join("");

  target.querySelectorAll("button[data-url]").forEach((button) => {
    button.addEventListener("click", () => {
      const url = button.dataset.url;
      onSelect(url);
      manualInput.value = url;
      target.querySelectorAll(".image-choice").forEach((choice) => choice.classList.remove("selected"));
      button.parentElement.classList.add("selected");
    });
  });
}

function createImageSearchQuery(type, title) {
  return `${imageSearchCategoryNames[type] || ""} ${title} постер`.trim();
}

async function searchYandexImages(query) {
  const yandexUrl = `https://yandex.ru/images/search?text=${encodeURIComponent(query)}`;
  const proxyUrl = `https://r.jina.ai/http://${yandexUrl}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8500);

  const response = await fetch(proxyUrl, { signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) throw new Error("Image search failed");

  const markdown = await response.text();
  const matches = [...markdown.matchAll(/!\[[^\]]*]\((https:\/\/avatars\.mds\.yandex\.net\/[^)]+)\)/g)];
  return [...new Set(matches.map((match) => match[1].replace(/&amp;/g, "&")))];
}

function showImageMessage(text, target = imageResults) {
  target.innerHTML = `<div class="image-message">${escapeHtml(text)}</div>`;
}

function updateEditTarget() {
  const query = editSearch.value.trim().toLowerCase();
  editTargetId = null;
  selectedEditImage = "";
  editResults.innerHTML = "";
  editFields.hidden = true;

  if (!query) {
    editHint.textContent = "Начните вводить название записи.";
    return;
  }

  const matches = items.filter((item) => item.title.toLowerCase().includes(query)).slice(0, 6);
  if (matches.length === 0) {
    editHint.textContent = "Ничего не найдено.";
    return;
  }

  editHint.textContent = "Выберите запись для изменения.";
  editResults.innerHTML = matches.map(renderListActionButton).join("");

  editResults.querySelectorAll(".delete-result").forEach((button) => {
    button.addEventListener("click", () => selectEditTarget(button.dataset.id));
  });
}

function selectEditTarget(id) {
  const target = items.find((item) => item.id === id);
  if (!target) return;

  editTargetId = id;
  selectedEditImage = "";
  editResults.querySelectorAll(".delete-result").forEach((item) => item.classList.toggle("selected", item.dataset.id === id));
  editFields.hidden = false;
  editTitle.value = target.title;
  editManualImage.value = target.poster || "";
  editImageResults.innerHTML = target.poster
    ? `
      <div class="image-choice selected">
        <img src="${escapeAttribute(target.poster)}" alt="${escapeAttribute(target.title)}" loading="lazy" decoding="async" />
      </div>
    `
    : `<div class="image-message">Фото пока не выбрано.</div>`;

  const rating = normalizeRating(target.rating) || 8;
  editRatingInput.value = String(rating);
  editRatingValue.textContent = String(rating);
  updateEditRatingAvailability();
  editHint.textContent = `Редактируется: ${target.title}`;
}

function updateEditRatingAvailability() {
  const target = getEditTarget();
  const disabled = !target || getItemStatus(target) === "planned";
  editRatingInput.disabled = disabled;
  editRatingField.classList.toggle("disabled", disabled);
  editRatingSuffix.hidden = disabled;
  editRatingValue.textContent = disabled ? "после просмотра" : editRatingInput.value;
}

function saveEditedItem() {
  const target = getEditTarget();
  const title = editTitle.value.trim();
  if (!target || !title) return;

  const savedId = editTargetId;
  const poster = selectedEditImage || editManualImage.value.trim() || target.poster || createFallbackPoster(title);
  items = items.map((item) => {
    if (item.id !== savedId) return item;
    return {
      ...item,
      title,
      rating: getRatingForStatus(getItemStatus(item), editRatingInput.value),
      poster,
    };
  });

  saveItems();
  render();
  editSearch.value = title;
  updateEditTarget();
  selectEditTarget(savedId);
  updateDeleteTarget();
  editHint.textContent = `Сохранено: ${title}`;
}

function getEditTarget() {
  return items.find((item) => item.id === editTargetId) || null;
}

function renderListActionButton(item) {
  return `
    <button class="delete-result" type="button" data-id="${escapeAttribute(item.id)}">
      <img src="${escapeAttribute(item.poster)}" alt="" loading="lazy" decoding="async" />
      <span>${escapeHtml(item.title)}</span>
      <strong>${formatRatingText(item)}</strong>
    </button>
  `;
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
  deleteResults.innerHTML = matches.map(renderListActionButton).join("");

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
  ratingSuffix.hidden = false;
  updateAddRatingAvailability();
  selectedImage = "";
  selectedEditImage = "";
  editTargetId = null;
  editSearch.value = "";
  editResults.innerHTML = "";
  editFields.hidden = true;
  editHint.textContent = "Начните вводить название записи.";
  editTitle.value = "";
  editRatingInput.value = "8";
  editRatingValue.textContent = "8";
  editRatingSuffix.hidden = false;
  editManualImage.value = "";
  editImageResults.innerHTML = "";
  updateEditRatingAvailability();
  deleteTargetId = null;
  deleteSearch.value = "";
  deleteResults.innerHTML = "";
  deleteHint.textContent = "Начните вводить название записи.";
  deleteButton.disabled = true;
  showImageMessage("Здесь появятся найденные фото.");
}

function loadItems() {
  try {
    const storedItems = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return storedItems.map((item) => ({
      ...item,
      status: getItemStatus(item),
      rating: getItemStatus(item) === "planned" ? null : normalizeRating(item.rating) || 8,
    })).filter((item) => !deletedIds.has(item.id));
  } catch {
    return [];
  }
}

function saveItems(options = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (options.skipRemote) return;
  setLocalChangesPending(true);
  scheduleRemoteSave();
}

function loadDeletedIds() {
  try {
    const storedIds = JSON.parse(localStorage.getItem(DELETED_IDS_KEY)) || [];
    return new Set(Array.isArray(storedIds) ? storedIds.map(String).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function saveDeletedIds() {
  localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedIds]));
}

function loadLocalChangesFlag() {
  return localStorage.getItem(LOCAL_CHANGES_KEY) === "1";
}

function setLocalChangesPending(value) {
  hasLocalChanges = value;
  localStorage.setItem(LOCAL_CHANGES_KEY, value ? "1" : "0");
}

function createFallbackPoster(title) {
  const safeTitle = encodeURIComponent(title);
  return `https://placehold.co/600x800/121826/f8fafc?text=${safeTitle}`;
}

function createPosterPlaceholder(title) {
  const shortTitle = String(title).slice(0, 22);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
      <rect width="600" height="800" fill="#070707"/>
      <circle cx="300" cy="305" r="122" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="3"/>
      <path d="M90 505h420" stroke="rgba(255,255,255,.16)" stroke-width="3"/>
      <text x="300" y="570" fill="rgba(255,255,255,.72)" font-family="Arial, sans-serif" font-size="34" font-weight="700" text-anchor="middle">${escapeSvg(shortTitle)}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getRatingForStatus(status, value) {
  return status === "planned" ? null : normalizeRating(value) || 8;
}

function normalizeRating(value) {
  if (value === null || value === undefined || value === "") return null;
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) return null;
  return rating;
}

function getSortableRating(item) {
  return normalizeRating(item.rating) || 0;
}

function formatRatingText(item) {
  const rating = normalizeRating(item.rating);
  return rating === null ? "Без рейтинга" : `${rating}/10`;
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

  const isSmallScreen = window.matchMedia("(max-width: 560px)").matches;
  const particles = Array.from({ length: isSmallScreen ? 8 : 14 }, (_, index) => ({
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

function scheduleBackgroundEffects() {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(createParticleField, { timeout: 1200 });
    return;
  }

  requestAnimationFrame(() => {
    setTimeout(createParticleField, 120);
  });
}

function schedulePosterLoading() {
  const runId = ++posterLoadRunId;
  const load = () => observePosterImages(runId);
  const delay = pageIsLoaded ? 260 : 1100;

  const schedule = () => {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(load, { timeout: 1200 });
      return;
    }

    setTimeout(load, 120);
  };

  if (pageIsLoaded) {
    setTimeout(schedule, delay);
    return;
  }

  window.addEventListener(
    "load",
    () => {
      pageIsLoaded = true;
      setTimeout(schedule, delay);
    },
    { once: true },
  );
}

function observePosterImages(runId) {
  if (runId !== posterLoadRunId) return;
  if (posterObserver) posterObserver.disconnect();

  const posters = [...document.querySelectorAll(".poster[data-src]")];
  if (posters.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    posters.slice(0, 4).forEach(loadPosterImage);
    return;
  }

  posterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        posterObserver.unobserve(entry.target);
        loadPosterImage(entry.target);
      });
    },
    { rootMargin: "180px 0px", threshold: 0.01 },
  );

  posters.forEach((poster) => posterObserver.observe(poster));
}

function loadPosterImage(poster) {
  const url = poster.dataset.src;
  if (!url || poster.dataset.loading === "true") return;
  poster.dataset.loading = "true";

  const image = new Image();
  const timeout = setTimeout(() => {
    image.onload = null;
    image.onerror = null;
    image.src = "";
    poster.removeAttribute("data-src");
    poster.removeAttribute("data-loading");
  }, 5000);

  image.onload = () => {
    clearTimeout(timeout);
    poster.src = url;
    poster.removeAttribute("data-src");
    poster.removeAttribute("data-loading");
  };

  image.onerror = () => {
    clearTimeout(timeout);
    poster.removeAttribute("data-src");
    poster.removeAttribute("data-loading");
  };

  image.decoding = "async";
  image.fetchPriority = "low";
  image.src = url;
}

function getItemStatus(item) {
  return item.status === "planned" ? "planned" : "watched";
}

async function syncItemsFromServer() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Remote list is unavailable");

    remoteSyncEnabled = true;
    const remoteItems = normalizeItems(await response.json());
    const nextItems = hasLocalChanges ? mergeItems(remoteItems, items) : removeDeletedItems(remoteItems);
    const shouldUploadLocalItems = hasLocalChanges
      ? !itemsAreEqual(nextItems, removeDeletedItems(remoteItems)) || remoteItems.some((item) => deletedIds.has(item.id))
      : remoteItems.some((item) => deletedIds.has(item.id));

    items = nextItems;
    saveItems({ skipRemote: true });
    render();

    if (shouldUploadLocalItems) scheduleRemoteSave();
  } catch {
    remoteSyncEnabled = false;
  }
}

function scheduleRemoteSave() {
  if (!remoteSyncEnabled) return;
  clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(saveItemsToServer, 350);
}

async function saveItemsToServer() {
  if (!remoteSyncEnabled) return;

  try {
    const response = await fetch(API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Password": PASSWORD,
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) throw new Error("Remote save failed");
    setLocalChangesPending(false);
  } catch {
    remoteSyncEnabled = false;
  }
}

function normalizeItems(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => item && typeof item.title === "string" && item.title.trim())
    .map((item) => ({
      id: item.id || createId(),
      title: item.title.trim(),
      rating: getItemStatus(item) === "planned" ? null : normalizeRating(item.rating) || 8,
      type: typeNames[item.type] ? item.type : "movie",
      status: getItemStatus(item),
      poster: typeof item.poster === "string" && item.poster ? item.poster : createFallbackPoster(item.title),
      createdAt: Number(item.createdAt) || Date.now(),
    }));
}

function mergeItems(remoteItems, localItems) {
  const merged = new Map();
  removeDeletedItems(remoteItems).forEach((item) => {
    if (!deletedIds.has(item.id)) merged.set(item.id, item);
  });
  normalizeItems(localItems).forEach((item) => {
    if (!deletedIds.has(item.id) && !merged.has(item.id)) merged.set(item.id, item);
  });
  return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function removeDeletedItems(sourceItems) {
  return normalizeItems(sourceItems).filter((item) => !deletedIds.has(item.id));
}

function itemsAreEqual(firstItems, secondItems) {
  return JSON.stringify(normalizeItems(firstItems)) === JSON.stringify(normalizeItems(secondItems));
}

function escapeSvg(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return map[char];
  });
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
