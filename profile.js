const profileGate = document.querySelector("#profile-gate");
const profileGateMessage = document.querySelector("#profile-gate-message");
const profileOpenAccount = document.querySelector("#profile-open-account");
const profileContent = document.querySelector("#profile-content");
const profileStatus = document.querySelector("#profile-status");
const profileAvatar = document.querySelector("#profile-avatar");
const profileAvatarLetter = document.querySelector("#profile-avatar-letter");
const profileAvatarImage = document.querySelector("#profile-avatar-image");
const profileAvatarInput = document.querySelector("#profile-avatar-input");
const profileAvatarChoose = document.querySelector("#profile-avatar-choose");
const profileAvatarRemove = document.querySelector("#profile-avatar-remove");
const profileAvatarStatus = document.querySelector("#profile-avatar-status");
const profileNickname = document.querySelector("#profile-nickname");
const profileCoins = document.querySelector("#profile-coins");
const profileCardTotal = document.querySelector("#profile-card-total");
const profileCardEmpty = document.querySelector("#profile-card-empty");
const profileCardGrid = document.querySelector("#profile-card-grid");
const profileSignout = document.querySelector("#profile-signout");
const profilePasswordReset = document.querySelector("#profile-password-reset");
const profilePasswordStatus = document.querySelector("#profile-password-status");
const profileDeleteAccount = document.querySelector("#profile-delete-account");
const profileNicknameForm = document.querySelector("#profile-nickname-form");
const profileNicknameInput = document.querySelector("#profile-nickname-input");
const profileNicknameMessage = document.querySelector("#profile-nickname-message");
const accountDialog = document.querySelector("#account-dialog");
const deleteAccountDialog = document.querySelector("#delete-account-dialog");
const deleteAccountForm = document.querySelector("#delete-account-form");
const deleteAccountPassword = document.querySelector("#delete-account-password");
const deleteAccountConfirmation = document.querySelector("#delete-account-confirmation");
const deleteAccountSubmit = document.querySelector("#delete-account-submit");
const deleteAccountCancel = document.querySelector("#delete-account-cancel");
const deleteAccountClose = document.querySelector("#delete-account-close");
const deleteAccountMessage = document.querySelector("#delete-account-message");
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
let currentAvatarPath = null;
const avatarBucket = "sg-game-avatars";
const maxAvatarSize = 2 * 1024 * 1024;
const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const accountAuth = window.SGAccountAuth.initialize(supabaseClient);
const publicNickname = new URLSearchParams(window.location.search).get("nickname")?.trim();
const isPublicProfile = Boolean(publicNickname);

function setPublicProfileMode(enabled) {
  document.body.classList.toggle("public-profile", enabled);
  const subtitle = document.querySelector(".profile-subtitle");
  const avatarActions = document.querySelector(".profile-avatar-actions");
  const summaryActions = document.querySelector(".profile-summary-actions");
  const nicknameForm = document.querySelector("#profile-nickname-form");
  const stats = document.querySelector(".profile-stats");
  const cards = document.querySelector(".profile-cards");
  const profilePasswordStatus = document.querySelector("#profile-password-status");

  if (subtitle) subtitle.textContent = enabled ? "Публичный профиль игрока" : "Ник можно менять, если новый свободен.";
  if (avatarActions) avatarActions.hidden = enabled;
  if (summaryActions) summaryActions.hidden = enabled;
  if (nicknameForm) nicknameForm.hidden = enabled;
  if (stats) stats.hidden = !enabled;
  if (cards) cards.hidden = !enabled;
  if (profilePasswordStatus) profilePasswordStatus.hidden = enabled;

  if (enabled) {
    profileAvatarChoose.disabled = true;
    profileAvatarRemove.disabled = true;
    profileNicknameInput.disabled = true;
    profileSignout.disabled = true;
    profilePasswordReset.disabled = true;
    profileDeleteAccount.disabled = true;
  }
}

