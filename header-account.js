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

  function showAccountFallback(nickname = "") {
    image.hidden = true;
    image.removeAttribute("src");
    letter.hidden = !nickname;
    letter.textContent = nickname ? Array.from(nickname)[0].toLocaleUpperCase("ru") : "";
    placeholder.hidden = Boolean(nickname);
    headerAccount.setAttribute("aria-label", nickname ? `Профиль ${nickname}` : "Открыть профиль");
  }

  async function updateHeaderAccount(session) {
    const requestId = ++latestRequest;
    showAccountFallback();
    if (!session) return;

    try {
      const { data: profile, error } = await supabaseClient
        .from("sg_game_profiles")
        .select("nickname,avatar_path")
        .eq("id", session.user.id)
        .single();
      if (error) throw error;
      if (requestId !== latestRequest) return;
      if (typeof profile.nickname !== "string" || !profile.nickname) {
        throw new Error("Профиль содержит некорректный ник.");
      }

      showAccountFallback(profile.nickname);
      if (profile.avatar_path === `${session.user.id}/avatar`) {
        const { data, error: avatarError } = await supabaseClient.storage
          .from("sg-game-avatars")
          .createSignedUrl(profile.avatar_path, 3600);
        if (avatarError) throw avatarError;
        if (requestId !== latestRequest) return;
        image.src = data.signedUrl;
        image.hidden = false;
        letter.hidden = true;
      }
    } catch (error) {
      if (requestId !== latestRequest) return;
      console.error("Не удалось загрузить аватар аккаунта в шапке сайта.", error);
    }
  }

  image.addEventListener("error", () => {
    image.hidden = true;
    image.removeAttribute("src");
    letter.hidden = false;
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
}
