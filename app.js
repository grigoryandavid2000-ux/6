const questions = window.EXAM_QUESTIONS || [];

const state = {
  index: 0,
  recognition: null,
  listening: false,
  transcriptBase: "",
  sessionFinal: "",
};

const el = {
  progressText: document.querySelector("#progressText"),
  lastScore: document.querySelector("#lastScore"),
  questionText: document.querySelector("#questionText"),
  modeLabel: document.querySelector("#modeLabel"),
  prevBtn: document.querySelector("#prevBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  micBtn: document.querySelector("#micBtn"),
  voiceTestBtn: document.querySelector("#voiceTestBtn"),
  copyUrlBtn: document.querySelector("#copyUrlBtn"),
  checkBtn: document.querySelector("#checkBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  studentAnswer: document.querySelector("#studentAnswer"),
  voiceStatus: document.querySelector("#voiceStatus"),
  meterFill: document.querySelector("#meterFill"),
  verdictTitle: document.querySelector("#verdictTitle"),
  verdictText: document.querySelector("#verdictText"),
  matchedList: document.querySelector("#matchedList"),
  missingList: document.querySelector("#missingList"),
  professorNote: document.querySelector("#professorNote"),
  answerPlan: document.querySelector("#answerPlan"),
  variantList: document.querySelector("#variantList"),
  mistakeList: document.querySelector("#mistakeList"),
  searchInput: document.querySelector("#searchInput"),
  questionList: document.querySelector("#questionList"),
};

const stopWords = new Set(
  "а без более был была были быть в во вот для до его ее если же за из или им их к как ко ли на но о об от по при с со так то у что это этот эта эти не и по сути также либо оно она они".split(" ")
);

const legalTerms = [
  "гк", "кодекс", "статья", "право", "обязанность", "ответственность", "договор",
  "сделка", "собственность", "субъект", "объект", "вина", "убытки", "срок",
  "недействительность", "исковая", "давность", "залог", "поручительство",
  "юридическое лицо", "гражданин", "вещные права", "обязательство", "защита",
  "правоспособность", "дееспособность", "равенство", "добросовестность"
];

const conceptGroups = [
  ["равенство", "равные", "юридическое равенство", "не подчиняются"],
  ["автономия воли", "свобода", "самостоятельно", "по своей воле"],
  ["имущественная самостоятельность", "имущество", "имущественные"],
  ["диспозитивный", "диспозитивность", "дозволительный"],
  ["добросовестность", "разумность", "справедливость"],
  ["возникает", "основание", "юридический факт"],
  ["прекращается", "последствие", "недействительность"],
  ["защита", "иск", "суд", "восстановление"],
  ["субъект", "участник", "сторона"],
  ["объект", "вещь", "имущество", "благо"],
  ["содержание", "права", "обязанности"],
];

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text) {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 3 && !stopWords.has(word));
}

function stem(word) {
  if (word.length <= 6) return word;
  return word.slice(0, word.length > 10 ? 7 : 6);
}

function splitSentences(text) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+|;\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);
}

function getKeyPoints(answer) {
  const lines = answer
    .split(/\n+/)
    .flatMap(splitSentences)
    .map((line) => line.replace(/^[-–—•\d.)\s|]+/, "").trim())
    .filter((line) => line.length > 18);

  const points = lines.slice(0, 14).map((line) => ({
    text: line,
    keys: [...new Set(words(line))].slice(0, 10),
  }));

  return points.filter((point) => point.keys.length >= 2);
}

function hasConcept(textNorm, group) {
  return group.some((item) => textNorm.includes(normalize(item)));
}

