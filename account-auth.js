window.SGAccountAuth = {
  initialize(supabaseClient) {
    const dialog = document.querySelector("#account-dialog");
    const form = document.querySelector("#account-form");
    const message = document.querySelector("#account-message");
    const submit = document.querySelector("#account-submit");
    const modeToggle = document.querySelector("#account-mode-toggle");
    const passwordReset = document.querySelector("#account-password-reset");
    const nicknameField = document.querySelector("#account-nickname-field");
    const nicknameInput = document.querySelector("#account-form-nickname");
    const passwordInput = document.querySelector("#account-form-password");
    const emailInput = document.querySelector("#account-form-email");
    const passwordUpdateDialog = document.querySelector("#password-update-dialog");
    const passwordUpdateForm = document.querySelector("#password-update-form");
    const passwordUpdateInput = document.querySelector("#password-update-input");
    const passwordUpdateConfirmation = document.querySelector("#password-update-confirmation");
    const passwordUpdateSubmit = document.querySelector("#password-update-submit");
    const passwordUpdateMessage = document.querySelector("#password-update-message");
    let mode = "signin";

    function setMessage(text, isError = false) {
      message.textContent = text;
      message.classList.toggle("is-error", isError);
    }

    function setMode(nextMode) {
      mode = nextMode;
      nicknameField.hidden = mode !== "signup";
      nicknameInput.required = mode === "signup";
      passwordInput.autocomplete = mode === "signup" ? "new-password" : "current-password";
      submit.textContent = mode === "signup" ? "Создать аккаунт" : "Войти";
      modeToggle.textContent = mode === "signup" ? "Уже есть аккаунт? Войти" : "Создать аккаунт";
      passwordReset.hidden = mode === "signup";
      setMessage("");
    }

    function open(nextMode = "signin", initialMessage = "") {
      setMode(nextMode);
      setMessage(initialMessage);
      if (!dialog.open) dialog.showModal();
      emailInput.focus();
    }

    async function sendPasswordReset(email) {
      if (!supabaseClient) throw new Error("Сервис аккаунтов не настроен.");
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("profile.html", window.location.href).href
      });
      if (error) throw error;
    }

    function getErrorMessage(error) {
      if (/invalid.*credentials|invalid login credentials/i.test(error.message || "")) {
        return "Неверная почта или пароль.";
      }
      if (/email not confirmed/i.test(error.message || "")) {
        return "Сначала подтверди почту по ссылке из письма.";
      }
      if (/already registered|user already exists/i.test(error.message || "")) {
        return "Эта почта уже зарегистрирована. Войди по паролю.";
      }
      if (/nickname_taken|duplicate key|unique constraint/i.test(error.message || "")) {
        return "Этот ник уже занят. Попробуй другой.";
      }
      if (/nickname_invalid/i.test(error.message || "")) {
        return "Этот ник не подходит. Выбери другой.";
      }
      if (/database error saving new user/i.test(error.message || "")) {
        return "Не удалось создать аккаунт. Ник может быть занят или миграция профиля не настроена.";
      }
      return error.message || "Произошла ошибка. Попробуй ещё раз.";
    }

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!supabaseClient) {
        setMessage("Не удалось подключиться к сервису аккаунтов.", true);
        return;
      }

      submit.disabled = true;
      modeToggle.disabled = true;
      try {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (mode === "signup") {
          const nickname = window.SGAccountRules.normalizeNickname(nicknameInput.value);
          const nicknameError = window.SGAccountRules.validateNickname(nickname);
          if (nicknameError) {
            setMessage(nicknameError, true);
            return;
          }

          setMessage("Создаю аккаунт и отправляю письмо...");
          const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
              data: { nickname },
              emailRedirectTo: `${window.location.origin}${window.location.pathname}`
            }
          });
          if (error) throw error;
          if (!data.session) {
            if (data.user?.identities?.length === 0) {
              throw new Error("user_already_registered");
            }
            form.reset();
            setMessage("Проверь почту и нажми кнопку подтверждения. Затем вернись сюда и войди по паролю.");
          } else {
            form.reset();
            setMessage("Аккаунт создан. Загружаю профиль...");
          }
          return;
        }

        setMessage("Выполняю вход...");
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMessage("Вход выполнен...");
      } catch (error) {
        console.error("Не удалось выполнить действие с аккаунтом.", error);
        setMessage(error.message === "user_already_registered"
          ? "Эта почта уже зарегистрирована. Войди по паролю."
          : getErrorMessage(error), true);
      } finally {
        submit.disabled = false;
        modeToggle.disabled = false;
      }
    });

    modeToggle.addEventListener("click", () => {
      setMode(mode === "signin" ? "signup" : "signin");
    });

    passwordReset.addEventListener("click", async () => {
      if (!emailInput.reportValidity()) return;
      passwordReset.disabled = true;
      setMessage("Отправляю ссылку для восстановления пароля...");
      try {
        await sendPasswordReset(emailInput.value.trim());
        setMessage("Письмо отправлено. Открой ссылку в нём, чтобы задать новый пароль.");
      } catch (error) {
        console.error("Не удалось отправить ссылку для восстановления пароля.", error);
        setMessage(error.message || "Не удалось отправить письмо. Проверь почту и попробуй снова.", true);
      } finally {
        passwordReset.disabled = false;
      }
    });

    if (passwordUpdateDialog && passwordUpdateForm) {
      const passwordUpdateClose = document.querySelector("#password-update-close");
      const passwordUpdateCancel = document.querySelector("#password-update-cancel");

      function closePasswordUpdateDialog() {
        passwordUpdateDialog.close();
        passwordUpdateForm.reset();
        passwordUpdateMessage.textContent = "";
      }

      passwordUpdateClose.addEventListener("click", closePasswordUpdateDialog);
      passwordUpdateCancel.addEventListener("click", closePasswordUpdateDialog);
      passwordUpdateDialog.addEventListener("click", event => {
        if (event.target === passwordUpdateDialog) closePasswordUpdateDialog();
      });
      passwordUpdateForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (passwordUpdateInput.value !== passwordUpdateConfirmation.value) {
          passwordUpdateMessage.textContent = "Пароли не совпадают.";
          passwordUpdateMessage.classList.add("is-error");
          return;
        }

        passwordUpdateSubmit.disabled = true;
        passwordUpdateMessage.classList.remove("is-error");
        passwordUpdateMessage.textContent = "Сохраняю новый пароль...";
        try {
          const { error } = await supabaseClient.auth.updateUser({
            password: passwordUpdateInput.value
          });
          if (error) throw error;
          passwordUpdateMessage.textContent = "Пароль успешно изменён.";
          passwordUpdateForm.reset();
          window.setTimeout(closePasswordUpdateDialog, 1800);
        } catch (error) {
          console.error("Не удалось изменить пароль.", error);
          passwordUpdateMessage.textContent = error.message || "Не удалось изменить пароль. Запроси новую ссылку.";
          passwordUpdateMessage.classList.add("is-error");
        } finally {
          passwordUpdateSubmit.disabled = false;
        }
      });

      supabaseClient?.auth.onAuthStateChange(event => {
        if (event === "PASSWORD_RECOVERY" && !passwordUpdateDialog.open) {
          window.setTimeout(() => {
            passwordUpdateDialog.showModal();
            passwordUpdateInput.focus();
          }, 0);
        }
      });
    }

    return { open, sendPasswordReset };
  }
};
