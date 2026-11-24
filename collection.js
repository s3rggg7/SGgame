const collectionGrid = document.querySelector("#card-grid");
const openChestButton = document.querySelector("#open-chest");
const cardDialog = document.querySelector("#card-dialog");
const cardDialogContent = document.querySelector("#card-dialog-content");
const collectionSort = document.querySelector(".collection-sort");

if (collectionGrid && openChestButton) {
  const storageKey = "sg-games-card-collection";
  const coinCount = document.querySelector("#coin-count");
  const cardTotal = document.querySelector("#card-total");
  const chestStatus = document.querySelector("#chest-status");
  const chestResult = document.querySelector("#chest-result");
  const chestScene = document.querySelector("#chest-scene");
  const cardPrices = { common: 30, rare: 75, legendary: 150 };
  const rarities = [
    { id: "common", name: "Обычная" },
    { id: "rare", name: "Редкая" },
    { id: "legendary", name: "Легендарная" }
  ];
  const cards = GAMES.flatMap(game => (game.collectibleCards ?? rarities.map(rarity => ({
    rarity: rarity.id,
    name: `${game.title} — ${rarity.name}`,
    description: `${rarity.name} карточка игры ${game.title}.`,
    cover: game.cover,
    coverMode: game.coverMode
  }))).map(cardData => {
    const rarity = rarities.find(item => item.id === cardData.rarity);
    if (!rarity) throw new Error(`Неизвестная редкость карточки "${cardData.rarity}" игры "${game.id}".`);
    return {
      ...cardData,
      id: `${game.id}-${rarity.id}`,
      game,
      rarity,
      price: cardPrices[rarity.id],
      coverMode: cardData.coverMode ?? "cover"
    };
  }));
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  let collection = null;

  function isValidChest(chest) {
    if (chest === null) return true;
    if (!chest || typeof chest !== "object" || typeof chest.date !== "string") return false;
    if (chest.type === "card") {
      return typeof chest.cardId === "string" || GAMES.some(game => game.id === chest.gameId);
    }
    return chest.type === "coins" && Number.isSafeInteger(chest.amount) && chest.amount > 0;
  }

  function normalizeChest(chest) {
    if (chest?.type !== "card" || chest.cardId) return chest;
    return { ...chest, cardId: `${chest.gameId}-common`, rarity: "common" };
  }

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        !parsed ||
        !Number.isSafeInteger(parsed.coins) ||
        parsed.coins < 0 ||
        !parsed.cards ||
        typeof parsed.cards !== "object" ||
        Array.isArray(parsed.cards) ||
        !Object.values(parsed.cards).every(count => Number.isSafeInteger(count) && count >= 0) ||
        !isValidChest(parsed.lastChest ?? null)
      ) {
        throw new Error("Сохранённые данные коллекции имеют неверный формат.");
      }

      const normalizedCards = {};
      Object.entries(parsed.cards).forEach(([id, count]) => {
        const cardId = cards.some(card => card.id === id) || !GAMES.some(game => game.id === id)
          ? id
          : `${id}-common`;
        normalizedCards[cardId] = (normalizedCards[cardId] ?? 0) + count;
      });
      collection = {
        coins: parsed.coins,
        cards: normalizedCards,
        lastChest: normalizeChest(parsed.lastChest ?? null)
      };
    } else {
      collection = { coins: 0, cards: {}, lastChest: null };
    }
  } catch (error) {
    console.error("Не удалось загрузить коллекцию.", error);
    openChestButton.disabled = true;
    chestStatus.textContent = "Не удалось загрузить коллекцию. Проверь хранилище браузера.";
    collectionGrid.textContent = "Коллекция сейчас недоступна.";
  }

  if (collection) {
    let sortMode = "collection";
    function triggerCelebration(target) {
      target.classList.remove("celebrate");
      void target.offsetWidth;
      target.classList.add("celebrate");
      const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? 100 : 950;
      window.setTimeout(() => target.classList.remove("celebrate"), delay);
    }

    function renderCards(animateChanges = false) {
      const previousPositions = animateChanges
        ? new Map([...collectionGrid.querySelectorAll(".collectible-card")].map(card => [
          card.dataset.cardId,
          card.getBoundingClientRect()
        ]))
        : null;
      const gameOrder = new Map(GAMES.map((game, index) => [game.id, index]));
      const rarityOrder = new Map(rarities.map((rarity, index) => [rarity.id, index]));
      const sortedCards = [...cards].sort((a, b) => {
        const byGame = gameOrder.get(a.game.id) - gameOrder.get(b.game.id);
        const byRarity = rarityOrder.get(a.rarity.id) - rarityOrder.get(b.rarity.id);
        if (sortMode === "rarity") return byRarity || byGame;
        if (sortMode === "collected") {
          const aCollected = (collection.cards[a.id] ?? 0) > 0;
          const bCollected = (collection.cards[b.id] ?? 0) > 0;
          return Number(bCollected) - Number(aCollected) || byGame || byRarity;
        }
        return byGame || byRarity;
      });
      const collectedTypes = cards.filter(card => (collection.cards[card.id] ?? 0) > 0).length;
      collectionGrid.innerHTML = sortedCards.map(card => {
        const count = collection.cards[card.id] ?? 0;
        return `
          <button class="collectible-card rarity-${card.rarity.id} ${count > 0 ? "collected" : "locked"}" type="button" data-card-id="${card.id}" aria-label="Подробнее: ${card.name}, ${card.rarity.name}">
            <span class="collectible-art">
              <img class="${card.coverMode === "contain" ? "contain" : ""}" src="${card.cover}" alt="${count > 0 ? `${card.rarity.name} карточка: ${card.name}` : "Неоткрытая карточка"}" loading="lazy">
              ${count > 0 ? "" : '<span class="collectible-lock" aria-hidden="true">?</span>'}
            </span>
            <span class="collectible-info">
              <span class="collectible-text">
                <span class="collectible-name">${card.name}</span>
                <span class="collectible-game">${card.game.title}</span>
                <span class="rarity-tag">${card.rarity.name}</span>
              </span>
              <span class="collectible-count">${count > 0 ? `×${count}` : "—"}</span>
            </span>
          </button>`;
      }).join("");
      cardTotal.textContent = `Собрано ${collectedTypes} из ${cards.length}`;
      coinCount.textContent = collection.coins;
      const cardButtons = collectionGrid.querySelectorAll(".collectible-card");
      cardButtons.forEach(button => {
        button.addEventListener("click", () => openCardDetails(button.dataset.cardId));
      });

      if (previousPositions && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        cardButtons.forEach(button => {
          if (typeof button.animate !== "function") return;
          const previous = previousPositions.get(button.dataset.cardId);
          if (!previous) {
            button.animate(
              [{ opacity: 0, transform: "translateY(12px) scale(.97)" }, { opacity: 1, transform: "none" }],
              { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" }
            );
            return;
          }

          const current = button.getBoundingClientRect();
          const offsetX = previous.left - current.left;
          const offsetY = previous.top - current.top;
          if (offsetX || offsetY) {
            button.animate(
              [{ transform: `translate(${offsetX}px, ${offsetY}px)` }, { transform: "translate(0, 0)" }],
              { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" }
            );
          }
        });
      }
    }

    collectionSort?.querySelectorAll("[data-card-sort]").forEach(button => {
      button.addEventListener("click", () => {
        const nextSortMode = button.dataset.cardSort;
        if (!["collection", "rarity", "collected"].includes(nextSortMode) || nextSortMode === sortMode) return;
        sortMode = nextSortMode;

        collectionSort.querySelectorAll("[data-card-sort]").forEach(sortButton => {
          const isActive = sortButton === button;
          sortButton.classList.toggle("active", isActive);
          sortButton.setAttribute("aria-pressed", String(isActive));
        });
        renderCards(true);
      });
    });

    function renderCardDetails(card, message = "") {
      const count = collection.cards[card.id] ?? 0;
      const canAfford = collection.coins >= card.price;
      cardDialogContent.innerHTML = `
        <div class="card-detail rarity-${card.rarity.id}">
          <div class="card-detail-art">
            <img class="${card.coverMode === "contain" ? "contain" : ""}" src="${card.cover}" alt="${card.name}">
          </div>
          <div class="card-detail-copy">
            <span class="rarity-tag">${card.rarity.name}</span>
            <h2 id="card-dialog-title">${card.name}</h2>
            <p class="card-detail-game">${card.game.title}</p>
            <p class="card-description">${card.description}</p>
            <p class="card-owned-count">В коллекции: ×${count}</p>
            <div class="card-buy-panel">
              <div class="card-buy-price">
                <span>Цена карточки</span>
                <strong><span class="sg-bucks-mark small" aria-hidden="true">SG</span> ${card.price}</strong>
              </div>
              <button class="buy-card-button" id="buy-card" type="button" ${canAfford ? "" : "disabled"}>
                <span aria-hidden="true">🛒</span>
                <span>${canAfford ? `Купить${count > 0 ? " ещё" : ""} карточку` : "Не хватает SG-баксов"}</span>
              </button>
              <p class="purchase-status ${message.includes("успешно") ? "is-success" : ""}" id="purchase-status" aria-live="polite">${message || (canAfford ? "" : `Не хватает ${card.price - collection.coins} SG-баксов.`)}</p>
            </div>
          </div>
        </div>`;
      cardDialogContent.querySelector("#buy-card").addEventListener("click", () => buyCard(card));
    }

    function openCardDetails(cardId) {
      const card = cards.find(item => item.id === cardId);
      if (!card) return;
      renderCardDetails(card);
      cardDialog.showModal();
    }

    function buyCard(card) {
      if (collection.coins < card.price) {
        renderCardDetails(card, `Не хватает ${card.price - collection.coins} SG-баксов.`);
        return;
      }

      const nextCollection = {
        ...collection,
        coins: collection.coins - card.price,
        cards: { ...collection.cards, [card.id]: (collection.cards[card.id] ?? 0) + 1 }
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextCollection));
      } catch (error) {
        console.error("Не удалось купить карточку.", error);
        renderCardDetails(card, "Не удалось сохранить покупку. Проверь хранилище браузера.");
        return;
      }

      collection = nextCollection;
      renderCards();
      renderCardDetails(card, `Покупка прошла успешно. Теперь у тебя ×${collection.cards[card.id]}.`);
      triggerCelebration(cardDialogContent.querySelector(".card-buy-panel"));
    }

    document.querySelector("#card-dialog-close").addEventListener("click", () => cardDialog.close());
    cardDialog.addEventListener("click", event => {
      if (event.target === cardDialog) cardDialog.close();
    });

    function renderFlippingReward(frontContent, mysteryContent, revealedContent, onReveal, rarityClass = "") {
      chestResult.innerHTML = `
        <div class="reward-reveal ${rarityClass}">
          <div class="reward-card-stage is-shaking">
            <div class="reward-card-inner">
              <div class="reward-card-face reward-card-back" aria-hidden="true">
                <span class="reward-card-back-mark">?</span>
                <span class="reward-card-back-label">SG GAMES</span>
              </div>
              <div class="reward-card-face reward-card-front ${rarityClass}" id="reward-card-front" aria-hidden="true">
                ${frontContent}
              </div>
            </div>
          </div>
          <div class="reward-card-copy" id="reward-card-copy" aria-live="polite">
            ${mysteryContent}
          </div>
        </div>`;

      const stage = chestResult.querySelector(".reward-card-stage");
      const front = chestResult.querySelector("#reward-card-front");
      const copy = chestResult.querySelector("#reward-card-copy");
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      window.setTimeout(() => {
        stage.classList.remove("is-shaking");
        stage.classList.add("is-flipping");
        front.setAttribute("aria-hidden", "false");
        copy.innerHTML = revealedContent;
        copy.classList.add("is-revealing");
        window.setTimeout(() => {
          stage.classList.remove("is-flipping");
          stage.classList.add("is-revealed");
          copy.classList.remove("is-revealing");
          onReveal();
        }, reducedMotion ? 50 : 750);
      }, reducedMotion ? 50 : 1800);
    }

    function renderReward(reward, animateCard = false, onReveal = () => {}) {
      if (reward.type === "card") {
        const cardId = reward.cardId ?? `${reward.gameId}-${reward.rarity ?? "common"}`;
        const card = cards.find(item => item.id === cardId);
        if (!card) {
          chestResult.innerHTML = '<p class="reward-note">Награда уже получена, но карточка больше недоступна.</p>';
          onReveal();
          return;
        }

        const count = collection.cards[card.id] ?? 0;
        const note = count > 1 ? `Дубликат! Теперь в коллекции ×${count}.` : "Карточка добавлена в коллекцию.";
        if (animateCard) {
          renderFlippingReward(
            `<img class="${card.coverMode === "contain" ? "contain" : ""}" src="${card.cover}" alt="">
             <span class="rarity-tag">${card.rarity.name}</span>`,
            "<p>Выпала карточка...</p><h3>Что же внутри?</h3><p>Она дрожит и скоро откроется.</p>",
            `
              <p>Ты нашёл карточку</p>
              <h3>${card.name}</h3>
              <p>${card.game.title}</p>
              <span class="rarity-tag">${card.rarity.name}</span>
              <p class="reward-note">${note}</p>`,
            onReveal,
            `rarity-${card.rarity.id}`
          );
          return;
        }

        chestResult.innerHTML = `
          <div class="reward-reveal rarity-${card.rarity.id}">
            <div class="reward-art rarity-${card.rarity.id}">
              <img class="${card.coverMode === "contain" ? "contain" : ""}" src="${card.cover}" alt="">
            </div>
            <div>
              <p>Ты нашёл карточку</p>
              <h3>${card.name}</h3>
              <p>${card.game.title}</p>
              <span class="rarity-tag">${card.rarity.name}</span>
              <p class="reward-note">${note}</p>
            </div>
          </div>`;
      } else {
        if (animateCard) {
          renderFlippingReward(
            `<div class="coin-card-coin" aria-hidden="true">SG</div>
             <span class="coin-card-amount">+${reward.amount}</span>
             <span class="coin-card-label">SG-БАКСОВ</span>`,
            "<p>Выпала награда...</p><h3>Сколько SG-баксов?</h3><p>Сундук пока хранит секрет.</p>",
            `
              <p>В сундуке SG-баксы!</p>
              <h3>+${reward.amount} SG-баксов</h3>
              <p class="reward-note">Баланс: ${collection.coins} SG-баксов. Их можно потратить на карточки.</p>`,
            onReveal,
            "coin-card"
          );
          return;
        }

        chestResult.innerHTML = `
          <div class="reward-reveal">
            <span class="reward-coin" aria-hidden="true">SG</span>
            <div>
              <p>В сундуке SG-баксы!</p>
              <h3>+${reward.amount} SG-баксов</h3>
              <p class="reward-note">Баланс: ${collection.coins} SG-баксов. Их можно потратить на карточки.</p>
            </div>
          </div>`;
      }
    }

    function showDailyReward() {
      const reward = collection.lastChest;
      if (reward?.date !== todayKey) return;

      openChestButton.disabled = true;
      chestStatus.textContent = "Сундук открыт";
      chestStatus.classList.add("is-open");
      chestScene.classList.remove("is-opening");
      chestScene.classList.add("is-open");
      renderReward(reward);
    }

    renderCards();
    showDailyReward();

    openChestButton.addEventListener("click", () => {
      if (collection.lastChest?.date === todayKey) return;

      let reward;
      const rewardRoll = Math.random() * 100;
      if (GAMES.length > 0 && rewardRoll < 60) {
        const game = GAMES[Math.floor(Math.random() * GAMES.length)];
        const rarity = rewardRoll < 30 ? rarities[0] : rewardRoll < 50 ? rarities[1] : rarities[2];
        reward = { date: todayKey, type: "card", gameId: game.id, cardId: `${game.id}-${rarity.id}`, rarity: rarity.id };
      } else {
        reward = { date: todayKey, type: "coins", amount: Math.floor(Math.random() * 21) + 10 };
      }

      const nextCollection = {
        coins: collection.coins + (reward.type === "coins" ? reward.amount : 0),
        cards: reward.type === "card"
          ? { ...collection.cards, [reward.cardId]: (collection.cards[reward.cardId] ?? 0) + 1 }
          : collection.cards,
        lastChest: reward
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(nextCollection));
      } catch (error) {
        console.error("Не удалось сохранить награду сундука.", error);
        chestStatus.textContent = "Не удалось сохранить награду. Проверь хранилище браузера и попробуй снова.";
        return;
      }

      collection = nextCollection;
      openChestButton.disabled = true;
      chestResult.replaceChildren();
      chestStatus.textContent = "Сундук дрожит и открывается...";
      chestStatus.classList.remove("is-open");
      chestScene.classList.remove("is-open");
      chestScene.classList.add("is-opening");
      triggerCelebration(chestScene);
      const animationDelay = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? 50 : 1100;
      window.setTimeout(() => {
        chestScene.classList.remove("is-opening");
        chestScene.classList.add("is-open");
        chestStatus.textContent = "Сундук открыт";
        chestStatus.classList.add("is-open");
        renderReward(reward, true, () => {
          renderCards();
        });
      }, animationDelay);
    });
  }
}
