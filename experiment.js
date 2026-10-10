// Automated Symmetry Span task, using jsPsych 8.

const DEFAULT_CONFIG = {
  spans: [1, 2, 3, 4, 5, 6, 7],
  repetitionsPerSpan: 2,
  combinedPracticeTrials: 2,
  stimulusDuration: 800,
  interStimulusInterval: 250,
  qualtricsReturnUrl: "https://merceruniversity.co1.qualtrics.com/jfe/form/SV_1zccezoNm8UGOrA"
};

const config = Object.assign({}, DEFAULT_CONFIG, window.SYMMETRY_SPAN_CONFIG || {});
const task = window.SymmetrySpan;
if (!task) throw new Error("Load modules/symmetrySpan.js before experiment.js.");

const jsPsych = initJsPsych({
  on_finish: function () {
    console.log(jsPsych.data.get().csv());
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
  const mainMemoryItems = config.spans.reduce((sum, span) => sum + span, 0) *
    config.repetitionsPerSpan;
  if (mainMemoryItems % 2 !== 0) {
    throw new Error("The configured main-task item count must be even to balance symmetry categories exactly.");
  }
}

function addInstructions(title, paragraphs, phase, button = "Continue") {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `<section class="instruction-panel"><h1>${title}</h1>${paragraphs.map(text => `<p>${text}</p>`).join("")}</section>`,
    choices: [button],
    data: { phase, trialType: "instruction", screen: title }
  });
}

function addSymmetryTrial({
  practice,
  phase,
  isSymmetric,
  showFeedback = false,
  sequenceId = null,
  sequenceLength = null,
  sequenceIndex = null
}) {
  const trialId = `symmetry-${nextTrialId++}`;
  const grid = task.generateSymmetryGrid(isSymmetric);
  const correctAnswer = task.isSymmetricalGrid(grid);
  if (correctAnswer !== isSymmetric) {
    throw new Error(`Symmetry generator produced an invalid grid for ${trialId}.`);
  }

  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `<section class="task-panel"><h2>Symmetry judgment</h2><p class="instructions">Is the grid symmetrical across its vertical axis?</p>${task.renderSymmetryGrid(grid)}</section>`,
    choices: ["Symmetrical", "Not symmetrical"],
    data: {
      trialId,
      trialType: "symmetry",
      taskType: phase === "symmetry-only" ? "symmetry-only" : "combined",
      phase,
      practice,
      sequenceId,
      sequenceLength,
      sequenceIndex,
      gridMatrix: JSON.stringify(grid),
      correctAnswer,
      correctAnswerLabel: correctAnswer ? "Symmetrical" : "Not symmetrical"
    },
    on_finish: function (data) {
      data.participantResponse = data.response === 0 ? "Symmetrical" :
        data.response === 1 ? "Not symmetrical" : null;
      data.accuracy = data.participantResponse === data.correctAnswerLabel;
    }
  });

  if (showFeedback) {
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: function () {
        const result = jsPsych.data.get().last(1).values()[0];
        return `<section class="feedback-panel"><h2>${result.accuracy ? "Correct" : "Not quite"}</h2><p>The grid was ${result.correctAnswerLabel.toLowerCase()}.</p></section>`;
      },
      choices: ["Continue"],
      data: { phase, practice: true, trialType: "practice-feedback" }
    });
  }
}

