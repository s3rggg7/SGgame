# Аккаунты SG Games

1. В Supabase открой **SQL Editor**, создай запрос, вставь содержимое `migrations/20261124120000_accounts.sql` и выполни его.
2. Открой **Authentication → URL Configuration** и установи:
   - Site URL: `https://s3rggg7.github.io/SGgame/`
   - Redirect URL: `https://s3rggg7.github.io/SGgame/collection.html`
3. Оставь включённым подтверждение электронной почты. После регистрации игроку нужно перейти по ссылке из письма, затем войти на сайте.

Ключ в `supabase-config.js` — публичный publishable key. Баланс и карточки доступны для чтения только владельцу аккаунта; изменения выполняются серверными функциями. Никогда не добавляй в сайт `service_role` или secret key.