function evaluate(student, question, reference) {
  const studentNorm = normalize(student);
  const studentWords = new Set(words(student));
  const studentStems = new Set([...studentWords].map(stem));
  const points = getKeyPoints(reference);

  const checked = points.map((point) => {
    const hits = point.keys.filter((key) => studentWords.has(key) || studentStems.has(stem(key)) || studentNorm.includes(key));
    return {
      ...point,
      hits,
      ok: hits.length >= Math.max(2, Math.ceil(point.keys.length * 0.32)),
    };
  });

  const matched = checked.filter((point) => point.ok);
  const missing = checked.filter((point) => !point.ok);
  const termHits = legalTerms.filter((term) => studentNorm.includes(normalize(term))).length;
  const conceptHits = conceptGroups.filter((group) => hasConcept(studentNorm, group)).length;
  const structureMarkers = ["понят", "вид", "услов", "послед", "сторон", "защит", "основан", "элемент", "признак", "классиф"]
    .filter((marker) => studentNorm.includes(marker)).length;
  const questionTerms = [...new Set(words(question))].filter((term) => studentNorm.includes(term) || studentStems.has(stem(term))).length;

  const coverage = points.length ? matched.length / points.length : 0;
  const lengthScore = Math.min(1, words(student).length / 90);
  const score = Math.round(Math.min(100, coverage * 62 + lengthScore * 13 + termHits * 1.6 + conceptHits * 2.2 + structureMarkers * 1.5 + questionTerms * 1.2));

  return { score, matched, missing, termHits, conceptHits, structureMarkers };
}

function buildAnswerPlan(question, reference) {
  const first = splitSentences(reference)[0] || "Дайте краткое определение института своими словами.";
  const normMatches = [...reference.matchAll(/ст\.?\s*\d+(?:[.–-]\d+)?\s*ГК РФ/gi)].map((match) => match[0]);
  const norms = [...new Set(normMatches)].slice(0, 3);
  const q = normalize(question);
  const plan = [`Начните с определения: ${first}`];

  if (norms.length) {
    plan.push(`Назовите правовую опору: ${norms.join(", ")}.`);
  } else {
    plan.push("Если точную статью не помните, не выдумывайте номер: скажите, что институт раскрывается нормами ГК РФ, и объясните содержание.");
  }

  if (q.includes("вид") || q.includes("классиф")) plan.push("Дайте классификацию и кратко поясните, чем виды отличаются друг от друга.");
  if (q.includes("основан") || q.includes("возник")) plan.push("Назовите основания возникновения и покажите, какие юридические факты запускают последствия.");
  if (q.includes("субъект") || q.includes("лиц") || q.includes("граждан")) plan.push("Отдельно раскройте субъектный состав: кто участвует, какой объем прав и обязанностей имеет.");
  if (q.includes("сделк") || q.includes("договор")) plan.push("Обязательно проговорите условия действительности, форму, последствия нарушения и роль воли сторон.");
  if (q.includes("ответствен") || q.includes("вред") || q.includes("убыт")) plan.push("Разберите состав ответственности: вред, противоправность, причинную связь, вину и возможные исключения.");
  if (q.includes("собствен") || q.includes("вещ")) plan.push("Покажите связь с вещным правом: объект, правомочия, пределы осуществления и способы защиты.");

  plan.push("Закончите практическим выводом: зачем институт нужен в гражданском обороте и какое последствие наступает при нарушении.");
  return [...new Set(plan)].slice(0, 6);
}

function buildVariants(question, reference) {
  const first = splitSentences(reference)[0] || "";
  const variants = [];
  if (first) variants.push(`Можно начать так: "${first}"`);
  variants.push("Допустимо отвечать не дословно: важно назвать правовую природу института, его признаки и последствия.");
  variants.push("Хорошая устная формула: сначала определение, затем элементы, виды или основания, затем пример из гражданского оборота.");

  const q = normalize(question);
  if (q.includes("понят")) variants.push("Если забыли легальное определение, дайте доктринальное: через сущность, участников и юридический результат.");
  if (q.includes("вид")) variants.push("Виды лучше давать парами противопоставлений: абсолютные и относительные, ничтожные и оспоримые, долевые и солидарные.");
  if (q.includes("защит")) variants.push("По защите прав называйте не только суд, но и конкретный способ: признание права, взыскание убытков, виндикация, негаторный иск.");
  if (q.includes("договор")) variants.push("По договору всегда работает связка: свобода договора, согласование существенных условий, оферта и акцепт.");

  return variants.slice(0, 6);
}

