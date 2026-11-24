const profileGate = document.querySelector("#profile-gate");
const profileGateMessage = document.querySelector("#profile-gate-message");
const profileOpenAccount = document.querySelector("#profile-open-account");
const profileContent = document.querySelector("#profile-content");
const profileStatus = document.querySelector("#profile-status");
const profileAvatar = document.querySelector("#profile-avatar");
const profileNickname = document.querySelector("#profile-nickname");
const profileCoins = document.querySelector("#profile-coins");
const profileCardTotal = document.querySelector("#profile-card-total");
const profileCardEmpty = document.querySelector("#profile-card-empty");
const profileCardGrid = document.querySelector("#profile-card-grid");
const profileSignout = document.querySelector("#profile-signout");
const profileNicknameForm = document.querySelector("#profile-nickname-form");
const profileNicknameInput = document.querySelector("#profile-nickname-input");
const profileNicknameMessage = document.querySelector("#profile-nickname-message");
const accountDialog = document.querySelector("#account-dialog");
const accountForm = document.querySelector("#account-form");
const accountMessage = document.querySelector("#account-message");
const accountSubmit = document.querySelector("#account-submit");
const accountModeToggle = document.querySelector("#account-mode-toggle");
const accountNicknameField = document.querySelector("#account-nickname-field");
const accountNicknameInput = document.querySelector("#account-form-nickname");
const supabaseClient = window.supabase && window.SG_SUPABASE_CONFIG
  ? window.supabase.createClient(
    window.SG_SUPABASE_CONFIG.url,
    window.SG_SUPABASE_CONFIG.publishableKey
  )
  : null;

const rarityNames = { common: "Обычная", rare: "Редкая", legendary: "Легендарная" };
const profileCards = GAMES.flatMap(game => (game.collectibleCards ?? []).map(card => ({
  ...card,
  id: `${game.id}-${card.rarity}`,
  game,
  coverMode: card.coverMode ?? game.coverMode ?? "cover"
})));
let session = null;
let authMode = "signin";

function setAccountMessage(message, isError = false) {
  accountMessage.textContent = message;
  accountMessage.classList.toggle("is-error", isError);
}

function setAuthMode(mode) {
  authMode = mode;
  accountSubmit.textContent = mode === "signup" ? "Создать аккаунт" : "Войти";
  accountModeToggle.textContent = mode === "signup" ? "Уже есть аккаунт? Войти" : "Создать аккаунт";
  document.querySelector("#account-form-password").autocomplete = mode === "signup" ? "new-password" : "current-password";
  accountNicknameField.hidden = mode !== "signup";
  accountNicknameInput.required = mode === "signup";
  setAccountMessage("");
}

function openAccountDialog() {
  setAuthMode("signin");
  if (!accountDialog.open) accountDialog.showModal();
  document.querySelector("#account-form-email").focus();
}

function renderOwnedCards(cards) {
  const ownedCards = profileCards.filter(card => (cards[card.id] ?? 0) > 0);
  profileCardTotal.textContent = String(ownedCards.length);
  profileCardEmpty.hidden = ownedCards.length > 0;
  profileCardGrid.innerHTML = ownedCards.map(card => `
    <article class="collectible-card collected rarity-${card.rarity}">
      <span class="collectible-art">
        <img class="${card.coverMode === "contain" ? "contain" : ""}" src="${card.cover}" alt="${card.name}" loading="lazy">
      </span>
      <span class="collectible-info">
        <span class="collectible-text">
          <span class="collectible-name">${card.name}</span>
          <span class="collectible-game">${card.game.title}</span>
          <span class="rarity-tag">${rarityNames[card.rarity] ?? "Карточка"}</span>
        </span>
        <span class="collectible-count">×${cards[card.id]}</span>
      </span>
    </article>
  `).join("");
}

async function loadProfile(nextSession) {
  session = nextSession;
  if (!nextSession) {
    profileContent.hidden = true;
    profileGate.hidden = false;
    profileGateMessage.textContent = "Войди или создай аккаунт, чтобы увидеть ник, баланс и собранные карточки.";
    profileOpenAccount.hidden = false;
    return;
  }

  profileGate.hidden = true;
  profileContent.hidden = false;
  profileStatus.textContent = "Загружаю профиль...";
  profileSignout.disabled = true;

  try {
    const { data, error } = await supabaseClient
      .from("sg_game_profiles")
      .select("nickname,nickname_claimed,coins,cards")
      .eq("id", nextSession.user.id)
      .single();
    if (error) throw error;
    if (session?.user.id !== nextSession.user.id) return;

    if (
      typeof data.nickname !== "string" ||
      !data.nickname ||
      typeof data.nickname_claimed !== "boolean" ||
      !Number.isSafeInteger(data.coins) ||
      data.coins < 0 ||
      !data.cards ||
      typeof data.cards !== "object" ||
      Array.isArray(data.cards) ||
      !Object.values(data.cards).every(count => Number.isSafeInteger(count) && count >= 0)
    ) {
      throw new Error("Профиль содержит некорректные данные. Проверь миграции базы аккаунтов.");
    }

    profileNickname.textContent = data.nickname;
    profileNicknameForm.hidden = data.nickname_claimed;
    profileAvatar.textContent = Array.from(data.nickname)[0].toLocaleUpperCase("ru");
    profileAvatar.style.setProperty("--avatar-hue", String(data.nickname.codePointAt(0) % 360));
    profileAvatar.setAttribute("aria-label", `Аватар ${data.nickname}`);
    profileCoins.textContent = data.coins.toLocaleString("ru-RU");
    renderOwnedCards(data.cards);
    profileStatus.textContent = "";
    profileSignout.disabled = false;
    if (accountDialog.open) accountDialog.close();
  } catch (error) {
    console.error("Не удалось загрузить профиль.", error);
    profileStatus.textContent = "Не удалось загрузить профиль. Проверь подключение и выполни миграции базы аккаунтов.";
    profileSignout.disabled = false;
  }
}

