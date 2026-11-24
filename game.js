const page = document.querySelector("#game-page");
const id = new URLSearchParams(window.location.search).get("id");
const game = GAMES.find(item => item.id === id);

document.querySelector("#year").textContent = new Date().getFullYear();

function getCollectedCardCounts() {
  try {
    const saved = localStorage.getItem("sg-games-card-collection");
    if (!saved) return {};

    const collection = JSON.parse(saved);
    if (
      !collection ||
      !collection.cards ||
      typeof collection.cards !== "object" ||
      Array.isArray(collection.cards) ||
      !Object.values(collection.cards).every(count => Number.isSafeInteger(count) && count >= 0)
    ) {
      throw new Error("Сохранённые данные карточек имеют неверный формат.");
    }

    return collection.cards;
  } catch (error) {
    console.error("Не удалось загрузить прогресс карточек игры.", error);
    return null;
  }
}

if (!game) {
  page.innerHTML = `
    <section class="not-found">
      <div><h1>Игра не найдена</h1><a class="text-link" href="index.html">Вернуться в каталог</a></div>
    </section>`;
} else {
  document.title = `${game.title} — SG GAMES`;
  const rarityNames = { common: "Обычная", rare: "Редкая", legendary: "Легендарная" };
  const cardCounts = getCollectedCardCounts();
  const collectibleCards = game.collectibleCards ?? [];
  const collectionContent = cardCounts === null
    ? '<p class="game-collection-error" role="status">Не удалось загрузить карточки. Проверь хранилище браузера.</p>'
    : collectibleCards.length
      ? `<div class="game-collectible-grid">${collectibleCards.map(card => {
        const id = `${game.id}-${card.rarity}`;
        const count = cardCounts[id] ?? (card.rarity === "common" ? cardCounts[game.id] : 0) ?? 0;
        const rarityName = rarityNames[card.rarity] ?? "Карточка";
        return `
          <article class="game-collectible rarity-${card.rarity} ${count > 0 ? "is-collected" : "is-locked"}">
            <div class="game-collectible-art">
              <img src="${card.cover}" alt="${card.name}" loading="lazy">
              ${count > 0 ? "" : '<span class="game-collectible-lock" aria-label="Ещё не открыта">?</span>'}
            </div>
            <div class="game-collectible-info">
              <span class="game-collectible-name">${card.name}</span>
              <span class="rarity-tag">${rarityName}</span>
              <span class="game-collectible-count">${count > 0 ? `Открыта ×${count}` : "Не открыта"}</span>
            </div>
          </article>`;
      }).join("")}</div>`
      : '<p class="game-collection-error">Карточки для этой игры пока не добавлены.</p>';
  page.innerHTML = `
    <div class="store-page">
      <header class="store-heading">
        <p class="store-kicker">SG Games <span aria-hidden="true">/</span> ${game.genre}</p>
        <h1>${game.title}</h1>
      </header>
      <div class="store-layout">
        <div class="store-main-column">
          <div class="store-media" aria-label="Обложка игры ${game.title}">
            <img class="store-media-backdrop" src="${game.cover}" alt="" aria-hidden="true">
            <img class="store-media-art${game.coverMode === "contain" ? " contain" : ""}" src="${game.cover}" alt="Обложка игры ${game.title}">
          </div>
          <section class="store-overview">
            <h2 class="section-title">Об этой игре</h2>
            <p class="description">${game.description}</p>
            <h3 class="features-heading">Особенности</h3>
            <ul class="feature-list">
              ${game.features.map(feature => `<li>${feature}</li>`).join("")}
            </ul>
          </section>
          ${game.screenshots.length ? `<section class="screenshots">
            <h2 class="section-title">Скриншоты</h2>
            <div class="screenshot-grid">
              ${game.screenshots.map((shot, index) => `<img src="${shot}" alt="${game.title}: скриншот ${index + 1}">`).join("")}
            </div>
          </section>` : ""}
        </div>
        <aside class="store-sidebar" aria-label="Информация об игре">
          <p class="store-short">${game.short}</p>
          <dl class="store-facts">
            <div><dt>Жанр</dt><dd>${game.genre}</dd></div>
            <div><dt>Разработчик</dt><dd>s3rggg7</dd></div>
            <div><dt>Платформа</dt><dd>Android</dd></div>
            ${game.year ? `<div><dt>Год</dt><dd>${game.year}</dd></div>` : ""}
          </dl>
          <div class="store-download">
            <p>${game.downloadUrl ? "Игра уже доступна" : "Игра пока недоступна для скачивания"}</p>
            ${game.downloadUrl ? `
              <a class="download-button" href="${game.downloadUrl}" download>Скачать игру</a>
              <p class="download-size">Размер APK: ${game.downloadSize || "уточняется"}</p>
            ` : ""}
          </div>
        </aside>
      </div>
      <section class="game-collection" aria-labelledby="game-collection-title">
        <div class="game-collection-heading">
          <div>
            <p class="store-kicker">Коллекция</p>
            <h2 class="section-title" id="game-collection-title">Карточки ${game.title}</h2>
          </div>
          <a class="game-collection-link" href="collection.html">Вся коллекция ↗</a>
        </div>
        ${collectionContent}
      </section>
    </div>`;
}
