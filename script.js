(() => {
  const emotionSet = {
    joy: { label: "喜", emojis: ["😀","😄","😁","😊","😃","🙂"] },
    anger: { label: "怒", emojis: ["😠","😡","😤","🤬"] },
    sadness: { label: "哀", emojis: ["😢","😞","😔","😭","☹️"] },
    fear: { label: "惧", emojis: ["😱","😨","😰","😧"] },
    disgust: { label: "厌", emojis: ["🤢","🤮","😖","😣"] },
    surprise: { label: "惊", emojis: ["😮","😯","😲","😳"] },
  };

  const emotionOrder = ["joy","anger","sadness","fear","disgust","surprise"];
  const maskEmoji = "😐";

  const els = {
    difficulty: document.getElementById("difficulty"),
    customRow: document.getElementById("custom-row"),
    flashMs: document.getElementById("flashMs"),
    maskMs: document.getElementById("maskMs"),
    rounds: document.getElementById("rounds"),
    startBtn: document.getElementById("startBtn"),
    restartBtn: document.getElementById("restartBtn"),

    roundLabel: document.getElementById("roundLabel"),
    scoreLabel: document.getElementById("scoreLabel"),
    rtLabel: document.getElementById("rtLabel"),

    stage: document.querySelector(".stage"),
    stimulus: document.getElementById("stimulus"),
    choices: Array.from(document.querySelectorAll(".choice")),

    feedback: document.getElementById("feedback"),
    result: document.getElementById("result"),
    accuracy: document.getElementById("accuracy"),
    avgRt: document.getElementById("avgRt"),
    detailsList: document.getElementById("detailsList"),
  };

  const state = {
    isPlaying: false,
    awaitingResponse: false,
    totalRounds: 12,
    currentRoundIndex: 0,
    score: 0,
    flashDurationMs: 500,
    maskDurationMs: 300,
    currentTarget: null,
    timers: new Set(),
    responseStartTs: 0,
    history: [],
  };

  function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function clearTimers() {
    for (const t of state.timers) clearTimeout(t);
    state.timers.clear();
  }

  function setChoicesEnabled(enabled) {
    for (const btn of els.choices) btn.disabled = !enabled;
  }

  function updateStatus() {
    els.roundLabel.textContent = `${Math.min(state.currentRoundIndex, state.totalRounds)} / ${state.totalRounds}`;
    els.scoreLabel.textContent = `${state.score}`;
  }

  function showFeedback(text, ok) {
    els.feedback.textContent = text;
    els.feedback.classList.toggle("ok", !!ok);
    els.feedback.classList.toggle("bad", ok === false);
  }

  function resetChoiceStyles() {
    els.choices.forEach(b => b.classList.remove("correct","wrong"));
  }

  function applyDifficultyFromUI() {
    const diff = els.difficulty.value;
    if (diff === "novice") state.flashDurationMs = 500;
    else if (diff === "intermediate") state.flashDurationMs = 300;
    else if (diff === "expert") state.flashDurationMs = 200;
    else if (diff === "custom") state.flashDurationMs = clampMs(parseInt(els.flashMs.value || "250", 10));

    state.maskDurationMs = clampMs(parseInt(els.maskMs.value || "300", 10));

    function clampMs(ms) {
      if (Number.isNaN(ms)) return 250;
      return Math.max(30, Math.min(ms, 2000));
    }
  }

  function startGame() {
    clearTimers();
    applyDifficultyFromUI();
    state.isPlaying = true;
    state.awaitingResponse = false;
    state.totalRounds = Math.max(1, Math.min(parseInt(els.rounds.value || "12", 10), 100));
    state.currentRoundIndex = 0;
    state.score = 0;
    state.history = [];
    els.result.hidden = true;
    els.feedback.textContent = "";
    els.stimulus.textContent = "准备";
    resetChoiceStyles();
    updateStatus();
    setChoicesEnabled(false);

    nextRound();
  }

  function endGame() {
    state.isPlaying = false;
    state.awaitingResponse = false;
    setChoicesEnabled(false);

    const correctTrials = state.history.filter(h => h.correct);
    const meanRt = correctTrials.length
      ? Math.round(correctTrials.reduce((s, h) => s + h.rt, 0) / correctTrials.length)
      : null;
    const accuracy = state.history.length ? Math.round((state.score / state.history.length) * 100) : 0;

    els.accuracy.textContent = `${accuracy}%`;
    els.avgRt.textContent = meanRt != null ? `${meanRt} ms` : "—";

    const fragment = document.createDocumentFragment();
    state.history.forEach((h, i) => {
      const row = document.createElement("div");
      row.textContent = `${String(i + 1).padStart(2, "0")} | 目标:${emotionSet[h.target].label} ` +
        `选择:${emotionSet[h.choice].label} | ${(h.correct ? "✔" : "✘")} | RT:${h.rt}ms`;
      row.style.color = h.correct ? "#29cc8b" : "#ff8a8a";
      fragment.appendChild(row);
    });
    els.detailsList.replaceChildren(fragment);

    els.result.hidden = false;
    showFeedback(`本轮结束！准确率 ${accuracy}%`, true);
  }

  function nextRound() {
    if (state.currentRoundIndex >= state.totalRounds) {
      endGame();
      return;
    }

    resetChoiceStyles();
    setChoicesEnabled(false);
    els.rtLabel.textContent = "—";
    showFeedback("", true);

    state.currentRoundIndex += 1;
    updateStatus();

    const target = pickRandom(emotionOrder);
    const emoji = pickRandom(emotionSet[target].emojis);
    state.currentTarget = target;

    // Flash sequence
    els.stimulus.textContent = emoji;
    const t1 = setTimeout(() => {
      els.stimulus.textContent = state.maskDurationMs > 0 ? maskEmoji : "";

      const t2 = setTimeout(() => {
        els.stimulus.textContent = "?";
        state.awaitingResponse = true;
        state.responseStartTs = performance.now();
        setChoicesEnabled(true);
      }, state.maskDurationMs);

      state.timers.add(t2);
    }, state.flashDurationMs);

    state.timers.add(t1);
  }

  function onChoose(choice) {
    if (!state.isPlaying || !state.awaitingResponse) return;
    state.awaitingResponse = false;
    setChoicesEnabled(false);

    const rt = Math.max(0, Math.round(performance.now() - state.responseStartTs));
    const correct = choice === state.currentTarget;
    if (correct) state.score += 1;

    els.rtLabel.textContent = `${rt} ms`;
    updateStatus();

    const correctBtn = els.choices.find(b => b.dataset.emotion === state.currentTarget);
    const chosenBtn = els.choices.find(b => b.dataset.emotion === choice);
    if (correctBtn) correctBtn.classList.add("correct");
    if (chosenBtn && !correct) chosenBtn.classList.add("wrong");

    showFeedback(correct ? "正确！" : `错误，正确是「${emotionSet[state.currentTarget].label}」`, correct);

    state.history.push({
      round: state.currentRoundIndex,
      target: state.currentTarget,
      choice,
      correct,
      rt,
    });

    const t = setTimeout(() => nextRound(), 650);
    state.timers.add(t);
  }

  // UI wiring
  els.difficulty.addEventListener("change", () => {
    const isCustom = els.difficulty.value === "custom";
    els.customRow.hidden = !isCustom;
  });

  els.startBtn.addEventListener("click", () => {
    startGame();
  });

  if (els.restartBtn) {
    els.restartBtn.addEventListener("click", () => {
      startGame();
    });
  }

  els.choices.forEach(btn => {
    btn.addEventListener("click", () => onChoose(btn.dataset.emotion));
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    // ignore if typing in input
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;

    if (e.code === "Space") {
      e.preventDefault();
      if (!state.isPlaying) startGame();
      return;
    }
    if (e.key === "r" || e.key === "R") {
      if (!state.isPlaying) startGame();
      return;
    }

    const keyMap = {
      "1": "joy",
      "2": "anger",
      "3": "sadness",
      "4": "fear",
      "5": "disgust",
      "6": "surprise",
    };
    if (keyMap[e.key]) {
      e.preventDefault();
      onChoose(keyMap[e.key]);
    }
  });
})();
