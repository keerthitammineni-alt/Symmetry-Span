// Automated Symmetry Span task, using jsPsych 8.

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
      config.spans.some(span => !Number.isInteger(span) || span < 3 || span > 7)) {
    throw new Error("SYMMETRY_SPAN_CONFIG.spans must be a non-empty array of integers from 3 to 7.");
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
