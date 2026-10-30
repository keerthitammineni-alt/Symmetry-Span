(function () {
  "use strict";

  const DEFAULT_CONFIG = {
    spans: [3, 4, 5, 6, 7],
    repetitionsPerSpan: 1,
    combinedPracticeTrials: 2,
    stimulusDuration: 800,
    interStimulusInterval: 250,
    qualtricsReturnUrl: "https://merceruniversity.co1.qualtrics.com/jfe/form/SV_1zccezoNm8UGOrA"
  };

  const config = Object.assign({}, DEFAULT_CONFIG, window.SYMMETRY_SPAN_CONFIG || {});
  const task = window.SymmetrySpan;
  if (!task) throw new Error("Load modules/symmetrySpan.js before experiment.js.");

  function validateConfig() {
    if (!Array.isArray(config.spans) || config.spans.length === 0 ||
        config.spans.some(span => !Number.isInteger(span) || span < 1 || span > 7)) {
      throw new Error("SYMMETRY_SPAN_CONFIG.spans must be a non-empty array of integers from 1 to 7.");
    }
    ["repetitionsPerSpan", "combinedPracticeTrials", "stimulusDuration", "interStimulusInterval"]
      .forEach(key => {
        if (!Number.isInteger(config[key]) || config[key] < 0 ||
            ((key === "repetitionsPerSpan" || key === "combinedPracticeTrials") && config[key] < 1)) {
          const requirement = key === "repetitionsPerSpan" || key === "combinedPracticeTrials"
            ? "positive"
            : "non-negative";
          throw new Error(`SYMMETRY_SPAN_CONFIG.${key} must be a ${requirement} integer.`);
        }
      });

    const mainMemoryItems = config.spans.reduce((sum, span) => sum + span, 0) * config.repetitionsPerSpan;
    if (mainMemoryItems % 2 !== 0) {
      throw new Error("The configured main-task item count must be even to balance symmetry categories exactly.");
    }
  }

  validateConfig();

  const jsPsych = initJsPsych({
    on_finish: function () {
      console.log(jsPsych.data.get().csv());

      const values = jsPsych.data.get().values();
      const recallTrials = values.filter(row => row.trialType === "recall" && row.practice === false);
      const symmetryTrials = values.filter(row => row.trialType === "symmetry" && row.practice === false);
      const summary = task.computeSummary(
        recallTrials.map(row => ({
          locationCorrect: Number(row.locationCorrect || 0),
          positionCorrect: Number(row.positionCorrect || 0),
          sequenceLength: Number(row.targetCount || row.sequenceLength || 0),
          exactSequenceAccuracy: Number(row.exactSequenceAccuracy || 0)
        })),
        symmetryTrials.map(row => ({ accuracy: Number(Boolean(row.accuracy)) }))
      );

      const redirectUrl = transferSummaryToQualtrics(summary, config.qualtricsReturnUrl);
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const participantIds = {
    PROLIFIC_PID: urlParams.get("PROLIFIC_PID") || urlParams.get("prolific_pid") || urlParams.get("pid"),
    STUDY_ID: urlParams.get("STUDY_ID") || urlParams.get("study_id"),
    SESSION_ID: urlParams.get("SESSION_ID") || urlParams.get("session_id")
  };

  const timeline = [];
  let nextTrialId = 1;
  let nextSequenceId = 1;

  function makeTrialData({ phase, trialType, taskType, practice, sequenceId = null, ...rest }) {
    const data = {
      phase,
      trialType,
      taskType: taskType || phase,
      practice: Boolean(practice),
      sequenceId,
      trialId: `trial-${nextTrialId++}`
    };
    Object.assign(data, rest);
    return data;
  }

  function instructionTrial(phase, title, body, taskType = phase, buttonText = "Continue") {
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="task-panel task-instructions">
          <h1>${title}</h1>
          <p>${body}</p>
        </div>
      `,
      choices: [buttonText],
      data: makeTrialData({ phase, trialType: "instruction", taskType, practice: false })
    };
  }

  function symmetryMatrix(correctAnswer) {
    return task.generateSymmetryGrid(Boolean(correctAnswer));
  }

  function symmetryTrial({ phase, taskType = "combined", practice = false, sequenceId = null, correctAnswer = true, matrix = null }) {
    const chosenMatrix = matrix || symmetryMatrix(correctAnswer);
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus: function () {
        return `
          <div class="task-panel">
            <h2>Is this pattern symmetrical?</h2>
            ${task.renderSymmetryGrid(chosenMatrix)}
          </div>
        `;
      },
      choices: ["Symmetrical", "Asymmetrical"],
      data: makeTrialData({
        phase,
        trialType: "symmetry",
        taskType,
        practice,
        sequenceId,
        correctAnswer: Boolean(correctAnswer),
        gridMatrix: JSON.stringify(chosenMatrix),
        response: null,
        accuracy: null
      }),
      on_finish: function (data) {
        const response = Number(data.response ?? 0);
        const responseIsSymmetrical = response === 0;
        data.response = responseIsSymmetrical;
        data.responseLabel = responseIsSymmetrical ? "symmetrical" : "asymmetrical";
        data.correctAnswer = Boolean(correctAnswer);
        data.accuracy = Number(responseIsSymmetrical === Boolean(correctAnswer));
      }
    };
  }

  function presentationTrial({ phase, taskType = "combined", practice = false, sequenceId = null, location = 0, duration = config.stimulusDuration }) {
    return {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function () {
        return task.renderMemorySquare(location);
      },
      choices: "NO_KEYS",
      trial_duration: duration,
      response_ends_trial: false,
      data: makeTrialData({
        phase,
        trialType: "memory-presentation",
        taskType,
        practice,
        sequenceId,
        presentedLocation: Number(location),
        sequenceLength: 1
      })
    };
  }

  function recallTrial({ phase, taskType = "combined", practice = false, sequenceId = null, targetCount = 1, prompt = "Recall the square locations" }) {
    return {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function () {
        return createRecallGrid(targetCount, prompt);
      },
      choices: "NO_KEYS",
      trial_duration: null,
      data: makeTrialData({
        phase,
        trialType: "recall",
        taskType,
        practice,
        sequenceId,
        targetCount: Number(targetCount),
        prompt
      }),
      on_load: function () {
        initializeRecallGrid(targetCount, function (responses, responseEvents, elapsedMs) {
          const presented = Array.from({ length: responses.length }, (_, index) => index);
          const score = task.scoreSquareRecall(presented, responses);
          const exactSequenceAccuracy = score.exactSequenceAccuracy;
          jsPsych.finishTrial({
            targetCount,
            sequenceLength: targetCount,
            recalledLocations: JSON.stringify(responses),
            responseEvents: JSON.stringify(responseEvents),
            elapsedMs,
            locationCorrect: score.locationCorrect,
            positionCorrect: score.positionCorrect,
            locationAccuracy: score.locationAccuracy,
            positionAccuracy: score.positionAccuracy,
            exactSequenceAccuracy,
            responseOrder: JSON.stringify(responses),
            submitted: true
          });
        });
      }
    };
  }

  function buildRecallGridMarkup(targetCount, prompt = "Recall the square locations") {
    return `
      <section class="recall-panel">
        <h2>${prompt}</h2>
        <p class="instructions">Select the locations in the order they appeared. Select Blank when you cannot remember a location. You need ${targetCount} response${targetCount === 1 ? "" : "s"}.</p>
        <div class="recall-grid" role="group" aria-label="Four by four recall grid">${Array.from({ length: 16 }, (_, index) => `<button class="recall-cell" type="button" data-position="${index}" aria-label="Row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}"></button>`).join("")}</div>
        <p id="recallResponseString" class="response-string" aria-live="polite"></p>
        <div class="button-row">
          <button id="clearRecallBtn" type="button">Clear</button>
          <button id="blankRecallBtn" type="button">Blank</button>
          <button id="submitRecallBtn" type="button" disabled>Submit</button>
        </div>
      </section>
    `;
  }

  function createRecallGrid(targetCount, prompt = "Recall the square locations") {
    return buildRecallGridMarkup(targetCount, prompt);
  }

  function initializeRecallGrid(targetCount, callback) {
    if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 16) {
      throw new Error("Recall grid target count must be an integer from 1 to 16.");
    }
    if (typeof callback !== "function") {
      throw new Error("Recall grid requires a completion callback.");
    }

    const recallRoot = document.querySelector(".recall-panel");
    if (!recallRoot) {
      return;
    }

    let recallResponses = [];
    let recallResponseEvents = [];
    let recallStartedAt = performance.now();
    let recallSubmitted = false;

    function addRecallResponse(position) {
      if (recallResponses.length >= targetCount || recallResponses.includes(position) ||
          !Number.isInteger(position) || position < 0 || position > 15) {
        return;
      }
      recallResponses.push(position);
      recallResponseEvents.push({ order: recallResponses.length, position, timestampMs: Math.round(performance.now() - recallStartedAt) });
      updateRecallGrid();
    }

    function addBlankResponse() {
      if (recallResponses.length < targetCount) {
        recallResponses.push(null);
        recallResponseEvents.push({ order: recallResponses.length, position: null, timestampMs: Math.round(performance.now() - recallStartedAt) });
        updateRecallGrid();
      }
    }

    function clearRecall() {
      recallResponses = [];
      recallResponseEvents = [];
      updateRecallGrid();
    }

    function updateRecallGrid() {
      recallRoot.querySelectorAll(".recall-cell").forEach(cell => {
        const position = Number(cell.dataset.position);
        const responseIndex = recallResponses.indexOf(position);
        cell.textContent = responseIndex === -1 ? "" : String(responseIndex + 1);
        cell.classList.toggle("is-selected", responseIndex !== -1);
        cell.disabled = recallResponses.length >= targetCount || responseIndex !== -1;
      });

      const display = recallRoot.querySelector("#recallResponseString");
      display.textContent = recallResponses.map(position =>
        position === null ? "Blank" : `R${Math.floor(position / 4) + 1}C${position % 4 + 1}`
      ).join(" → ");
      recallRoot.querySelector("#blankRecallBtn").disabled = recallResponses.length >= targetCount;
      recallRoot.querySelector("#submitRecallBtn").disabled = recallResponses.length !== targetCount;
    }

    function submitRecall() {
      if (!recallSubmitted && recallResponses.length === targetCount) {
        recallSubmitted = true;
        callback([...recallResponses], recallResponseEvents.map(event => ({ ...event })), Math.round(performance.now() - recallStartedAt));
      }
    }

    recallRoot.querySelectorAll(".recall-cell").forEach(cell => {
      cell.addEventListener("click", () => addRecallResponse(Number(cell.dataset.position)));
    });
    recallRoot.querySelector("#clearRecallBtn").addEventListener("click", clearRecall);
    recallRoot.querySelector("#blankRecallBtn").addEventListener("click", addBlankResponse);
    recallRoot.querySelector("#submitRecallBtn").addEventListener("click", submitRecall);
    updateRecallGrid();
  }

  function transferSummaryToQualtrics(summary, destinationUrl) {
    if (!destinationUrl) return "";
    const url = new URL(destinationUrl);
    const params = Object.assign({}, participantIds, summary || {});
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }

  function generateMainPlan() {
    const mainPlan = [];
    config.spans.forEach((span, spanIndex) => {
      for (let repetition = 0; repetition < config.repetitionsPerSpan; repetition++) {
        const sequenceId = nextSequenceId++;
        const correctAnswer = (spanIndex + repetition) % 2 === 0;
        mainPlan.push({
          sequenceId,
          span,
          correctAnswer,
          matrix: symmetryMatrix(correctAnswer)
        });
      }
    });
    return mainPlan;
  }

  function buildPracticeSymmetryTrials() {
    const practiceTrials = [];
    const values = [true, false, true, true, false, false, true, false, true, true, false, true, false, false, true];
    values.forEach((correctAnswer, index) => {
      practiceTrials.push(symmetryTrial({
        phase: "symmetry-practice",
        taskType: "symmetry-practice",
        practice: true,
        sequenceId: `symmetry-practice-${index + 1}`,
        correctAnswer,
        matrix: symmetryMatrix(correctAnswer)
      }));
    });
    return practiceTrials;
  }

  function buildGridPracticeTrials() {
    const practiceTrials = [];
    const lengths = [2, 2, 3, 2, 2];
    lengths.forEach((targetCount, index) => {
      practiceTrials.push(recallTrial({
        phase: "grid-practice",
        taskType: "grid-memory-practice",
        practice: true,
        sequenceId: `grid-practice-${index + 1}`,
        targetCount,
        prompt: "Grid practice recall"
      }));
    });
    return practiceTrials;
  }

  function buildCombinedPracticeTrials() {
    const trials = [];
    for (let index = 0; index < config.combinedPracticeTrials; index++) {
      const sequenceId = `combined-practice-${index + 1}`;
      const correctAnswer = index % 2 === 0;
      trials.push(symmetryTrial({
        phase: "combined-practice",
        taskType: "combined",
        practice: true,
        sequenceId,
        correctAnswer,
        matrix: symmetryMatrix(correctAnswer)
      }));
      trials.push(presentationTrial({
        phase: "combined-practice",
        taskType: "combined",
        practice: true,
        sequenceId,
        location: index % 16,
        duration: config.stimulusDuration
      }));
      trials.push(recallTrial({
        phase: "combined-practice",
        taskType: "combined",
        practice: true,
        sequenceId,
        targetCount: 2,
        prompt: "Combined practice recall"
      }));
    }
    return trials;
  }

  function buildMainTrials() {
    const trials = [];
    const mainPlan = generateMainPlan();
    mainPlan.forEach(({ sequenceId, correctAnswer, matrix, span }) => {
      trials.push(symmetryTrial({
        phase: "main",
        taskType: "combined",
        practice: false,
        sequenceId,
        correctAnswer,
        matrix
      }));
      trials.push(presentationTrial({
        phase: "main",
        taskType: "combined",
        practice: false,
        sequenceId,
        location: sequenceId % 16,
        duration: config.stimulusDuration
      }));
      trials.push(recallTrial({
        phase: "main",
        taskType: "combined",
        practice: false,
        sequenceId,
        targetCount: Number(span),
        prompt: "Main task recall"
      }));
    });
    return trials;
  }

  timeline.push(instructionTrial("welcome", "Welcome", "Welcome to the Symmetry Span task. Press continue to begin."));
  timeline.push(instructionTrial("grid-practice-instructions-1", "Grid practice", "You will see a 4 × 4 grid. Memorize the highlighted square locations."));
  timeline.push(instructionTrial("grid-practice-instructions-2", "Grid practice", "After the grid disappears, click the matching locations in the order they appeared."));
  timeline.push(...buildGridPracticeTrials());
  timeline.push(instructionTrial("symmetry-practice-instructions", "Symmetry practice", "Decide whether each pattern is symmetrical or asymmetrical."));
  timeline.push(...buildPracticeSymmetryTrials());
  timeline.push(instructionTrial("symmetry-practice-feedback", "Practice complete", "Great job. You are ready for the combined task."));
  timeline.push(instructionTrial("combined-practice", "Combined practice", "Now you will judge symmetry and then recall the remembered locations."));
  timeline.push(...buildCombinedPracticeTrials());
  timeline.push(...buildMainTrials());
  timeline.push(instructionTrial("completion", "Completed", "The task is complete. Thank you for participating."));

  window.SYMMETRY_SPAN_RUNTIME = {
    config,
    timeline,
    participantIds,
    transferSummaryToQualtrics,
    buildMainTrials,
    buildPracticeSymmetryTrials,
    buildGridPracticeTrials
  };

  jsPsych.run(timeline);
})();