function buildMistakes(question, missing, score) {
  const q = normalize(question);
  const mistakes = [];

  if (score < 65) mistakes.push("Ответ слишком общий: есть бытовое понимание, но мало юридических признаков.");
  if (missing.length) mistakes.push(`Не раскрыт обязательный тезис: ${missing[0].text}`);
  if (q.includes("понят") && score < 70) mistakes.push("Не ограничивайтесь примером: экзаменатор сначала ждет определение.");
  if (q.includes("вид") && score < 82) mistakes.push("Не называйте виды списком без критерия деления.");
  if (q.includes("сделк")) mistakes.push("Типичная ошибка по сделкам: забыть форму, волю/волеизъявление и последствия недействительности.");
  if (q.includes("ответствен")) mistakes.push("Типичная ошибка по ответственности: смешать основание ответственности и условия ее наступления.");
  if (q.includes("собствен")) mistakes.push("Типичная ошибка по собственности: не назвать владение, пользование и распоряжение.");
  if (q.includes("юридическ") || q.includes("лиц")) mistakes.push("По юридическим лицам важно не забыть обособленное имущество, самостоятельную ответственность и выступление в обороте от своего имени.");

  mistakes.push("Не придумывайте точные статьи, если не уверены: лучше уверенно раскрыть смысл нормы.");
  return [...new Set(mistakes)].slice(0, 7);
}

function renderQuestion() {
  const current = questions[state.index];
  el.progressText.textContent = `${state.index + 1} / ${questions.length}`;
  el.questionText.textContent = current.question;
  el.modeLabel.textContent = `вопрос ${current.id}`;
  el.prevBtn.disabled = state.index === 0;
  el.nextBtn.disabled = state.index === questions.length - 1;
  document.body.classList.remove("checked");
  el.verdictTitle.textContent = "Готов принять ответ";
  el.verdictText.textContent = "Сначала ответьте голосом или текстом. После проверки я разберу ответ как преподаватель: что зачтется, что слабое, как сформулировать лучше.";
  el.professorNote.textContent = "Я не показываю готовый ответ рядом с вопросом, чтобы тренировка была похожа на реальный экзамен.";
  fillList(el.matchedList, [], "matched");
  fillList(el.missingList, [], "missing");
  renderList();
}

function setTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelector(`#${name}Panel`).classList.add("active");
}

function setMeter(score) {
  el.meterFill.style.width = `${score}%`;
  el.meterFill.style.background = score >= 75 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)";
}

function renderFeedback(result) {
  const current = questions[state.index];
  const { score, matched, missing } = result;
  el.lastScore.textContent = `${score}%`;
  setMeter(score);

  if (score >= 82) {
    el.verdictTitle.textContent = "Ответ уверенный";
    el.verdictText.textContent = "Суть раскрыта. Такой ответ можно принимать: есть юридическая логика, терминология и достаточно содержания.";
  } else if (score >= 50) {
    el.verdictTitle.textContent = "Зачетно, но нужно усилить";
    el.verdictText.textContent = "Основной смысл есть, но для вузовского ответа не хватает отдельных признаков, классификации, нормы или последствий.";
  } else {
    el.verdictTitle.textContent = "Пока слабовато";
    el.verdictText.textContent = "Ответ похож на общую ориентацию в теме. Нужно говорить как юрист: определение, элементы, виды, основания и последствия.";
  }

  fillList(el.matchedList, matched.slice(0, 6), "matched");
  fillList(el.missingList, missing.slice(0, 7), "missing");
  el.professorNote.textContent = makeProfessorNote(score, missing);
  fillOrderedList(el.answerPlan, buildAnswerPlan(current.question, current.answer));
  fillList(el.variantList, buildVariants(current.question, current.answer), "варианты");
  fillList(el.mistakeList, buildMistakes(current.question, missing, score), "ошибки");
  document.body.classList.add("checked");
  setTab("feedback");
}

