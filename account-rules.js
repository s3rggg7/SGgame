window.SGAccountRules = Object.freeze({
  normalizeNickname(value) {
    return value.normalize("NFC").trim();
  },

  validateNickname(value) {
    const nickname = this.normalizeNickname(value);
    if (!/^[A-Za-zА-Яа-яЁё0-9_]{3,16}$/.test(nickname)) {
      return "Ник должен содержать 3–16 русских или латинских букв, цифр либо подчёркиваний.";
    }

    const normalized = nickname.toLocaleLowerCase("ru");
    if (["admin", "administrator", "moderator", "support", "sggames"].includes(normalized)) {
      return "Этот ник зарезервирован. Выбери другой.";
    }

    const blockedParts = [
      "хуй", "хуя", "хуе", "хуи", "хую", "пизд", "еб", "бля", "бляд",
      "сука", "шлюх", "гандон", "fuck", "shit", "bitch", "asshole", "dick", "cunt", "nazi"
    ];
    if (blockedParts.some(part => normalized.includes(part))) {
      return "Этот ник содержит недопустимые слова. Выбери другой.";
    }

    return "";
  }
});
