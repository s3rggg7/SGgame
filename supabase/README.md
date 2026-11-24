# Аккаунты SG Games

1. В Supabase открой **SQL Editor** и выполни миграции по порядку:
   - `migrations/20261124120000_accounts.sql`
   - `migrations/20261124140000_profile_nicknames.sql`
   - `migrations/20261124160000_nickname_avatar_updates.sql`
   - `migrations/20261124170000_delete_sg_game_account.sql`
2. Открой **Authentication → URL Configuration** и установи:
   - Site URL: `https://s3rggg7.github.io/SGgame/`
   - Redirect URLs: `https://s3rggg7.github.io/SGgame/collection.html` и `https://s3rggg7.github.io/SGgame/profile.html`
3. В **Authentication → Providers → Email** оставь включённым подтверждение почты. Для кастомного оформления писем Supabase требует подключить SMTP; без него используется стандартное письмо со ссылкой подтверждения.

Регистрация требует подтвердить почту по ссылке из письма; после этого можно войти по паролю. Ник уникален без учёта регистра, проверяется сервером на недопустимые слова и может меняться в профиле, если новое имя свободно. Свой аватар можно загрузить в профиле: PNG, JPG или WebP размером до 2 МБ; файлы хранятся в закрытом хранилище и автоматически уменьшаются при загрузке. Удаление аккаунта доступно из профиля после повторного ввода пароля.

Ключ в `supabase-config.js` — публичный publishable key. Баланс, ник и карточки доступны для чтения только владельцу аккаунта; изменения баланса и карточек выполняются серверными функциями. Никогда не добавляй в сайт `service_role` или secret key.