function fillOrderedList(list, items) {
  list.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  });
}

function fillList(list, items, fallback) {
  list.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = fallback === "matched" ? "Пока сильных совпадений мало." : "Ключевые тезисы закрыты.";
    list.append(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = typeof item === "string" ? item : item.text;
    list.append(li);
  });
}

function makeProfessorNote(score, missing) {
  if (score >= 82) {
    return "Я бы принял такой ответ. Чтобы звучать еще сильнее, добавьте точную норму ГК РФ и один короткий пример из практики гражданского оборота.";
  }

  const firstGap = missing[0]?.text;
  if (firstGap) {
    return `Главный пробел: ${firstGap} На экзамене это лучше не обходить: преподаватель обычно ждет именно этот смысловой блок.`;
  }

  return "Говорите не набором терминов, а юридической логикой: что это, кто участвует, на каком основании возникает и чем заканчивается нарушение.";
}

function renderList() {
  const query = normalize(el.searchInput.value);
  el.questionList.innerHTML = "";
  questions
    .filter((item) => !query || normalize(item.question).includes(query))
    .forEach((item) => {
      const realIndex = questions.findIndex((q) => q.id === item.id);
      const button = document.createElement("button");
      button.className = `question-row ${realIndex === state.index ? "active" : ""}`;
      button.type = "button";

      const number = document.createElement("span");
      number.textContent = item.id;
      const title = document.createElement("strong");
      title.textContent = item.question;
      button.append(number, title);

      button.addEventListener("click", () => {
        state.index = realIndex;
        renderQuestion();
        setTab("feedback");
      });
      el.questionList.append(button);
    });
}

function voiceErrorMessage(error) {
  const messages = {
    "not-allowed": "Браузер запретил микрофон. Нажмите значок замка рядом с адресом сайта и разрешите микрофон для localhost.",
    "service-not-allowed": "Сервис распознавания речи заблокирован браузером. Откройте сайт в обычном Chrome или Edge.",
    "no-speech": "Речь не распознана. Попробуйте говорить ближе к микрофону и без длинной паузы в начале.",
    "audio-capture": "Браузер не видит микрофон. Проверьте, выбран ли микрофон в Windows и не занят ли он другим приложением.",
    network: "Сервис распознавания речи не ответил. В Chrome распознавание может требовать интернет.",
    aborted: "Запись остановлена.",
  };
  return messages[error] || `Голосовой ввод остановлен: ${error}. Можно продолжить текстом или через Win + H.`;
}

async function testMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    el.voiceStatus.textContent = "Этот браузер не дает сайту проверить микрофон. Откройте http://localhost:8787/ в Chrome или Edge.";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    el.voiceStatus.textContent = "Микрофон доступен. Теперь нажмите «Начать голосовой ответ» и говорите.";
  } catch (error) {
    el.voiceStatus.textContent = error.name === "NotAllowedError"
      ? "Доступ к микрофону запрещен. Разрешите микрофон для localhost в настройках сайта."
      : `Микрофон не проверен: ${error.message || error.name}. Попробуйте Chrome/Edge или диктовку Win + H.`;
  }
}