async function loadPublicProfile(nickname) {
  session = null;
  setPublicProfileMode(true);
  profileGate.hidden = true;
  profileContent.hidden = false;
  profileStatus.textContent = "Загружаю профиль...";

  try {
    const { data, error } = await supabaseClient.rpc("get_sg_game_public_profile", {
      p_nickname: nickname
    });
    if (error) throw error;
    if (!data) {
      profileContent.hidden = true;
      profileGate.hidden = false;
      profileGateMessage.textContent = "Профиль с таким ником не найден.";
      profileOpenAccount.hidden = true;
      profileStatus.textContent = "";
      return;
    }

    profileNickname.replaceChildren(document.createTextNode(data.nickname));
    if (data.creator_verified === true) {
      const creatorBadge = document.createElement("span");
      creatorBadge.className = "creator-badge";
      creatorBadge.tabIndex = 0;
      creatorBadge.setAttribute("role", "img");
      creatorBadge.setAttribute("aria-label", "Этот человек является создателем SG Games");
      creatorBadge.setAttribute("title", "Этот человек является создателем SG Games");
      creatorBadge.setAttribute("data-tooltip", "Этот человек является создателем SG Games");
      creatorBadge.textContent = "✓";
      profileNickname.append(creatorBadge);
    }

    profileAvatarLetter.textContent = Array.from(data.nickname)[0].toLocaleUpperCase("ru");
    profileAvatarLetter.hidden = Boolean(data.avatar_path);
    profileAvatarImage.hidden = true;
    profileAvatarImage.removeAttribute("src");
    profileAvatar.style.setProperty("--avatar-hue", String(data.nickname.codePointAt(0) % 360));
    profileAvatar.setAttribute("aria-label", `Аватар ${data.nickname}`);
    currentAvatarPath = data.avatar_path;

    if (data.avatar_path) {
      const publicUrl = supabaseClient.storage
        .from(avatarBucket)
        .getPublicUrl(data.avatar_path).data.publicUrl;
      profileAvatarImage.src = publicUrl;
      try {
        await profileAvatarImage.decode();
        profileAvatarImage.hidden = false;
        profileAvatarLetter.hidden = true;
      } catch (error) {
        profileAvatarLetter.hidden = false;
        profileAvatarStatus.textContent = "Не удалось загрузить аватар.";
      }
    }
    if (Number.isSafeInteger(data.coins) && data.coins >= 0) {
      profileCoins.textContent = data.coins.toLocaleString("ru-RU");
    } else {
      profileCoins.textContent = "0";
    }
    renderOwnedCards(
      data.cards &&
      typeof data.cards === "object" &&
      !Array.isArray(data.cards)
        ? data.cards
        : {}
    );
    const cardsTitle = document.querySelector("#profile-cards-title");
    if (cardsTitle) cardsTitle.textContent = "Собранные карточки";
    const cardsCollectionLink = document.querySelector(".profile-cards .text-link");
    if (cardsCollectionLink) cardsCollectionLink.hidden = true;
    profileStatus.textContent = "";
  } catch (error) {
    console.error("Не удалось загрузить публичный профиль.", error);
    profileContent.hidden = true;
    profileGate.hidden = false;
    profileGateMessage.textContent = "Не удалось загрузить публичный профиль. Выполни миграцию публичных профилей.";
    profileOpenAccount.hidden = true;
  }
}

function openAccountDialog() {
  accountAuth.open("signin");
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

async function prepareAvatar(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("avatar_canvas_unavailable");

    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);

    const optimizedAvatar = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/webp", 0.82);
    });
    if (!optimizedAvatar) throw new Error("avatar_processing_failed");
    return optimizedAvatar;
  } finally {
    bitmap.close();
  }
}

