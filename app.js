const grid = document.querySelector("#game-grid");

const homeCoinCount = document.querySelector("#home-coin-count");
if (homeCoinCount) {
  const supabaseClient = window.supabase && window.SG_SUPABASE_CONFIG
    ? window.supabase.createClient(
      window.SG_SUPABASE_CONFIG.url,
      window.SG_SUPABASE_CONFIG.publishableKey
    )
    : null;
  let latestBalanceRequest = 0;

  async function updateHomeBalance() {
    const requestId = ++latestBalanceRequest;
    try {
      if (!supabaseClient) throw new Error("Сервис аккаунтов не настроен.");
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError) throw sessionError;
      if (requestId !== latestBalanceRequest) return;

      if (!sessionData.session) {
        homeCoinCount.textContent = "0";
        return;
      }

      const { data: profile, error: profileError } = await supabaseClient
        .from("sg_game_profiles")
        .select("coins")
        .eq("id", sessionData.session.user.id)
        .single();
      if (profileError) throw profileError;
      if (requestId !== latestBalanceRequest) return;
      if (!Number.isSafeInteger(profile.coins) || profile.coins < 0) {
        throw new Error("В профиле аккаунта обнаружен неверный баланс SG-баксов.");
      }

      homeCoinCount.textContent = profile.coins.toLocaleString("ru-RU");
    } catch (error) {
      if (requestId !== latestBalanceRequest) return;
      console.error("Не удалось загрузить баланс SG-баксов.", error);
      homeCoinCount.textContent = "—";
    }
  }

  updateHomeBalance();
  supabaseClient?.auth.onAuthStateChange(() => {
    window.setTimeout(updateHomeBalance, 0);
  });
  window.addEventListener("focus", updateHomeBalance);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateHomeBalance();
  });
}

if (grid) {
  const gameCount = document.querySelector("#game-count");
  const search = document.querySelector("#game-search");
  let activeFilter = "all";
  let searchQuery = "";

  function formatGameCount(count) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    const noun = lastTwoDigits >= 11 && lastTwoDigits <= 14
      ? "проектов"
      : lastDigit === 1
        ? "проект"
        : lastDigit >= 2 && lastDigit <= 4
          ? "проекта"
          : "проектов";
    return `${count} ${noun}`;
  }

  function renderGames() {
    const query = searchQuery.trim().toLocaleLowerCase("ru");
    const visible = GAMES.filter(game => {
      const matchesFilter = activeFilter === "all" || game.genre.toLowerCase() === activeFilter;
      const searchableText = [game.title, game.genre, game.short, game.description, ...game.features]
        .join(" ")
        .toLocaleLowerCase("ru");
      return matchesFilter && searchableText.includes(query);
    });

    gameCount.textContent = formatGameCount(visible.length);
    grid.innerHTML = visible.length ? visible.map((game, index) => `
      <a class="game-card reveal" href="game.html?id=${game.id}" style="transition-delay:${index * 70}ms">
        <div class="game-cover">
          <img class="${game.coverMode === "contain" ? "contain" : ""}" src="${game.cover}" alt="${game.title}" loading="lazy">
        </div>
        <div class="game-info">
          <div>
            <h2>${game.title}</h2>
            <div class="game-meta">${game.year ? `${game.genre} · ${game.year}` : game.genre}</div>
          </div>
          <span class="game-arrow" aria-hidden="true">↗</span>
        </div>
      </a>
    `).join("") : `
      <div class="empty-games" role="status">
        <span aria-hidden="true">⌕</span>
        <h3>Ничего не найдено</h3>
        <p>${query ? "Попробуй изменить запрос или выбрать другую категорию." : "В этой категории пока нет игр."}</p>
      </div>`;
    observeReveal();
  }

  renderGames();

  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector(".filter.active")?.classList.remove("active");
      button.classList.add("active");
      document.querySelectorAll(".filter").forEach(filterButton => {
        filterButton.setAttribute("aria-pressed", String(filterButton === button));
      });
      activeFilter = button.dataset.filter;
      renderGames();
    });
  });

  search?.addEventListener("input", () => {
    searchQuery = search.value;
    renderGames();
  });
}

const menu = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
menu?.addEventListener("click", () => {
  const open = menu.classList.toggle("open");
  nav.classList.toggle("open", open);
  menu.setAttribute("aria-expanded", String(open));
});

document.querySelector("#year").textContent = new Date().getFullYear();

function observeReveal() {
  const items = document.querySelectorAll(".reveal:not(.visible)");
  if (!("IntersectionObserver" in window)) {
    items.forEach(item => item.classList.add("visible"));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .12 });
  items.forEach(item => observer.observe(item));
}

observeReveal();
