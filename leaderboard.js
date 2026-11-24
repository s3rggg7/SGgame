const podiumGrid = document.querySelector("#podium-grid");
const leaderboardList = document.querySelector("#leaderboard-list");
const leaderboardStatus = document.querySelector("#leaderboard-status");
const leaderboardMyPlace = document.querySelector("#leaderboard-my-place");

const supabaseClient = window.supabase && window.SG_SUPABASE_CONFIG
  ? window.supabase.createClient(
    window.SG_SUPABASE_CONFIG.url,
    window.SG_SUPABASE_CONFIG.publishableKey
  )
  : null;

document.querySelector("#year").textContent = new Date().getFullYear();

function avatarUrl(player) {
  if (!player.avatar_path) return "";
  const url = supabaseClient.storage
    .from("sg-game-avatars")
    .getPublicUrl(player.avatar_path).data.publicUrl;
  return `${url}?v=${player.card_count}`;
}

function creatorBadge() {
  return '<span class="creator-badge leaderboard-creator-badge" tabindex="0" role="img" aria-label="Этот человек является создателем SG Games" title="Этот человек является создателем SG Games" data-tooltip="Этот человек является создателем SG Games">✓</span>';
}

function playerAvatar(player, sizeClass = "") {
  const letter = Array.from(player.nickname)[0]?.toLocaleUpperCase("ru") || "?";
  const url = avatarUrl(player);
  return `
    <span class="leaderboard-avatar ${sizeClass}" aria-hidden="true">
      ${url ? `<img src="${url}" alt="">` : `<span>${letter}</span>`}
    </span>`;
}

function playerProfileLink(player, content) {
  return `<a class="leaderboard-player-link" href="profile.html?nickname=${encodeURIComponent(player.nickname)}">${content}</a>`;
}

function renderPodium(top) {
  const order = [top[1], top[0], top[2]];
  podiumGrid.innerHTML = order.map((player, index) => {
    if (!player) return '<div></div>';
    const place = player.position;
    return `
      <article class="podium-player place-${place}">
        <span class="podium-place">${place}</span>
        ${playerProfileLink(player, `
          ${playerAvatar(player, "podium-avatar")}
          <span class="podium-name">${player.nickname}${player.creator_verified ? creatorBadge() : ""}</span>
        `)}
        <strong>${player.card_count} <small>карточек</small></strong>
      </article>`;
  }).join("");
}

function renderList(top) {
  leaderboardList.innerHTML = top.map(player => `
    <article class="leaderboard-row">
      <span class="leaderboard-position">${player.position}</span>
      ${playerProfileLink(player, `
        ${playerAvatar(player)}
        <span class="leaderboard-name">${player.nickname}${player.creator_verified ? creatorBadge() : ""}</span>
      `)}
      <strong class="leaderboard-card-count">${player.card_count}<small>карточек</small></strong>
    </article>
  `).join("");
}

async function loadLeaderboard() {
  if (!supabaseClient) {
    leaderboardStatus.textContent = "Сервис рейтинга недоступен.";
    return;
  }

  try {
    const { data, error } = await supabaseClient.rpc("get_sg_game_leaderboard");
    if (error) throw error;

    const top = Array.isArray(data?.top) ? data.top : [];
    renderPodium(top);
    renderList(top);
    leaderboardStatus.textContent = top.length
      ? `${top.length} ${top.length === 100 ? "лучших" : "игроков"}`
      : "Пока нет игроков";

    if (data?.mine) {
      leaderboardMyPlace.hidden = false;
      leaderboardMyPlace.innerHTML = `
        <span>Твоё место</span>
        ${playerProfileLink(data.mine, `
          ${playerAvatar(data.mine)}
          <strong>${data.mine.nickname}</strong>
        `)}
        <b>#${data.mine.position}</b>
        <span>${data.mine.card_count} карточек</span>`;
    } else {
      leaderboardMyPlace.hidden = true;
    }
  } catch (error) {
    console.error("Не удалось загрузить топ лидеров.", error);
    leaderboardStatus.textContent = "Не удалось загрузить рейтинг.";
  }
}

loadLeaderboard();