async function loadProfile(nextSession) {
  session = nextSession;
  if (!nextSession) {
    profileContent.hidden = true;
    profileGate.hidden = false;
    profileGateMessage.textContent = "Войди или создай аккаунт, чтобы увидеть ник, баланс и собранные карточки.";
    profileOpenAccount.hidden = false;
    currentAvatarPath = null;
    profileAvatarImage.removeAttribute("src");
    profileAvatarStatus.textContent = "";
    return;
  }

  profileGate.hidden = true;
  profileContent.hidden = false;
  profileStatus.textContent = "Загружаю профиль...";
  profileSignout.disabled = true;

  try {
    const { data, error } = await supabaseClient
      .from("sg_game_profiles")
      .select("nickname,coins,cards,avatar_path,creator_verified")
      .eq("id", nextSession.user.id)
      .single();
    if (error) throw error;
    if (session?.user.id !== nextSession.user.id) return;

    if (
      typeof data.nickname !== "string" ||
      !data.nickname ||
      !Number.isSafeInteger(data.coins) ||
      data.coins < 0 ||
      !data.cards ||
      typeof data.cards !== "object" ||
      Array.isArray(data.cards) ||
      !Object.values(data.cards).every(count => Number.isSafeInteger(count) && count >= 0) ||
      (data.avatar_path !== null && data.avatar_path !== `${nextSession.user.id}/avatar`)
    ) {
      throw new Error("Профиль содержит некорректные данные. Проверь миграции базы аккаунтов.");
    }

    profileNickname.replaceChildren(document.createTextNode(data.nickname));
    if (data.creator_verified === true) {
      const creatorBadge = document.createElement("span");
      creatorBadge.className = "creator-badge";
      creatorBadge.tabIndex = 0;
      creatorBadge.setAttribute("role", "img");
      creatorBadge.setAttribute("aria-label", "Этот человек является создателем SG Games");
      creatorBadge.setAttribute("title", "Этот человек является создателем SG Games");
      creatorBadge.setAttribute("data-tooltip", "Этот человек является создателем SG Games");
      creatorBadge.textContent = "✓";
      profileNickname.append(creatorBadge);
    }
    profileNicknameInput.value = data.nickname;
    profileAvatarLetter.textContent = Array.from(data.nickname)[0].toLocaleUpperCase("ru");
    profileAvatarLetter.hidden = Boolean(data.avatar_path);
    profileAvatarImage.hidden = true;
    profileAvatarImage.removeAttribute("src");
    profileAvatar.style.setProperty("--avatar-hue", String(data.nickname.codePointAt(0) % 360));
    profileAvatar.setAttribute("aria-label", `Аватар ${data.nickname}`);
    profileCoins.textContent = data.coins.toLocaleString("ru-RU");
    currentAvatarPath = data.avatar_path;
    profileAvatarChoose.textContent = currentAvatarPath ? "Изменить аватар" : "Добавить аватар";
    profileAvatarRemove.hidden = !currentAvatarPath;
    profileAvatarStatus.textContent = "";
    if (currentAvatarPath) {
      try {
        const avatarCache = window.SGAvatarCache;
        const cachedAvatar = avatarCache?.read(nextSession.user.id);
        let signedUrl = cachedAvatar?.avatarPath === currentAvatarPath
          ? cachedAvatar.signedUrl
          : null;
        if (!signedUrl) {
          const { data: avatarData, error: avatarError } = await supabaseClient
            .storage.from(avatarBucket)
            .createSignedUrl(currentAvatarPath, 3600);
          if (avatarError) throw avatarError;
          signedUrl = avatarData.signedUrl;
        }
        if (session?.user.id !== nextSession.user.id) return;
        profileAvatarImage.src = signedUrl;
        try {
          await profileAvatarImage.decode();
        } catch (error) {
          if (!cachedAvatar || cachedAvatar.avatarPath !== currentAvatarPath) throw error;
          avatarCache.clear(nextSession.user.id);
          const { data: avatarData, error: avatarError } = await supabaseClient
            .storage.from(avatarBucket)
            .createSignedUrl(currentAvatarPath, 3600);
          if (avatarError) throw avatarError;
          profileAvatarImage.src = avatarData.signedUrl;
          await profileAvatarImage.decode();
          avatarCache?.write(nextSession.user.id, data.nickname, currentAvatarPath, avatarData.signedUrl);
        }
        if (session?.user.id !== nextSession.user.id) return;
        profileAvatarImage.hidden = false;
        profileAvatarLetter.hidden = true;
        if (!cachedAvatar || cachedAvatar.avatarPath !== currentAvatarPath) {
          avatarCache?.write(nextSession.user.id, data.nickname, currentAvatarPath, signedUrl);
        }
      } catch (avatarError) {
        console.error("Не удалось загрузить аватар профиля.", avatarError);
        profileAvatarLetter.hidden = false;
        profileAvatarStatus.textContent = "Не удалось загрузить аватар.";
      }
    } else {
      window.SGAvatarCache?.clear(nextSession.user.id);
    }
    renderOwnedCards(data.cards);
    profileStatus.textContent = "";
    profileSignout.disabled = false;
    if (accountDialog.open) accountDialog.close();
    return true;
  } catch (error) {
    console.error("Не удалось загрузить профиль.", error);
    profileStatus.textContent = "Не удалось загрузить профиль. Проверь подключение и выполни миграции базы аккаунтов.";
    profileSignout.disabled = false;
    return false;
  }
}

