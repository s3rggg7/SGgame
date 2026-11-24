const collectionGrid = document.querySelector("#card-grid");
const openChestButton = document.querySelector("#open-chest");
const cardDialog = document.querySelector("#card-dialog");
const cardDialogContent = document.querySelector("#card-dialog-content");
const collectionSort = document.querySelector(".collection-sort");
const accountDialog = document.querySelector("#account-dialog");
const accountForm = document.querySelector("#account-form");
const accountMessage = document.querySelector("#account-message");
const accountSubmit = document.querySelector("#account-submit");
const accountModeToggle = document.querySelector("#account-mode-toggle");
const accountOpenButton = document.querySelector("#account-open");
const accountSignoutButton = document.querySelector("#account-signout");
const accountEmail = document.querySelector("#account-email");
const supabaseClient = window.supabase && window.SG_SUPABASE_CONFIG
  ? window.supabase.createClient(
    window.SG_SUPABASE_CONFIG.url,
    window.SG_SUPABASE_CONFIG.publishableKey
  )
  : null;

if (collectionGrid && openChestButton) {
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
  const todayKey = today.toISOString().slice(0, 10);
  let collection = { coins: 0, cards: {}, lastChest: null };
  let session = null;
  let profileReady = false;
  let pendingChestOpen = false;
  let authMode = "signin";

  {
    let sortMode = "collection";

    function setAccountMessage(message, isError = false) {
      accountMessage.textContent = message;
      accountMessage.classList.toggle("is-error", isError);
    }

    function setAuthMode(mode) {
      authMode = mode;
      accountSubmit.textContent = mode === "signup" ? "Создать аккаунт" : "Войти";
      accountModeToggle.textContent = mode === "signup" ? "Уже есть аккаунт? Войти" : "Создать аккаунт";
      document.querySelector("#account-form-password").autocomplete = mode === "signup" ? "new-password" : "current-password";
      setAccountMessage("");
    }

    function openAccountDialog(message = "Войди или создай аккаунт, чтобы открыть сундук.") {
      setAuthMode("signin");
      setAccountMessage(message);
      if (!accountDialog.open) accountDialog.showModal();
      document.querySelector("#account-form-email").focus();
    }

    function resetGuestCollection() {
      collection = { coins: 0, cards: {}, lastChest: null };
      profileReady = false;
      renderCards();
      openChestButton.disabled = false;
      chestStatus.classList.remove("is-open");
      chestStatus.textContent = "Войди или создай аккаунт, чтобы открыть сундук.";
      chestResult.replaceChildren();
      chestScene.classList.remove("is-open", "is-opening");
    }

    async function loadAccountCollection(nextSession) {
      session = nextSession;
      profileReady = false;
      accountEmail.textContent = nextSession?.user.email ?? "Гость";
      accountOpenButton.hidden = Boolean(nextSession);
      accountSignoutButton.hidden = !nextSession;

      if (!nextSession) {
        resetGuestCollection();
        return;
      }

      collection = { coins: 0, cards: {}, lastChest: null };
      renderCards();
      chestResult.replaceChildren();
      chestScene.classList.remove("is-open", "is-opening");
      openChestButton.disabled = true;
      chestStatus.classList.remove("is-open");
      chestStatus.textContent = "Загружаю коллекцию аккаунта...";
      let data;
      let error;
      try {
        ({ data, error } = await supabaseClient
          .from("sg_game_profiles")
          .select("coins,cards,last_chest")
          .eq("id", nextSession.user.id)
          .single());
      } catch (requestError) {
        console.error("Не удалось загрузить коллекцию аккаунта.", requestError);
        chestStatus.textContent = "Не удалось связаться с сервером. Проверь интернет и попробуй снова.";
        setAccountMessage("Не удалось загрузить коллекцию. Проверь подключение и настройки Supabase.", true);
        return;
      }
      if (session?.user.id !== nextSession.user.id) return;
      if (error) {
        console.error("Не удалось загрузить коллекцию аккаунта.", error);
        chestStatus.textContent = "Не удалось загрузить прогресс. Проверь настройку базы аккаунтов.";
        setAccountMessage("База аккаунтов ещё не настроена. Выполни SQL-файл из папки supabase.", true);
        return;
      }
      if (
        !Number.isSafeInteger(data.coins) ||
        data.coins < 0 ||
        !data.cards ||
        typeof data.cards !== "object" ||
        Array.isArray(data.cards) ||
        !Object.values(data.cards).every(count => Number.isSafeInteger(count) && count >= 0)
      ) {
        console.error("Профиль аккаунта содержит некорректные данные.");
        chestStatus.textContent = "В профиле обнаружены некорректные данные коллекции.";
        return;
      }

      collection = { coins: data.coins, cards: data.cards, lastChest: data.last_chest };
      profileReady = true;
      renderCards();
      showDailyReward();
      if (collection.lastChest?.date !== todayKey) {
        openChestButton.disabled = false;
        chestStatus.classList.remove("is-open");
        chestStatus.textContent = "Можно открыть один сундук сегодня.";
      }
      if (accountDialog.open) accountDialog.close();
      if (pendingChestOpen) {
        pendingChestOpen = false;
        await openDailyChest();
      }
    }

    function handleAuthError(error) {
      const knownMessages = {
        daily_chest_already_opened: "Сундук уже открыт сегодня.",
        authentication_required: "Войди в аккаунт, чтобы продолжить.",
        profile_not_found: "Профиль не найден. Попробуй выйти и войти снова.",
        invalid_card: "Эта карточка больше недоступна.",
        not_enough_sg_bucks: "Не хватает SG-баксов."
      };
      if (error instanceof TypeError) return "Не удалось связаться с сервером. Проверь интернет и попробуй снова.";
      return knownMessages[error.message] || error.message || "Произошла ошибка. Попробуй ещё раз.";
    }

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
      const needsLogin = !session;
      const loadingProfile = Boolean(session) && !profileReady;
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
              <button class="buy-card-button" id="buy-card" type="button" ${loadingProfile || (session && !canAfford) ? "disabled" : ""}>
                <span aria-hidden="true">🛒</span>
                <span>${needsLogin ? "Войти, чтобы купить" : loadingProfile ? "Загрузка баланса..." : canAfford ? `Купить${count > 0 ? " ещё" : ""} карточку` : "Не хватает SG-баксов"}</span>
              </button>
              <p class="purchase-status ${message.includes("успешно") ? "is-success" : ""}" id="purchase-status" aria-live="polite">${message || (needsLogin ? "Войди в аккаунт, чтобы покупать карточки." : loadingProfile || canAfford ? "" : `Не хватает ${card.price - collection.coins} SG-баксов.`)}</p>
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

    async function buyCard(card) {
      if (!session) {
        openAccountDialog("Войди или создай аккаунт, чтобы покупать карточки.");
        return;
      }
      if (!profileReady) {
        renderCardDetails(card, "Подожди, пока загрузится коллекция аккаунта.");
        return;
      }
      if (collection.coins < card.price) {
        renderCardDetails(card, `Не хватает ${card.price - collection.coins} SG-баксов.`);
        return;
      }

      const buyButton = cardDialogContent.querySelector("#buy-card");
      buyButton.disabled = true;
      try {
        const { data, error } = await supabaseClient.rpc("buy_sg_game_card", { p_card_id: card.id });
        if (error) throw error;

        collection = { coins: data.coins, cards: data.cards, lastChest: data.last_chest };
        renderCards();
        renderCardDetails(card, `Покупка прошла успешно. Теперь у тебя ×${collection.cards[card.id]}.`);
        triggerCelebration(cardDialogContent.querySelector(".card-buy-panel"));
      } catch (error) {
        console.error("Не удалось купить карточку.", error);
        renderCardDetails(card, handleAuthError(error));
      }
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

    async function openDailyChest() {
      if (!session) {
        pendingChestOpen = true;
        openAccountDialog();
        return;
      }
      if (!profileReady) {
        chestStatus.textContent = "Коллекция аккаунта ещё загружается.";
        return;
      }
      if (collection.lastChest?.date === todayKey) return;

      openChestButton.disabled = true;
      try {
        const { data, error } = await supabaseClient.rpc("open_daily_chest");
        if (error) throw error;

        const reward = data.reward;
        collection = { coins: data.coins, cards: data.cards, lastChest: data.last_chest };
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
      } catch (error) {
        console.error("Не удалось открыть сундук.", error);
        chestStatus.textContent = handleAuthError(error);
        openChestButton.disabled = false;
      }
    }

    accountOpenButton.addEventListener("click", () => openAccountDialog());
    accountSignoutButton.addEventListener("click", async () => {
      accountSignoutButton.disabled = true;
      try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
      } catch (error) {
        console.error("Не удалось выйти из аккаунта.", error);
        chestStatus.textContent = handleAuthError(error);
      } finally {
        accountSignoutButton.disabled = false;
      }
    });
    accountModeToggle.addEventListener("click", () => {
      setAuthMode(authMode === "signin" ? "signup" : "signin");
    });
    document.querySelector("#account-dialog-close").addEventListener("click", () => {
      accountDialog.close();
      pendingChestOpen = false;
    });
    accountDialog.addEventListener("click", event => {
      if (event.target === accountDialog) {
        accountDialog.close();
        pendingChestOpen = false;
      }
    });
    accountForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!supabaseClient) {
        setAccountMessage("Не удалось подключиться к сервису аккаунтов.", true);
        return;
      }

      accountSubmit.disabled = true;
      accountModeToggle.disabled = true;
      setAccountMessage(authMode === "signup" ? "Создаю аккаунт..." : "Выполняю вход...");
      const email = document.querySelector("#account-form-email").value.trim();
      const password = document.querySelector("#account-form-password").value;
      try {
        const result = authMode === "signup"
          ? await supabaseClient.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
          })
          : await supabaseClient.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        if (authMode === "signup" && !result.data.session) {
          accountForm.reset();
          setAccountMessage("Проверь почту и подтверди адрес, затем войди в аккаунт.");
        } else {
          setAccountMessage("Вход выполнен. Загружаю коллекцию...");
        }
      } catch (error) {
        console.error("Не удалось выполнить действие с аккаунтом.", error);
        setAccountMessage(handleAuthError(error), true);
      } finally {
        accountSubmit.disabled = false;
        accountModeToggle.disabled = false;
      }
    });
    openChestButton.addEventListener("click", openDailyChest);

    if (!supabaseClient) {
      openChestButton.disabled = true;
      chestStatus.textContent = "Сервис аккаунтов не настроен.";
      setAccountMessage("Не удалось подключиться к сервису аккаунтов.", true);
      accountOpenButton.disabled = true;
    } else {
      supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
        window.setTimeout(() => loadAccountCollection(nextSession), 0);
      });
      supabaseClient.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.error("Не удалось проверить сессию аккаунта.", error);
          chestStatus.textContent = "Не удалось проверить вход. Обнови страницу.";
          openChestButton.disabled = true;
          return;
        }
        return loadAccountCollection(data.session);
      }).catch(error => {
        console.error("Не удалось загрузить сессию аккаунта.", error);
        chestStatus.textContent = "Не удалось загрузить аккаунт. Обнови страницу.";
        openChestButton.disabled = true;
      });
    }
  }
}
