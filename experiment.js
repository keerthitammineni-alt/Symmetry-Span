// Symmetry Span task, using the repository's existing jsPsych 8 setup.

const DEFAULT_CONFIG = {
  stimulusDuration: 800,
  interStimulusInterval: 250,
  qualtricsReturnUrl: "https://merceruniversity.co1.qualtrics.com/jfe/form/SV_1zccezoNm8UGOrA"
};

const config = Object.assign({}, DEFAULT_CONFIG, window.SYMMETRY_SPAN_CONFIG || {});
const task = window.SymmetrySpan;
if (!task) throw new Error("Load modules/symmetrySpan.js before experiment.js.");

const jsPsych = initJsPsych({
  on_trial_finish: function (data) {
    if (!data) return;
    data.participant_id = participantIds.PROLIFIC_PID;
    data.PROLIFIC_PID = participantIds.PROLIFIC_PID;
    data.STUDY_ID = participantIds.STUDY_ID;
    data.SESSION_ID = participantIds.SESSION_ID;
    if (data.taskType && !data.task_type) data.task_type = data.taskType;
    if (data.trialId && !data.trial_id) data.trial_id = data.trialId;
    if (data.sequenceId && !data.sequence_id) data.sequence_id = data.sequenceId;
    if (Number.isInteger(data.sequenceLength) && !Number.isInteger(data.sequence_length)) {
      data.sequence_length = data.sequenceLength;
    }
  },
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
  ["stimulusDuration", "interStimulusInterval"].forEach(key => {
    if (!Number.isInteger(config[key]) || config[key] < 0) {
      throw new Error(`SYMMETRY_SPAN_CONFIG.${key} must be a non-negative integer.`);
    }
  });
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
  // Derive the answer from the actual presented grid's vertical mirror comparison.
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
      taskType: phase === "symmetry_practice" ? "symmetry_practice" : "combined",
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
      data.response_index = responseIndex;
      data.participantResponse = participantResponse;
      data.response = participantResponse;
      data.task_type = data.taskType;
      data.trial_id = data.trialId;
      data.correct_response = data.correctAnswerLabel;
      data.accuracy = participantResponse !== null && participantResponse === data.correctAnswerLabel;
      data.rt = Number.isFinite(data.rt) ? Number(data.rt) : null;
    }
  });

  if (showFeedback) {
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: function () {
        const result = jsPsych.data.get().last(1).values()[0];
        return `<section class="feedback-panel" aria-live="polite"><h2>${result.accuracy ? "Correct!" : "Incorrect."}</h2></section>`;
      },
      choices: ["Continue"],
      data: { phase, practice: true, trialType: "symmetry-practice-feedback", taskType: "symmetry_practice" }
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
      sequenceLength: details.sequenceLength,
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
      sequenceIndex: null,
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

function addGridPracticeFeedback(recallTrialId, sequenceLength) {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const result = jsPsych.data.get().values().find(row => row.trialId === recallTrialId);
      const correctlyRecalled = result && Number.isInteger(result.positionCorrect)
        ? result.positionCorrect
        : 0;
      return `<section class="feedback-panel" aria-live="polite"><h2>Grid Practice Feedback</h2><p>You recalled ${correctlyRecalled} out of ${sequenceLength} grid cells correctly.</p></section>`;
    },
    choices: ["Continue"],
    data: {
      phase: "grid_practice",
      practice: true,
      trialType: "grid-practice-feedback",
      taskType: "grid_memory_practice",
      feedbackForTrialId: recallTrialId
    }
  });
}

function addGridPracticeTrial(practiceIndex) {
  const sequence = task.generateMemorySequence(2);
  const sequenceId = `grid-practice-sequence-${nextSequenceId++}`;
  sequence.forEach((position, index) => addMemoryPresentation(position, {
    practice: true,
    phase: "grid_practice",
    taskType: "grid_memory_practice",
    sequenceId,
    sequenceLength: sequence.length,
    sequenceIndex: index + 1
  }));
  const recallTrialId = `recall-${nextTrialId}`;
  addRecallTrial(sequence, {
    practice: true,
    phase: "grid_practice",
    taskType: "grid_memory_practice",
    sequenceId
  });
  addGridPracticeFeedback(recallTrialId, sequence.length);
}

