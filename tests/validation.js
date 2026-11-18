(function () {
  "use strict";

  const results = document.getElementById("validation-results");
  let failures = 0;

  function assert(condition, message) {
    const item = document.createElement("li");
    item.textContent = `${condition ? "PASS" : "FAIL"}: ${message}`;
    item.className = condition ? "validation-pass" : "validation-fail";
    results.appendChild(item);
    if (!condition) failures++;
  }

  const task = window.SymmetrySpan;
  let symmetricValid = true;
  let asymmetricValid = true;
  for (let index = 0; index < 100; index++) {
    const symmetric = task.generateSymmetryGrid(true);
    const asymmetric = task.generateSymmetryGrid(false);
    symmetricValid = symmetricValid && symmetric.flat().length === 64 &&
      task.isSymmetricalGrid(symmetric);
    asymmetricValid = asymmetricValid && asymmetric.flat().length === 64 &&
      !task.isSymmetricalGrid(asymmetric);
  }
  assert(symmetricValid, "generated symmetrical grids pass vertical-mirror comparison");
  assert(asymmetricValid, "generated non-symmetrical grids fail vertical-mirror comparison");
  assert((task.renderSymmetryGrid(task.generateSymmetryGrid(true)).match(/symmetry-cell/g) || []).length === 64,
    "rendered symmetry grid contains 64 cells");
  assert((task.renderMemorySquare(0).match(/memory-stimulus-cell/g) || []).length === 16,
    "rendered memory grid contains 16 cells");

  const swapped = task.scoreSquareRecall([2, 11], [11, 2]);
  const exact = task.scoreSquareRecall([2, 11], [2, 11]);
  const blanked = task.scoreSquareRecall([2, 11], [null, 11]);
  assert(swapped.locationAccuracy === 1 && swapped.positionCorrect === 0,
    "recall scoring distinguishes location membership from order");
  assert(exact.positionCorrect === 2 && exact.exactSequenceAccuracy === 1,
    "exact ordered recall receives full position credit");
  assert(blanked.positionCorrect === 1 && blanked.exactSequenceAccuracy === 0,
    "blank responses preserve sequence slots and score incorrect at that position");

  const plan = window.SYMMETRY_SPAN_RUNTIME;
  const rows = plan.timeline.map(trial => trial.data || {});
  const gridRecall = rows.filter(row => row.phase === "grid_practice" &&
    row.trialType === "recall" && row.practice === true);
  const gridMemory = rows.filter(row => row.phase === "grid_practice" &&
    row.trialType === "memory-presentation" && row.practice === true);
  const gridFeedback = rows.filter(row => row.phase === "grid_practice" &&
    row.trialType === "grid-practice-feedback");
  assert(gridRecall.length === 3 && gridRecall.every(row => row.sequenceLength === 2),
    "grid practice has exactly three two-cell recall trials");
  assert(gridMemory.length === 6 && gridMemory.every(row => row.sequenceLength === 2),
    "grid practice presents exactly two memory cells per sequence");
  assert(gridFeedback.length === 3, "grid practice has immediate feedback after each trial");

  const readinessIndex = rows.findIndex(row => row.phase === "grid_practice_readiness");
  const firstGridTrialIndex = rows.findIndex(row => row.phase === "grid_practice" && row.trialType === "memory-presentation");
  assert(readinessIndex >= 0 && readinessIndex < firstGridTrialIndex,
    "grid practice readiness page precedes the trials");
  const gridCompletionIndex = rows.findIndex(row => row.phase === "grid_practice_completion");
  const lastGridFeedbackIndex = rows.map((row, index) => row.phase === "grid_practice" && row.trialType === "grid-practice-feedback" ? index : -1)
    .filter(index => index >= 0).pop();
  assert(gridCompletionIndex > lastGridFeedbackIndex,
    "grid practice completion follows the third trial feedback");

  const symmetryPractice = rows.filter(row => row.phase === "symmetry_practice" &&
    row.trialType === "symmetry" && row.practice === true);
  const symmetryFeedback = rows.filter(row => row.phase === "symmetry_practice" &&
    row.trialType === "symmetry-practice-feedback");
  assert(symmetryPractice.length === 15 && symmetryPractice.every(row => row.taskType === "symmetry_practice"),
    "there are exactly fifteen labeled symmetry practice judgments");
  assert(symmetryFeedback.length === 15,
    "every symmetry practice trial has its own immediate feedback trial");
  assert(symmetryPractice.every(row => task.isSymmetricalGrid(JSON.parse(row.gridMatrix)) === row.correctAnswer),
    "symmetry correct answers are derived from the presented grid mirror comparison");

  const stats = plan.calculateSymmetryPracticeSummary([
    { rt: 100 }, { rt: 200 }, { rt: "bad" }, { rt: -1 }, { rt: Infinity }
  ]);
  assert(stats.n === 2 && stats.mean === 150 && Math.round(stats.sd) === 71,
    "practice mean and sample SD use only valid positive reaction times");
  const noStats = plan.calculateSymmetryPracticeSummary([{ rt: null }, { rt: NaN }]);
  assert(noStats.mean === null && noStats.sd === null && noStats.n === 0,
    "missing or invalid reaction times produce unavailable values rather than NaN");

  const combined = rows.filter(row => row.phase === "combined_practice" &&
    row.trialType === "recall" && row.practice === true);
  assert(combined.length === 3 && combined.every(row => row.sequenceLength === 2),
    "combined practice contains exactly three two-item sequences");

  const mainSpans = plan.mainSpans;
  assert(mainSpans.length === 5 && new Set(mainSpans).size === 5 &&
    [3, 4, 5, 6, 7].every(span => mainSpans.includes(span)),
    "main task schedules lengths 3, 4, 5, 6, and 7 exactly once");
  const mainRecall = rows.filter(row => row.phase === "main_task" &&
    row.trialType === "recall" && row.practice === false);
  assert(mainRecall.length === 5 && mainRecall.map(row => row.sequenceLength).sort().join(",") === "3,4,5,6,7",
    "main task has five non-practice recall sequences with the required lengths");
  const mainMemoryRows = rows.filter(row => row.phase === "main_task" &&
    row.trialType === "memory-presentation" && row.practice === false);
  assert(mainMemoryRows.length === 25 && new Set(mainMemoryRows.map(row => row.sequenceId)).size === 5,
    "all 25 main memory items remain grouped within five identifiable sequences");
  assert(rows.filter(row => row.phase === "main_task" && row.practice === false)
    .every(row => row.taskType !== "grid_memory_practice" && row.taskType !== "symmetry_practice"),
    "main task data is separate from all practice phases");

  const phaseOrder = [];
  rows.forEach(row => {
    if (row.phase && !phaseOrder.includes(row.phase)) phaseOrder.push(row.phase);
  });
  const expectedPhases = [
    "welcome", "grid_practice_instructions", "grid_practice_blank_clear_instructions",
    "grid_practice_readiness", "grid_practice", "grid_practice_completion",
    "symmetry_practice_instructions", "symmetry_practice", "symmetry_practice_summary",
    "symmetry_practice_accuracy", "continue_to_combined_practice",
    "combined_practice_instructions", "combined_practice", "main_task_instructions", "main_task", "completion"
  ];
  assert(expectedPhases.every((phase, index) => phaseOrder[index] === phase),
    "all instruction, practice, feedback, and main phases are in the requested order");

  const query = new URL(plan.transferSummaryToQualtrics(
    { totalRecallPositions: 2 },
    "https://merceruniversity.co1.qualtrics.com/jfe/form/SV_1zccezoNm8UGOrA"
  ));
  assert(query.hostname === "merceruniversity.co1.qualtrics.com" &&
    query.searchParams.get("PROLIFIC_PID") === "validation-pid" &&
    query.searchParams.get("STUDY_ID") === "validation-study" &&
    query.searchParams.get("SESSION_ID") === "validation-session" &&
    query.searchParams.get("SYMMETRY_SPAN_totalRecallPositions") === "2",
    "Qualtrics transfer preserves participant identifiers and destination");

  const mount = document.getElementById("validation-grid-mount");
  mount.hidden = false;
  mount.innerHTML = createRecallGrid(2);
  let callbacks = 0;
  let callbackData;
  initializeRecallGrid(2, function (...data) {
    callbacks++;
    callbackData = data;
  });
  mount.querySelector("#blankRecallBtn").click();
  mount.querySelectorAll(".recall-cell")[5].click();
  assert(mount.querySelector("#recallResponseString").textContent.includes("Blank") &&
    mount.querySelector("#submitRecallBtn").disabled === false,
    "Blank reserves the first position and later responses stay in the next position");
  submitRecall();
  submitRecall();
  assert(callbacks === 1 && callbackData[0][0] === null && callbackData[0][1] === 5 &&
    callbackData[1].map(event => event.order).join(",") === "1,2",
    "blank-position recall is submitted once with sequence order preserved");
  mount.querySelector("#clearRecallBtn").click();
  assert(mount.querySelector("#recallResponseString").textContent === "" &&
    mount.querySelector("#submitRecallBtn").disabled,
    "Clear resets all recall selections and does not submit");
  mount.remove();

  const finalResult = document.createElement("p");
  finalResult.textContent = failures === 0
    ? "All validation checks passed."
    : `${failures} validation check(s) failed.`;
  finalResult.className = failures === 0 ? "validation-pass" : "validation-fail";
  results.appendChild(finalResult);
  document.documentElement.dataset.validation = failures === 0 ? "passed" : "failed";
})();