profileOpenAccount.addEventListener("click", () => {
  if (isPublicProfile) return;
  openAccountDialog();
});
profileSignout.addEventListener("click", async () => {
  if (isPublicProfile) return;
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

profilePasswordReset.addEventListener("click", async () => {
  if (isPublicProfile) return;
  if (!session?.user.email) {
    profilePasswordStatus.textContent = "Не удалось определить почту аккаунта. Выйди и войди снова.";
    return;
  }

  profilePasswordReset.disabled = true;
  profilePasswordStatus.textContent = "Отправляю ссылку для смены пароля...";
  try {
    await accountAuth.sendPasswordReset(session.user.email);
    profilePasswordStatus.textContent = "Письмо отправлено. Перейди по ссылке, чтобы задать новый пароль.";
  } catch (error) {
    console.error("Не удалось отправить ссылку для смены пароля.", error);
    profilePasswordStatus.textContent = "Не удалось отправить письмо. Проверь подключение и попробуй снова.";
  } finally {
    profilePasswordReset.disabled = false;
  }
});

function closeDeleteAccountDialog() {
  deleteAccountDialog.close();
  deleteAccountForm.reset();
  deleteAccountMessage.textContent = "";
  deleteAccountMessage.classList.remove("is-error");
}

profileDeleteAccount.addEventListener("click", () => {
  if (isPublicProfile) return;
  deleteAccountForm.reset();
  deleteAccountMessage.textContent = "";
  deleteAccountMessage.classList.remove("is-error");
  deleteAccountDialog.showModal();
  deleteAccountPassword.focus();
});
deleteAccountCancel.addEventListener("click", closeDeleteAccountDialog);
deleteAccountClose.addEventListener("click", closeDeleteAccountDialog);
deleteAccountDialog.addEventListener("click", event => {
  if (event.target === deleteAccountDialog && !deleteAccountSubmit.disabled) closeDeleteAccountDialog();
});
deleteAccountDialog.addEventListener("cancel", event => {
  if (deleteAccountSubmit.disabled) event.preventDefault();
});
deleteAccountDialog.addEventListener("close", () => {
  deleteAccountForm.reset();
  deleteAccountMessage.textContent = "";
  deleteAccountMessage.classList.remove("is-error");
});
deleteAccountForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (isPublicProfile) return;
  if (!session?.user.email) {
    deleteAccountMessage.textContent = "Не удалось определить почту аккаунта. Выйди и войди снова.";
    deleteAccountMessage.classList.add("is-error");
    return;
  }
  if (deleteAccountConfirmation.value.trim().toLocaleUpperCase("ru") !== "УДАЛИТЬ") {
    deleteAccountMessage.textContent = "Для подтверждения напиши УДАЛИТЬ.";
    deleteAccountMessage.classList.add("is-error");
    return;
  }

  const userId = session.user.id;
  deleteAccountSubmit.disabled = true;
  deleteAccountCancel.disabled = true;
  deleteAccountClose.disabled = true;
  deleteAccountMessage.classList.remove("is-error");
  deleteAccountMessage.textContent = "Проверяю пароль и удаляю аккаунт...";
  try {
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: session.user.email,
      password: deleteAccountPassword.value
    });
    if (authError) throw authError;
    if (authData.user.id !== userId) throw new Error("account_identity_mismatch");

    const { data: canDelete, error: preflightError } = await supabaseClient.rpc("can_delete_sg_game_account");
    if (preflightError) throw preflightError;
    if (!canDelete) throw new Error("account_not_found");

    if (currentAvatarPath) {
      const { error: avatarError } = await supabaseClient.storage
        .from(avatarBucket)
        .remove([currentAvatarPath]);
      if (avatarError) {
        console.error("Не удалось удалить аватар перед удалением аккаунта.", avatarError);
        throw new Error("avatar_cleanup_failed");
      }
    }

    const { error: deleteError } = await supabaseClient.rpc("delete_sg_game_account");
    if (deleteError) throw deleteError;

    window.SGAvatarCache?.clear(userId);
    const { error: signOutError } = await supabaseClient.auth.signOut({ scope: "local" });
    if (signOutError) console.error("Аккаунт удалён, но локальный выход завершился ошибкой.", signOutError);
    closeDeleteAccountDialog();
    await loadProfile(null);
    window.setTimeout(() => {
      profileGateMessage.textContent = "Аккаунт удалён. Теперь можно создать новый аккаунт.";
    }, 0);
  } catch (error) {
    console.error("Не удалось удалить аккаунт.", error);
    let message = "Не удалось удалить аккаунт. Проверь подключение и попробуй снова.";
    if (/invalid login credentials/i.test(error.message || "")) {
      message = "Пароль неверный. Проверь его и попробуй снова.";
    } else if (error.message === "avatar_cleanup_failed") {
      message = "Не удалось удалить аватар. Аккаунт пока не удалён, попробуй ещё раз.";
    } else if (error.message === "account_identity_mismatch") {
      message = "Введённые данные относятся к другому аккаунту.";
    } else if (/can_delete_sg_game_account|delete_sg_game_account|schema cache/i.test(error.message || "")) {
      message = "Сначала выполни новую миграцию удаления аккаунта в Supabase.";
    } else if (error.message === "account_not_found") {
      message = "Аккаунт уже не найден. Попробуй выйти и войти снова.";
    }
    deleteAccountMessage.textContent = message;
    deleteAccountMessage.classList.add("is-error");
  } finally {
    deleteAccountSubmit.disabled = false;
    deleteAccountCancel.disabled = false;
    deleteAccountClose.disabled = false;
  }
});