function addCombinedTrial(sequenceLength, options) {
  const sequence = task.generateMemorySequence(sequenceLength);
  const sequenceId = options.sequenceId || `sequence-${nextSequenceId++}`;
  sequence.forEach((position, index) => {
    const isSymmetric = options.symmetryAnswers
      ? options.symmetryAnswers.shift()
      : Math.random() < 0.5;
    if (typeof isSymmetric !== "boolean") {
      throw new Error("No symmetry answer was available for a combined trial.");
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
}

function computeParticipantSummary() {
  const allTrials = jsPsych.data.get().values();
  const recallRows = allTrials.filter(row =>
    row.phase === "main_task" && row.practice === false && row.trialType === "recall"
  );
  const symmetryRows = allTrials.filter(row =>
    row.phase === "main_task" && row.practice === false && row.trialType === "symmetry"
  );
  return task.computeSummary(recallRows, symmetryRows);
}

function createTrialDataCsvUrl() {
  const csv = jsPsych.data.get().csv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  return URL.createObjectURL(blob);
}

function transferSummaryToQualtrics(summary, returnUrl = config.qualtricsReturnUrl) {
  if (typeof returnUrl !== "string" || !returnUrl.trim()) return null;
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
      return `<section class="feedback-panel"><h1>Task complete</h1><p>Thank you for completing the Symmetry Span task.</p><p><a class="jspsych-btn csv-download-link" href="${csvUrl}" download="symmetry-span-trial-data.csv">Download your trial data</a></p><p>Your results will be returned to the study.</p></section>`;
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

function validSymmetryPracticeRows() {
  return jsPsych.data.get().values().filter(row =>
    row.phase === "symmetry_practice" &&
    row.trialType === "symmetry" &&
    row.practice === true
  );
}

function calculateSymmetryPracticeSummary(rows = validSymmetryPracticeRows()) {
  const reactionTimes = rows
    .map(row => row.rt)
    .filter(rt => typeof rt === "number" && Number.isFinite(rt) && rt > 0);
  if (reactionTimes.length === 0) return { mean: null, sd: null, n: 0 };
  const mean = reactionTimes.reduce((sum, rt) => sum + rt, 0) / reactionTimes.length;
  const variance = reactionTimes.length >= 2
    ? reactionTimes.reduce((sum, rt) => sum + ((rt - mean) ** 2), 0) / (reactionTimes.length - 1)
    : null;
  const sd = variance === null ? null : Math.sqrt(variance);
  return {
    mean: Number.isFinite(mean) ? mean : null,
    sd: Number.isFinite(sd) ? sd : null,
    n: reactionTimes.length
  };
}

function addSymmetryPracticeSummary() {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const stats = calculateSymmetryPracticeSummary();
      const sentence = stats.mean === null
        ? "Your mean solve time was unavailable because no valid symmetry practice response times were recorded."
        : `Your mean solve time was ${Math.round(stats.mean)} ms (SD ${stats.sd === null ? "unavailable" : `${Math.round(stats.sd)} ms`}).`;
      return `<section class="feedback-panel"><h2>Symmetry Practice Summary</h2><p>${sentence}</p></section>`;
    },
    choices: ["Continue"],
    data: { phase: "symmetry_practice_summary", trialType: "symmetry-practice-summary", practice: true }
  });
}

function addSymmetryPracticeAccuracy() {
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const rows = validSymmetryPracticeRows();
      // Fixed denominator of 15: missing and unanswered trials count as incorrect.
      const correctCount = rows.filter(row => row.accuracy === true).length;
      const percentage = Math.round((correctCount / 15) * 100);
      return `<section class="feedback-panel"><h2>Symmetry Practice Accuracy</h2><p>Your accuracy during the symmetry practice was ${correctCount} out of 15 (${percentage}%).</p><p>In the main task you’ll be asked to respond quickly and accurately. Please try to keep accuracy high.</p></section>`;
    },
    choices: ["Continue"],
    data: { phase: "symmetry_practice_accuracy", trialType: "symmetry-practice-accuracy", practice: true }
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
], "grid_practice_instructions");

addInstructions("Grid Practice", [
  "If you cannot remember a grid cell for a particular position, click the Blank button.",
  "Use the Blank button only when you do not remember the grid cell for that position. You can still enter grid cells for the other positions.",
  "If you make a mistake, you can use the Clear button to clear your responses and start over."
], "grid_practice_blank_clear_instructions");

