window.SGAccountAuth = {
  initialize(supabaseClient) {
    const dialog = document.querySelector("#account-dialog");
    const form = document.querySelector("#account-form");
    const message = document.querySelector("#account-message");
    const submit = document.querySelector("#account-submit");
    const modeToggle = document.querySelector("#account-mode-toggle");
    const codeLogin = document.querySelector("#account-code-login");
    const codeResend = document.querySelector("#account-code-resend");
    const codeBack = document.querySelector("#account-code-back");
    const nicknameField = document.querySelector("#account-nickname-field");
    const nicknameInput = document.querySelector("#account-form-nickname");
    const passwordField = document.querySelector("#account-password-field");
    const passwordInput = document.querySelector("#account-form-password");
    const emailInput = document.querySelector("#account-form-email");
    const codeField = document.querySelector("#account-code-field");
    const codeInput = document.querySelector("#account-form-code");
    let mode = "signin";
    let stage = "credentials";
    let verificationType = "signup";

    function setMessage(text, isError = false) {
      message.textContent = text;
      message.classList.toggle("is-error", isError);
    }

    function render() {
      const verifying = stage === "verify";
      const signup = mode === "signup";
      nicknameField.hidden = !signup || verifying;
      nicknameInput.required = signup && !verifying;
      passwordField.hidden = verifying;
      passwordInput.required = !verifying;
      passwordInput.autocomplete = signup ? "new-password" : "current-password";
      codeField.hidden = !verifying;
      codeInput.required = verifying;
      codeInput.value = verifying ? codeInput.value : "";
      emailInput.readOnly = verifying;
      submit.textContent = verifying
        ? "Подтвердить код"
        : signup
          ? "Создать аккаунт"
          : "Войти";
      modeToggle.hidden = verifying;
      modeToggle.textContent = signup ? "Уже есть аккаунт? Войти" : "Создать аккаунт";
      codeLogin.hidden = signup || verifying;
      codeResend.hidden = !verifying;
      codeBack.hidden = !verifying;
    }

    function setMode(nextMode) {
      mode = nextMode;
      stage = "credentials";
      codeInput.value = "";
      render();
      setMessage("");
    }

    function open(nextMode = "signin", initialMessage = "") {
      setMode(nextMode);
      setMessage(initialMessage);
      if (!dialog.open) dialog.showModal();
      emailInput.focus();
    }

    function startVerification(type) {
      verificationType = type;
      stage = "verify";
      render();
      setMessage(`Введи 6-значный код из письма на ${emailInput.value.trim()}.`);
      codeInput.focus();
    }

    async function sendLoginCode() {
      if (!emailInput.reportValidity()) return;
      if (!supabaseClient) {
        setMessage("Не удалось подключиться к сервису аккаунтов.", true);
        return;
      }

      codeLogin.disabled = true;
      setMessage("Отправляю код на почту...");
      try {
        const { error } = await supabaseClient.auth.signInWithOtp({
          email: emailInput.value.trim(),
          options: { shouldCreateUser: false }
        });
        if (error) throw error;
        startVerification("email");
      } catch (error) {
        console.error("Не удалось отправить код входа.", error);
        setMessage(getErrorMessage(error), true);
      } finally {
        codeLogin.disabled = false;
      }
    }

    async function resendCode() {
      codeResend.disabled = true;
      setMessage("Отправляю новый код...");
      try {
        let result;
        if (verificationType === "signup") {
          result = await supabaseClient.auth.resend({
            type: "signup",
            email: emailInput.value.trim()
          });
        } else {
          result = await supabaseClient.auth.signInWithOtp({
            email: emailInput.value.trim(),
            options: { shouldCreateUser: false }
          });
        }
        if (result.error) throw result.error;
        setMessage("Новый код отправлен. Проверь почту.");
      } catch (error) {
        console.error("Не удалось повторно отправить код.", error);
        setMessage(getErrorMessage(error), true);
      } finally {
        codeResend.disabled = false;
      }
    }

    function getErrorMessage(error) {
      if (/invalid.*credentials|invalid login credentials/i.test(error.message || "")) {
        return "Неверная почта или пароль.";
      }
      if (/email not confirmed/i.test(error.message || "")) {
        return "Сначала подтверди почту кодом из письма о регистрации.";
      }
      if (/token.*(expired|invalid)|otp.*(expired|invalid)/i.test(error.message || "")) {
        return "Код неверный или устарел. Проверь письмо или запроси новый.";
      }
      if (/already registered|user already exists/i.test(error.message || "")) {
        return "Эта почта уже зарегистрирована. Войди по паролю или запроси код.";
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
      codeLogin.disabled = true;
      codeResend.disabled = true;
      try {
        const email = emailInput.value.trim();
        if (stage === "verify") {
          setMessage("Проверяю код...");
          const { data, error } = await supabaseClient.auth.verifyOtp({
            email,
            token: codeInput.value.trim(),
            type: verificationType
          });
          if (error) throw error;
          if (!data.session) throw new Error("verification_session_missing");
          form.reset();
          setMessage("Почта подтверждена. Вхожу в аккаунт...");
          return;
        }

        const password = passwordInput.value;
        if (mode === "signup") {
          const nickname = window.SGAccountRules.normalizeNickname(nicknameInput.value);
          const nicknameError = window.SGAccountRules.validateNickname(nickname);
          if (nicknameError) {
            setMessage(nicknameError, true);
            return;
          }
          setMessage("Создаю аккаунт и отправляю код...");
          const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { nickname } }
          });
          if (error) throw error;
          if (!data.session) {
            if (data.user?.identities?.length === 0) {
              throw new Error("user_already_registered");
            }
            startVerification("signup");
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
          ? "Эта почта уже зарегистрирована. Войди по паролю или запроси код."
          : error.message === "verification_session_missing"
            ? "Не удалось завершить вход. Запроси новый код."
            : getErrorMessage(error), true);
      } finally {
        submit.disabled = false;
        modeToggle.disabled = false;
        codeLogin.disabled = false;
        codeResend.disabled = false;
      }
    });

    modeToggle.addEventListener("click", () => {
      setMode(mode === "signin" ? "signup" : "signin");
    });
    codeLogin.addEventListener("click", sendLoginCode);
    codeResend.addEventListener("click", resendCode);
    codeBack.addEventListener("click", () => setMode(mode));
    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
    });

    return { open };
  }
};