async function ensureMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Браузер не дает сайту доступ к микрофону. Откройте http://localhost:8787/ в Chrome или Edge.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";

  if (!isLocalhost && location.protocol !== "https:") {
    el.voiceStatus.textContent = "Голосовой ввод не запустится из file://. Откройте сайт по адресу http://localhost:8787/ в Chrome или Edge.";
  }

  if (!SpeechRecognition) {
    el.micBtn.disabled = true;
    el.voiceStatus.textContent = "В этом браузере нет Web Speech API. Откройте http://localhost:8787/ в Chrome или Edge либо используйте Win + H для диктовки в поле ответа.";
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.lang = "ru-RU";
  state.recognition.interimResults = true;
  state.recognition.continuous = true;
  state.recognition.maxAlternatives = 1;

  state.recognition.onstart = () => {
    state.listening = true;
    state.transcriptBase = el.studentAnswer.value.trim();
    state.sessionFinal = "";
    el.micBtn.textContent = "■ Остановить запись";
    el.micBtn.classList.add("recording");
    el.voiceStatus.textContent = "Слушаю ответ. Говорите как на экзамене: определение, признаки, виды, последствия.";
  };

  state.recognition.onresult = (event) => {
    let finalText = "";
    let interim = "";
    for (let i = 0; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += `${text} `;
      else interim += text;
    }
    state.sessionFinal = finalText.trim();
    const base = state.transcriptBase ? `${state.transcriptBase}\n` : "";
    el.studentAnswer.value = `${base}${state.sessionFinal} ${interim}`.replace(/\s+/g, " ").trim();
  };

  state.recognition.onerror = (event) => {
    el.voiceStatus.textContent = voiceErrorMessage(event.error);
  };

  state.recognition.onend = () => {
    state.listening = false;
    el.micBtn.textContent = "● Начать голосовой ответ";
    el.micBtn.classList.remove("recording");
    if (!el.studentAnswer.value.trim()) {
      el.voiceStatus.textContent += " Если текст не появился, используйте кнопку проверки микрофона или диктовку Windows: Win + H.";
    }
  };
}

el.prevBtn.addEventListener("click", () => {
  state.index = Math.max(0, state.index - 1);
  renderQuestion();
});

el.nextBtn.addEventListener("click", () => {
  state.index = Math.min(questions.length - 1, state.index + 1);
  renderQuestion();
});

el.shuffleBtn.addEventListener("click", () => {
  state.index = Math.floor(Math.random() * questions.length);
  renderQuestion();
});

el.checkBtn.addEventListener("click", () => {
  const answer = el.studentAnswer.value.trim();
  if (!answer) {
    el.voiceStatus.textContent = "Сначала дайте ответ, хотя бы кратко.";
    return;
  }
  const current = questions[state.index];
  renderFeedback(evaluate(answer, current.question, current.answer));
});

el.clearBtn.addEventListener("click", () => {
  el.studentAnswer.value = "";
  el.lastScore.textContent = "-";
  setMeter(0);
});

el.micBtn.addEventListener("click", async () => {
  if (!state.recognition) return;
  try {
    if (state.listening) {
      state.recognition.stop();
    } else {
      el.voiceStatus.textContent = "Проверяю доступ к микрофону...";
      await ensureMicrophoneAccess();
      el.voiceStatus.textContent = "Микрофон доступен, запускаю распознавание речи...";
      state.recognition.start();
    }
  } catch (error) {
    el.voiceStatus.textContent = error.name === "InvalidStateError"
      ? "Запись уже запущена. Нажмите «Остановить запись» и начните заново."
      : `Не удалось запустить голосовой ввод: ${error.message || error.name}. Разрешите микрофон для localhost или откройте сайт в обычном Chrome/Edge.`;
  }
});

el.voiceTestBtn.addEventListener("click", testMicrophone);

el.copyUrlBtn.addEventListener("click", async () => {
  const url = "http://localhost:8787/";
  try {
    await navigator.clipboard.writeText(url);
    el.voiceStatus.textContent = "Адрес скопирован. Откройте его в Chrome или Edge: http://localhost:8787/";
  } catch {
    el.voiceStatus.textContent = "Откройте сайт в Chrome или Edge по адресу: http://localhost:8787/";
  }
});

el.searchInput.addEventListener("input", renderList);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setTab(tab.dataset.tab));
});

setupSpeech();
renderQuestion();