addInstructions("Grid Practice", [
  "There are 3 practice trials. Are you ready to begin?"
], "grid_practice_readiness", "Begin Grid Practice");
for (let i = 0; i < 3; i++) addGridPracticeTrial(i + 1);
addInstructions("Grid Practice Complete", [
  "Press Continue when you are ready for the symmetry practice."
], "grid_practice_completion");

addInstructions("Symmetry Practice", [
  "In this portion of the task, you will be shown a series of shaded grids on the screen.",
  "Your job is to assess whether the grid is symmetrical or not symmetrical along its vertical axis.",
  "To record your answer, you will select either Symmetrical or Not Symmetrical.",
  "Click the button below to continue."
], "symmetry_practice_instructions");

// Keep the existing random practice-generation policy; 15 trials cannot be split equally.
const symmetryPracticeTypes = Array.from({ length: 15 }, () => Math.random() < 0.5);
symmetryPracticeTypes.forEach(isSymmetric => addSymmetryTrial({
  practice: true,
  phase: "symmetry_practice",
  isSymmetric,
  showFeedback: true
}));
addSymmetryPracticeSummary();
addSymmetryPracticeAccuracy();
addInstructions("Continue to Combined Practice", [
  "Press Continue when you are ready to practice both tasks together."
], "continue_to_combined_practice");

addInstructions("Combined Practice", [
  "In this portion of the task, you will practice the full task.",
  "On each trial, you will first solve a symmetry problem and decide whether the proposed answer is Symmetrical or Not Symmetrical.",
  "After making that decision, you will see a shaded grid cell appear on the screen.",
  "This sequence of symmetry problem and then a shaded cell will repeat several times. After the last shaded cell, the grid will appear and you should recall the shaded cells you saw in the order in which they appeared.",
  "Remember: do your best to solve the symmetry problems quickly and accurately while also remembering the shaded cells.",
  "When you are ready to begin the combined practice, click the button below.",
  "You will complete three practice trials."
], "combined_practice_instructions", "Begin Combined Practice");
const combinedPracticeSymmetryAnswers = task.generateBalancedAnswers(3 * 2);
for (let i = 0; i < 3; i++) {
  addCombinedTrial(2, {
    practice: true,
    phase: "combined_practice",
    sequenceId: `combined-practice-sequence-${i + 1}`,
    symmetryAnswers: combinedPracticeSymmetryAnswers
  });
}

addInstructions("Main Symmetry Span task", [
  "The main task follows the Combined Practice procedure. You will complete five sequences, with sequence lengths from three to seven locations.",
  "Make each Symmetry Judgment accurately and do your best to remember the square locations. You will not receive correctness feedback during the main task."
], "main_task_instructions", "Begin task");

// One sequence at each length, randomized without replacement for each participant.
const mainSpans = task.shuffle([3, 4, 5, 6, 7]);
if (mainSpans.length !== 5 || new Set(mainSpans).size !== 5 ||
    [3, 4, 5, 6, 7].some(span => !mainSpans.includes(span))) {
  throw new Error("Main sequence schedule must contain each length from 3 to 7 exactly once.");
}
// There are 25 main symmetry judgments, so exact 50/50 balance is impossible.
// Retain the former balanced-generation approach as closely as possible (12/13), then randomize.
const mainSymmetryAnswers = task.shuffle([
  ...Array(12).fill(true),
  ...Array(13).fill(false)
]);
const mainSymmetryPlan = [...mainSymmetryAnswers];
mainSpans.forEach((span, index) => {
  const sequenceId = `main-sequence-${index + 1}`;
  addInstructions(`Sequence ${index + 1} of 5`, [
    `This sequence contains ${span} square${span === 1 ? "" : "s"}. Remember each location as it appears.`
  ], "main_task", "Begin sequence");
  addCombinedTrial(span, {
    practice: false,
    phase: "main_task",
    sequenceId,
    symmetryAnswers: mainSymmetryAnswers
  });
});

addCompletionTrial();

window.SYMMETRY_SPAN_RUNTIME = Object.freeze({
  config,
  timeline,
  mainSpans,
  mainSymmetryAnswers: mainSymmetryPlan,
  calculateSymmetryPracticeSummary,
  computeParticipantSummary,
  transferSummaryToQualtrics
});
jsPsych.run(timeline);
