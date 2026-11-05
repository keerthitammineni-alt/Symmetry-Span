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
    stimulus: `<section class="instruction-panel instruction-page"><div class="instruction-content"><h1>${title}</h1>${paragraphs.map(text => `<p>${text}</p>`).join("")}</div></section>`,
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
    stimulus: `<section class="task-panel"><h2>Symmetry Judgment</h2><p class="instructions">Is the grid Symmetrical across its vertical axis?</p>${task.renderSymmetryGrid(grid)}</section>`,
    choices: ["Symmetrical", "Not Symmetrical"],
    data: {
      trialId,
      trialType: "symmetry",
      taskType: phase === "symmetry-practice" ? "symmetry-practice" : "combined",
      phase,
      practice,
      sequenceId,
      sequenceLength,
      sequenceIndex,
      gridMatrix: JSON.stringify(grid),
      correctAnswer,
      correctAnswerLabel: correctAnswer ? "Symmetrical" : "Not Symmetrical"
    },
    on_finish: function (data) {
      const responseIndex = Number.isInteger(data.response) ? data.response : null;
      const participantResponse = responseIndex === 0 ? "Symmetrical" :
        responseIndex === 1 ? "Not Symmetrical" : null;
      data.participantResponse = participantResponse;
      data.task_type = data.taskType;
      data.trial_id = data.trialId;
      data.correct_response = data.correctAnswerLabel;
      data.accuracy = participantResponse === data.correctAnswerLabel;
      data.rt = Number.isFinite(data.rt) ? Number(data.rt) : null;
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
          task_type: details.taskType,
          trial_id: trialId,
          correct_response: sequence,
          response: selected,
          accuracy: Number(scores.exactSequenceAccuracy),
          rt: recallReactionTime,
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
      return `<section class="feedback-panel"><h2>Recall Practice</h2><p>You recalled ${result.positionCorrect} of ${result.sequenceLength} locations in the correct positions.</p></section>`;
    },
    choices: ["Continue"],
    data: { phase, practice: true, trialType: "recall-feedback" }
  });
}

function addGridPracticeTrial() {
  const sequence = task.generateMemorySequence(2);
  const sequenceId = `grid-practice-sequence-${nextSequenceId++}`;
  sequence.forEach((position, index) => addMemoryPresentation(position, {
    practice: true,
    phase: "grid-practice",
    taskType: "grid-memory-practice",
    sequenceId,
    sequenceLength: sequence.length,
    sequenceIndex: index + 1
  }));
  addRecallTrial(sequence, {
    practice: true,
    phase: "grid-practice",
    taskType: "grid-memory-practice",
    sequenceId
  });
  addRecallFeedback("grid-practice");
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
      return `<section class="feedback-panel"><h1>Task complete</h1><p>Thank you for completing the Symmetry Span task.</p><p><a class="jspsych-btn csv-download-link" href="${csvUrl}" download="symmetry-span-trial-data.csv">Download trial data</a></p></section>`;
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

function addSymmetryPracticeFeedback() {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const practiceRows = jsPsych.data.get().values().filter(row =>
        row.phase === "symmetry-practice" &&
        row.trialType === "symmetry" &&
        row.practice === true &&
        typeof row.accuracy === "boolean"
      );
      const validCount = practiceRows.length;
      const correctCount = practiceRows.filter(row => row.accuracy).length;
      const accuracyPercent = validCount ? Math.round((correctCount / validCount) * 100) : 0;
      const validRtRows = practiceRows.filter(row => Number.isFinite(row.rt) && row.rt >= 0);
      const meanSolveTime = validRtRows.length
        ? validRtRows.reduce((sum, row) => sum + Number(row.rt), 0) / validRtRows.length
        : null;

      const accuracyText = validCount
        ? `Your accuracy during the Symmetry practice was ${correctCount} out of ${validCount} (${accuracyPercent}%).`
        : "Your accuracy during the Symmetry practice was unavailable because no valid practice responses were recorded.";
      const meanSolveText = Number.isFinite(meanSolveTime) && meanSolveTime >= 0
        ? `Mean solve time: ${Math.round(meanSolveTime).toLocaleString()} ms`
        : "Mean solve time: unavailable";

      return `<section class="feedback-panel"><h2>Symmetry Practice Accuracy</h2><p>${accuracyText}</p><p>${meanSolveText}</p><p>In the main task you’ll be asked to respond quickly and accurately. Please try to keep accuracy high.</p></section>`;
    },
    choices: ["Continue"],
    data: { phase: "symmetry-practice-feedback", trialType: "symmetry-practice-feedback" }
  });
}

validateConfig();

addInstructions("Symmetry Span", [
  "In this task, you will complete a series of activities that involve assessing symmetry and remembering grid cells.",
  "On each trial, you will first see a grid that is either symmetrical or not symmetrical along its vertical axis. Solve the problem as quickly and accurately as you can by selecting Symmetrical or Not Symmetrical.",
  "After making your decision, a grid with a shaded cell will appear on the screen. Remember the shaded cell and its position in the sequence.",
  "You will repeat this process several times. At the end of each sequence, you will be asked to recall the shaded cells in the order in which they appeared.",
  "We will now practice both the symmetry and grid portions of the task separately. The practice activities are designed to help you become familiar with each part of the task."
], "welcome");

addInstructions("Grid Practice", [
  "In this portion of the task, you will be shown a series of shaded grid cells on the screen.",
  "Your job is to remember the cells in the order presented.",
  "To record your answer, you will select the cells you saw from a blank grid in the order in which they were presented.",
  "Click the button below to continue."
], "grid-practice-instructions-1");

addInstructions("Grid Practice", [
  "If you cannot remember a grid cell for a particular position, click the Blank button.",
  "Use the Blank button only when you do not remember the grid cell for that position. You can still enter grid cell for the other positions.",
  "If you make a mistake, you can use the Clear button to clear your responses and start over."
], "grid-practice-instructions-2");

for (let i = 0; i < 5; i++) addGridPracticeTrial();

addInstructions("Symmetry Practice", [
  "In this portion of the task, you will be shown a series of shaded grids on the screen.",
  "Your job is to assess whether the grid is symmetrical or not symmetrical along its vertical axis.",
  "To record your answer, you will select either Symmetrical or Not Symmetrical.",
  "Click the button below to continue."
], "symmetry-practice-instructions");

const symmetryPracticeTypes = Array.from({ length: 15 }, () => Math.random() < 0.5);
symmetryPracticeTypes.forEach(isSymmetric => addSymmetryTrial({
  practice: true,
  phase: "symmetry-practice",
  isSymmetric,
  showFeedback: false
}));

addSymmetryPracticeFeedback();

addInstructions("Combined Practice", [
  "A Symmetry Judgment will alternate with each highlighted memory square. At the end of the sequence, recall every location in the order presented."
], "combined-practice", "Begin Practice");
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
  "The main task follows the Combined Practice procedure. Sequence lengths vary from one to seven locations.",
  "Make each Symmetry Judgment accurately and do your best to remember the square locations. You will not receive correctness feedback during the main task."
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