profileAvatarChoose.addEventListener("click", () => {
  if (!isPublicProfile) profileAvatarInput.click();
});
profileAvatarInput.addEventListener("change", async () => {
  if (isPublicProfile) {
    profileAvatarInput.value = "";
    return;
  }
  const file = profileAvatarInput.files?.[0];
  if (!file) return;
  if (!avatarMimeTypes.has(file.type)) {
    profileAvatarStatus.textContent = "Выбери изображение PNG, JPG или WebP.";
    profileAvatarInput.value = "";
    return;
  }
  if (file.size > maxAvatarSize) {
    profileAvatarStatus.textContent = "Размер аватара не должен превышать 2 МБ.";
    profileAvatarInput.value = "";
    return;
  }
  if (!session) {
    profileAvatarInput.value = "";
    return;
  }

  const avatarPath = `${session.user.id}/avatar`;
  profileAvatarChoose.disabled = true;
  profileAvatarRemove.disabled = true;
  profileAvatarStatus.textContent = "Загружаю аватар...";
  let uploaded = false;
  try {
    const optimizedAvatar = await prepareAvatar(file);
    const { error: uploadError } = await supabaseClient.storage
      .from(avatarBucket)
      .upload(avatarPath, optimizedAvatar, {
        cacheControl: "3600",
        contentType: optimizedAvatar.type,
        upsert: true
      });
    if (uploadError) throw uploadError;
    uploaded = true;

    const { error: profileError } = await supabaseClient.rpc("set_sg_game_avatar", {
      p_avatar_path: avatarPath
    });
    if (profileError) throw profileError;

    window.SGAvatarCache?.clear(session.user.id);
    currentAvatarPath = avatarPath;
    const profileLoaded = await loadProfile(session);
    window.dispatchEvent(new Event("sg-game-avatar-updated"));
    profileAvatarStatus.textContent = profileLoaded
      ? "Аватар обновлён."
      : "Аватар сохранён, но профиль не обновился. Обнови страницу.";
  } catch (error) {
    console.error("Не удалось сохранить аватар.", error);
    if (uploaded && !currentAvatarPath) {
      try {
        const { error: cleanupError } = await supabaseClient.storage
          .from(avatarBucket)
          .remove([avatarPath]);
        if (cleanupError) console.error("Не удалось удалить несохранённый аватар.", cleanupError);
      } catch (cleanupError) {
        console.error("Не удалось удалить несохранённый аватар.", cleanupError);
      }
    }
    profileAvatarStatus.textContent = error.message === "avatar_canvas_unavailable" || error.message === "avatar_processing_failed"
      ? "Не удалось обработать изображение. Попробуй выбрать другую картинку."
      : /bucket|row.level security|policy|set_sg_game_avatar/i.test(error.message || "")
        ? "Хранилище аватаров ещё не настроено. Выполни новую SQL-миграцию."
        : "Не удалось сохранить аватар. Проверь подключение и попробуй снова.";
  } finally {
    profileAvatarInput.value = "";
    profileAvatarChoose.disabled = false;
    profileAvatarRemove.disabled = false;
  }
});

