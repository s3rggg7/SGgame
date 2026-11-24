const headerAccount = document.querySelector(".header-account");

if (headerAccount && window.supabase && window.SG_SUPABASE_CONFIG) {
  const supabaseClient = window.supabase.createClient(
    window.SG_SUPABASE_CONFIG.url,
    window.SG_SUPABASE_CONFIG.publishableKey
  );
  const placeholder = headerAccount.querySelector(".header-account-placeholder");
  const letter = headerAccount.querySelector(".header-account-letter");
  const image = headerAccount.querySelector(".header-account-image");
  let latestRequest = 0;
  let activeSession = null;
  let activeNickname = "";

  const avatarCache = window.SGAvatarCache = {
    read(userId) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(`sg-game-avatar:${userId}`) || "null");
        return cached?.expiresAt > Date.now() ? cached : null;
      } catch (error) {
        console.error("Не удалось прочитать кэш аватара.", error);
        return null;
      }
    },
    write(userId, nickname, avatarPath, signedUrl) {
      try {
        sessionStorage.setItem(`sg-game-avatar:${userId}`, JSON.stringify({
          nickname,
          avatarPath,
          signedUrl,
          expiresAt: Date.now() + 55 * 60 * 1000
        }));
      } catch (error) {
        console.error("Не удалось сохранить кэш аватара.", error);
      }
    },
    clear(userId) {
      try {
        sessionStorage.removeItem(`sg-game-avatar:${userId}`);
      } catch (error) {
        console.error("Не удалось очистить кэш аватара.", error);
      }
    }
  };

  function showFallback(nickname = "") {
    activeNickname = nickname;
    image.hidden = true;
    image.removeAttribute("src");
    letter.hidden = !nickname;
    letter.textContent = nickname ? Array.from(nickname)[0].toLocaleUpperCase("ru") : "";
    placeholder.hidden = Boolean(nickname);
    headerAccount.setAttribute("aria-label", nickname ? `Профиль ${nickname}` : "Открыть профиль");
  }

  function showAvatarLoading(nickname = "") {
    activeNickname = nickname;
    image.hidden = true;
    image.removeAttribute("src");
    letter.hidden = true;
    placeholder.hidden = false;
    headerAccount.setAttribute("aria-label", nickname ? `Профиль ${nickname}` : "Открыть профиль");
  }

  async function displayAvatar(signedUrl, requestId) {
    image.src = signedUrl;
    await image.decode();
    if (requestId !== latestRequest) return;
    image.hidden = false;
    letter.hidden = true;
    placeholder.hidden = true;
  }

  async function updateHeaderAccount(session) {
    const requestId = ++latestRequest;
    activeSession = session;
    showFallback();
    if (!session) return;

    const userId = session.user.id;
    let cached = avatarCache.read(userId);
    if (cached?.avatarPath === `${userId}/avatar` && typeof cached.signedUrl === "string") {
      showAvatarLoading(cached.nickname);
      try {
        await displayAvatar(cached.signedUrl, requestId);
      } catch {
        const cachedNickname = cached.nickname;
        avatarCache.clear(userId);
        cached = null;
        showFallback(cachedNickname);
      }
    }

    try {
      const [profileResult, avatarResult] = await Promise.all([
        supabaseClient
          .from("sg_game_profiles")
          .select("nickname,avatar_path")
          .eq("id", userId)
          .single(),
        supabaseClient.storage
          .from("sg-game-avatars")
          .createSignedUrl(`${userId}/avatar`, 3600)
      ]);
      const { data: profile, error } = profileResult;
      if (error) throw error;
      if (requestId !== latestRequest) return;
      if (typeof profile.nickname !== "string" || !profile.nickname) {
        throw new Error("Профиль содержит некорректный ник.");
      }

      const avatarPath = `${userId}/avatar`;
      if (profile.avatar_path !== avatarPath) {
        avatarCache.clear(userId);
        showFallback(profile.nickname);
        return;
      }

      if (cached?.avatarPath === avatarPath && cached.expiresAt > Date.now()) {
        headerAccount.setAttribute("aria-label", `Профиль ${profile.nickname}`);
        avatarCache.write(userId, profile.nickname, avatarPath, cached.signedUrl);
        return;
      }

      if (avatarResult.error) throw avatarResult.error;
      if (requestId !== latestRequest) return;
      showAvatarLoading(profile.nickname);
      await displayAvatar(avatarResult.data.signedUrl, requestId);
      avatarCache.write(userId, profile.nickname, avatarPath, avatarResult.data.signedUrl);
    } catch (error) {
      if (requestId !== latestRequest) return;
      console.error("Не удалось загрузить аватар аккаунта в шапке сайта.", error);
      if (image.hidden) showFallback(activeNickname);
    }
  }

  image.addEventListener("error", () => {
    if (activeSession) avatarCache.clear(activeSession.user.id);
    showFallback(activeNickname);
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => updateHeaderAccount(session), 0);
  });
  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    return updateHeaderAccount(data.session);
  }).catch(error => {
    console.error("Не удалось проверить аккаунт для иконки в шапке.", error);
  });
  document.addEventListener("sg-game-avatar-updated", () => {
    updateHeaderAccount(activeSession);
  });
}