function addMemoryPresentation(position, details) {
  const trialId = `memory-${nextTrialId++}`;
  let onsetTimestamp;
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<section class="task-panel"><h2>Remember this square</h2>${task.renderMemorySquare(position)}</section>`,
    choices: "NO_KEYS",
    trial_duration: config.stimulusDuration,
    data: {
      trialId,
      trialType: "memory-presentation",
      taskType: details.taskType,
      phase: details.phase,
      practice: details.practice,
      sequenceId: details.sequenceId,
      sequenceLength: details.sequenceLength,
      sequenceIndex: details.sequenceIndex,
      presentedLocation: position
    },
    on_load: function () {
      onsetTimestamp = new Date().toISOString();
    },
    on_finish: function (data) {
      data.timestamp = onsetTimestamp;
    }
  });
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: "",
    choices: "NO_KEYS",
    trial_duration: config.interStimulusInterval,
    data: {
      trialId: `${trialId}-isi`,
      trialType: "memory-interval",
      taskType: details.taskType,
      phase: details.phase,
      practice: details.practice,
      sequenceId: details.sequenceId,
      sequenceIndex: details.sequenceIndex
    }
  });
}

function addRecallTrial(sequence, details) {
  const trialId = `recall-${nextTrialId++}`;
  let recallOnset;
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function () {
      return createRecallGrid(sequence.length);
    },
    choices: "NO_KEYS",
    data: {
      trialId,
      trialType: "recall",
      taskType: details.taskType,
      phase: details.phase,
      practice: details.practice,
      sequenceId: details.sequenceId,
      sequenceLength: sequence.length,
      presentedSequence: JSON.stringify(sequence)
    },
    on_load: function () {
      recallOnset = performance.now();
      initializeRecallGrid(sequence.length, function (selected, responseOrder, recallReactionTime) {
        const scores = task.scoreSquareRecall(sequence, selected);
        jsPsych.finishTrial({
          trialId,
          trialType: "recall",
          taskType: details.taskType,
          phase: details.phase,
          practice: details.practice,
          sequenceId: details.sequenceId,
          sequenceLength: sequence.length,
          presentedSequence: sequence,
          selectedSequence: selected,
          responseOrder,
          recallReactionTime,
          recallStartedAt: new Date(Date.now() - (performance.now() - recallOnset)).toISOString(),
          ...scores
        });
      });
    }
  });
}

function addMemoryOnlyTrial() {
  const sequence = task.generateMemorySequence(2);
  const sequenceId = `sequence-${nextSequenceId++}`;
  sequence.forEach((position, index) => addMemoryPresentation(position, {
    practice: true,
    phase: "memory-only",
    taskType: "memory-only",
    sequenceId,
    sequenceLength: sequence.length,
    sequenceIndex: index + 1
  }));
  addRecallTrial(sequence, { practice: true, phase: "memory-only", taskType: "memory-only", sequenceId });
  addRecallFeedback("memory-only");
}

function addRecallFeedback(phase) {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const result = jsPsych.data.get().last(1).values()[0];
      return `<section class="feedback-panel"><h2>Recall practice</h2><p>You recalled ${result.positionCorrect} of ${result.sequenceLength} locations in the correct positions.</p></section>`;
    },
    choices: ["Continue"],
    data: { phase, practice: true, trialType: "recall-feedback" }
  });
}

function addCombinedTrial(sequenceLength, options) {
  const sequence = task.generateMemorySequence(sequenceLength);
  const sequenceId = `sequence-${nextSequenceId++}`;
  sequence.forEach((position, index) => {
    const isSymmetric = options.symmetryAnswers
      ? options.symmetryAnswers.shift()
      : Math.random() < 0.5;
    if (typeof isSymmetric !== "boolean") {
      throw new Error("No balanced symmetry answer was available for a combined trial.");
    }
    addSymmetryTrial({
      practice: options.practice,
      phase: options.phase,
      isSymmetric,
      showFeedback: false,
      taskType: "combined",
      sequenceId,
      sequenceLength,
      sequenceIndex: index + 1
    });
    addMemoryPresentation(position, {
      practice: options.practice,
      phase: options.phase,
      taskType: "combined",
      sequenceId,
      sequenceLength,
      sequenceIndex: index + 1
    });
  });
  addRecallTrial(sequence, {
    practice: options.practice,
    phase: options.phase,
    taskType: "combined",
    sequenceId
  });
  if (options.practice) addRecallFeedback("combined-practice");
}

function computeParticipantSummary() {
  const allTrials = jsPsych.data.get().values();
  const recallRows = allTrials.filter(row =>
    row.practice === false && row.trialType === "recall"
  );
  const symmetryRows = allTrials.filter(row =>
    row.practice === false && row.trialType === "symmetry"
  );
  return task.computeSummary(recallRows, symmetryRows);
}

function createTrialDataCsvUrl() {
  const csv = jsPsych.data.get().csv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  return URL.createObjectURL(blob);
}

function transferSummaryToQualtrics(summary, returnUrl = config.qualtricsReturnUrl) {
  if (typeof returnUrl !== "string" || !returnUrl.trim()) {
    return null;
  }
  const destination = new URL(returnUrl);
  Object.entries(participantIds).forEach(([key, value]) => {
    if (value) destination.searchParams.set(key, value);
  });
  Object.entries(summary).forEach(([key, value]) => {
    destination.searchParams.set(`SYMMETRY_SPAN_${key}`, String(value));
  });
  return destination.href;
}

function addCompletionTrial() {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const csvUrl = createTrialDataCsvUrl();
      return `<section class="feedback-panel"><h1>Task complete</h1><p>Thank you for completing the Symmetry Span task.</p><p><a class="jspsych-btn csv-download-link" href="${csvUrl}" download="symmetry-span-trial-data.csv">Download trial data (CSV)</a></p><p>Save the CSV before pressing Finish to continue.</p></section>`;
    },
    choices: ["Finish"],
    data: { phase: "completion", trialType: "completion" },
    on_finish: function () {
      const summary = computeParticipantSummary();
      const destination = transferSummaryToQualtrics(summary);
      console.log("Symmetry Span participant summary:", summary);
      if (destination) {
        window.setTimeout(() => {
          window.location.href = destination;
        }, 750);
      }
    }
  });
}

validateConfig();

addInstructions("Welcome to Symmetry Span", [
  "This task measures how well you remember the locations of squares while making symmetry judgments.",
  "For each item, decide whether an 8 × 8 binary grid is symmetrical across its vertical axis. Then remember the location of the highlighted square in a 4 × 4 grid.",
  "After each sequence, select all remembered locations in the order they appeared. The recall grid will not show the correct locations.",
  "You will practice each task on its own before trying them together."
], "welcome");

addInstructions("Symmetry practice", [
  "Judge whether each 8 × 8 grid is symmetrical across its vertical axis. There are three practice trials, so the categories cannot be evenly balanced."
], "symmetry-only", "Begin practice");
const symmetryPracticeTypes = task.shuffle([true, false, Math.random() < 0.5]);
symmetryPracticeTypes.forEach(isSymmetric => addSymmetryTrial({
  practice: true,
  phase: "symmetry-only",
  isSymmetric,
  showFeedback: true
}));

addInstructions("Spatial memory practice", [
  "Each square in a 4 × 4 grid is shown briefly, one at a time. Remember each location and select them in order.",
  "There are three practice sequences. You will see feedback about how many locations you recalled in the correct positions."
], "memory-only", "Begin practice");
for (let i = 0; i < 3; i++) addMemoryOnlyTrial();

addInstructions("Combined practice", [
  "A symmetry judgment will alternate with each highlighted memory square. At the end of the sequence, recall every location in the order presented."
], "combined-practice", "Begin practice");
const combinedPracticeSymmetryAnswers = task.generateBalancedAnswers(
  config.combinedPracticeTrials * 2
);
for (let i = 0; i < config.combinedPracticeTrials; i++) {
  addCombinedTrial(2, {
    practice: true,
    phase: "combined-practice",
    symmetryAnswers: combinedPracticeSymmetryAnswers
  });
}

addInstructions("Main Symmetry Span task", [
  "The main task follows the combined practice procedure. Sequence lengths vary from one to seven locations.",
  "Make each symmetry judgment accurately and do your best to remember the square locations. You will not receive correctness feedback during the main task."
], "main", "Begin task");

const mainSpans = task.shuffle(config.spans.flatMap(span =>
  Array(config.repetitionsPerSpan).fill(span)
));
const mainSymmetryAnswers = task.generateBalancedAnswers(
  mainSpans.reduce((sum, span) => sum + span, 0)
);
const mainSymmetryPlan = [...mainSymmetryAnswers];
mainSpans.forEach((span, index) => {
  addInstructions(`Sequence ${index + 1} of ${mainSpans.length}`, [
    `This sequence contains ${span} square${span === 1 ? "" : "s"}. Remember each location as it appears.`
  ], "main", "Begin sequence");
  addCombinedTrial(span, {
    practice: false,
    phase: "main",
    symmetryAnswers: mainSymmetryAnswers
  });
});

addCompletionTrial();

window.SYMMETRY_SPAN_RUNTIME = Object.freeze({
  config,
  timeline,
  mainSpans,
  mainSymmetryAnswers: mainSymmetryPlan,
  computeParticipantSummary,
  transferSummaryToQualtrics
});
jsPsych.run(timeline);