profileAvatarRemove.addEventListener("click", async () => {
  if (isPublicProfile) return;
  if (!session || !currentAvatarPath) return;

  const avatarPath = currentAvatarPath;
  profileAvatarChoose.disabled = true;
  profileAvatarRemove.disabled = true;
  profileAvatarStatus.textContent = "Удаляю аватар...";
  try {
    const { error: profileError } = await supabaseClient.rpc("set_sg_game_avatar", {
      p_avatar_path: null
    });
    if (profileError) throw profileError;

    window.SGAvatarCache?.clear(session.user.id);
    currentAvatarPath = null;
    await loadProfile(session);
    window.dispatchEvent(new Event("sg-game-avatar-updated"));
    const { error: removeError } = await supabaseClient.storage
      .from(avatarBucket)
      .remove([avatarPath]);
    if (removeError) {
      console.error("Аватар отвязан, но файл не удалось удалить.", removeError);
      profileAvatarStatus.textContent = "Аватар удалён из профиля, но файл не удалось удалить из хранилища.";
      return;
    }
    profileAvatarStatus.textContent = "Аватар удалён.";
  } catch (error) {
    console.error("Не удалось удалить аватар.", error);
    profileAvatarStatus.textContent = "Не удалось удалить аватар. Проверь подключение и попробуй снова.";
  } finally {
    profileAvatarChoose.disabled = false;
    profileAvatarRemove.disabled = false;
  }
});

profileNicknameForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (isPublicProfile) return;
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
  profileNicknameMessage.textContent = "Сохраняю ник...";
  try {
    const { error } = await supabaseClient.rpc("set_sg_game_nickname", { p_nickname: nickname });
    if (error) throw error;
    const profileLoaded = await loadProfile(session);
    if (profileLoaded && profileNickname.textContent === nickname) {
      profileNicknameMessage.textContent = "Ник сохранён.";
    }
  } catch (error) {
    console.error("Не удалось сохранить ник.", error);
    const messages = {
      nickname_taken: "Этот ник уже занят. Попробуй другой.",
      nickname_invalid: "Этот ник не подходит. Выбери другой.",
      profile_not_found: "Профиль не найден. Попробуй выйти и войти снова."
    };
    profileNicknameMessage.textContent = messages[error.message] || "Не удалось сохранить ник. Проверь подключение и попробуй снова.";
    profileNicknameMessage.classList.add("is-error");
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#account-dialog-close").addEventListener("click", () => accountDialog.close());
accountDialog.addEventListener("click", event => {
  if (event.target === accountDialog) accountDialog.close();
});

if (!supabaseClient) {
  profileGateMessage.textContent = "Сервис аккаунтов ещё не настроен.";
  profileOpenAccount.disabled = true;
} else if (publicNickname) {
  loadPublicProfile(publicNickname);
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