profileOpenAccount.addEventListener("click", openAccountDialog);
profileSignout.addEventListener("click", async () => {
  profileSignout.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error("Не удалось выйти из аккаунта.", error);
    profileStatus.textContent = "Не удалось выйти. Попробуй ещё раз.";
    profileSignout.disabled = false;
  }
});

profileNicknameForm.addEventListener("submit", async event => {
  event.preventDefault();
  const nickname = window.SGAccountRules.normalizeNickname(profileNicknameInput.value);
  const validationMessage = window.SGAccountRules.validateNickname(nickname);
  if (validationMessage) {
    profileNicknameMessage.textContent = validationMessage;
    profileNicknameMessage.classList.add("is-error");
    return;
  }

  const submitButton = profileNicknameForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  profileNicknameMessage.classList.remove("is-error");
  profileNicknameMessage.textContent = "Закрепляю ник...";
  try {
    const { error } = await supabaseClient.rpc("set_sg_game_nickname", { p_nickname: nickname });
    if (error) throw error;
    await loadProfile(session);
    if (profileNicknameForm.hidden) {
      profileStatus.textContent = "Ник закреплён. Изменить его больше нельзя.";
    }
  } catch (error) {
    console.error("Не удалось закрепить ник.", error);
    const messages = {
      nickname_taken: "Этот ник уже занят. Попробуй другой.",
      nickname_invalid: "Этот ник не подходит. Выбери другой.",
      nickname_already_set: "Ник уже закреплён и не может быть изменён."
    };
    profileNicknameMessage.textContent = messages[error.message] || "Не удалось закрепить ник. Проверь подключение и попробуй снова.";
    profileNicknameMessage.classList.add("is-error");
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#account-dialog-close").addEventListener("click", () => accountDialog.close());
accountDialog.addEventListener("click", event => {
  if (event.target === accountDialog) accountDialog.close();
});
accountModeToggle.addEventListener("click", () => {
  setAuthMode(authMode === "signin" ? "signup" : "signin");
});
accountForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!supabaseClient) {
    setAccountMessage("Не удалось подключиться к сервису аккаунтов.", true);
    return;
  }

  const email = document.querySelector("#account-form-email").value.trim();
  const password = document.querySelector("#account-form-password").value;
  const nickname = window.SGAccountRules.normalizeNickname(accountNicknameInput.value);
  if (authMode === "signup") {
    const nicknameError = window.SGAccountRules.validateNickname(nickname);
    if (nicknameError) {
      setAccountMessage(nicknameError, true);
      return;
    }
  }

  accountSubmit.disabled = true;
  accountModeToggle.disabled = true;
  setAccountMessage(authMode === "signup" ? "Создаю аккаунт..." : "Выполняю вход...");
  try {
    const result = authMode === "signup"
      ? await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { nickname },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`
        }
      })
      : await supabaseClient.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (authMode === "signup" && !result.data.session) {
      accountForm.reset();
      setAccountMessage("Проверь почту и подтверди адрес, затем войди в аккаунт.");
    } else {
      setAccountMessage("Вход выполнен. Загружаю профиль...");
    }
  } catch (error) {
    console.error("Не удалось выполнить действие с аккаунтом.", error);
    const message = /nickname_(taken|invalid)|duplicate key|unique constraint/i.test(error.message || "")
      ? "Этот ник уже занят или не подходит. Попробуй другой."
      : /database error saving new user/i.test(error.message || "")
        ? "Не удалось создать аккаунт. Ник может быть занят или миграция профиля ещё не настроена."
        : error.message || "Произошла ошибка. Попробуй ещё раз.";
    setAccountMessage(message, true);
  } finally {
    accountSubmit.disabled = false;
    accountModeToggle.disabled = false;
  }
});

if (!supabaseClient) {
  profileGateMessage.textContent = "Сервис аккаунтов ещё не настроен.";
  profileOpenAccount.disabled = true;
} else {
  supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
    window.setTimeout(() => loadProfile(nextSession), 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    return loadProfile(data.session);
  }).catch(error => {
    console.error("Не удалось проверить вход.", error);
    profileGateMessage.textContent = "Не удалось проверить вход. Обнови страницу.";
  });
}
