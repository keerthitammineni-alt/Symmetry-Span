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
  let symmetricShapeValid = true;
  let symmetricPassesTest = true;
  let asymmetricShapeValid = true;
  let asymmetricFailsTest = true;
  for (let index = 0; index < 100; index++) {
    const symmetric = task.generateSymmetryGrid(true);
    const asymmetric = task.generateSymmetryGrid(false);
    symmetricShapeValid = symmetricShapeValid &&
      symmetric.flat().length === 64 && symmetric.every(row => row.length === 8);
    symmetricPassesTest = symmetricPassesTest && task.isSymmetricalGrid(symmetric);
    asymmetricShapeValid = asymmetricShapeValid &&
      asymmetric.flat().length === 64 && asymmetric.every(row => row.length === 8);
    asymmetricFailsTest = asymmetricFailsTest && !task.isSymmetricalGrid(asymmetric);
  }
  assert(symmetricShapeValid, "100 generated symmetrical grids each contain exactly 64 cells");
  assert(symmetricPassesTest, "all 100 generated symmetrical grids pass mirror comparison");
  assert(asymmetricShapeValid, "100 generated asymmetrical grids each contain exactly 64 cells");
  assert(asymmetricFailsTest, "all 100 generated asymmetrical grids fail mirror comparison");

  assert((task.renderSymmetryGrid(task.generateSymmetryGrid(true)).match(/symmetry-cell/g) || []).length === 64,
    "rendered symmetry grid contains 64 cells");
  assert((task.renderMemorySquare(0).match(/memory-stimulus-cell/g) || []).length === 16,
    "rendered memory grid contains 16 cells");

  let sequencesValid = true;
  for (let length = 1; length <= 7; length++) {
    const sequence = task.generateMemorySequence(length);
    sequencesValid = sequencesValid && sequence.length === length &&
      new Set(sequence).size === length &&
      sequence.every(location => Number.isInteger(location) && location >= 0 && location < 16);
  }
  assert(sequencesValid, "memory sequences contain 1–7 unique valid locations");

  const swapped = task.scoreSquareRecall([2, 11], [11, 2]);
  assert(swapped.locationAccuracy === 1 && swapped.positionAccuracy === 0 &&
    swapped.exactSequenceAccuracy === 0, "scoring distinguishes location membership from serial-position errors");
  const exact = task.scoreSquareRecall([2, 11], [2, 11]);
  assert(exact.locationCorrect === 2 && exact.positionCorrect === 2 &&
    exact.exactSequenceAccuracy === 1, "scoring identifies a fully correct sequence");

  const balanced = task.generateBalancedAnswers(40);
  assert(balanced.filter(Boolean).length === 20 && balanced.filter(answer => !answer).length === 20,
    "balanced symmetry plan has equal categories");
  let oddCountRejected = false;
  try {
    task.generateBalancedAnswers(3);
  } catch (error) {
    oddCountRejected = true;
  }
  assert(oddCountRejected, "unbalanceable odd symmetry trial count is rejected");

  const plan = window.SYMMETRY_SPAN_RUNTIME;
  const trialRows = plan.timeline.map(trial => trial.data || {});
  const mainSymmetry = trialRows.filter(row =>
    row.phase === "main" && row.trialType === "symmetry"
  );
  const mainCategories = mainSymmetry.filter(row => row.correctAnswer).length;
  const mainPracticeFlags = mainSymmetry.every(row => row.practice === false);
  assert(mainSymmetry.length === 4 && mainCategories === 2 &&
    mainSymmetry.length - mainCategories === 2,
  "main symmetry trials are balanced and labeled non-practice");

  const gridPractice = trialRows.filter(row => row.phase === "grid-practice" &&
    row.trialType === "recall" && row.practice === true);
  assert(gridPractice.length === 5,
  "grid practice contains exactly five labeled recall trials");

  const symmetryPractice = trialRows.filter(row => row.phase === "symmetry-practice" &&
    row.trialType === "symmetry" && row.practice === true);
  assert(symmetryPractice.length === 15,
  "symmetry practice contains exactly fifteen labeled trials");
  const practiceSymmetryCount = symmetryPractice.filter(row => row.correctAnswer).length;
  assert(symmetryPractice.every(row => row.taskType === "symmetry-practice") &&
    gridPractice.every(row => row.taskType === "grid-memory-practice") &&
    mainSymmetry.every(row => row.taskType === "combined") &&
    trialRows.filter(row => row.phase === "main" && row.trialType === "memory-presentation")
      .every(row => row.taskType === "combined"),
  "trial metadata distinguishes practice, grid-practice, and combined task types");
  assert(trialRows.filter(row => row.phase === "grid-practice" &&
    row.trialType === "recall" && row.practice === true).length === 5,
  "grid memory practice contains five correctly labeled recall trials");
  assert(mainPracticeFlags &&
    trialRows.filter(row => row.phase === "main" && row.trialType === "recall")
      .every(row => row.practice === false),
  "main symmetry and recall trials have explicit main-task labels");

  const storedGridsMatchAnswers = mainSymmetry.every(row => {
    const matrix = JSON.parse(row.gridMatrix);
    return matrix.length === 8 && matrix.every(gridRow => gridRow.length === 8) &&
      task.isSymmetricalGrid(matrix) === row.correctAnswer;
  });
  assert(storedGridsMatchAnswers, "stored correct answers match each generated 8 × 8 matrix");

  const sequencesHaveUniqueLocations = [...new Set(trialRows
    .filter(row => row.trialType === "memory-presentation")
    .map(row => row.sequenceId))].every(sequenceId => {
    const locations = trialRows.filter(row =>
      row.trialType === "memory-presentation" && row.sequenceId === sequenceId
    ).map(row => row.presentedLocation);
    return locations.length > 0 && new Set(locations).size === locations.length;
  });
  assert(sequencesHaveUniqueLocations, "all planned spatial-memory sequences have unique locations");

  const phaseOrder = [];
  trialRows.forEach(row => {
    if (row.phase && !phaseOrder.includes(row.phase)) phaseOrder.push(row.phase);
  });
  const expectedPhaseOrder = [
    "welcome",
    "grid-practice-instructions-1",
    "grid-practice-instructions-2",
    "grid-practice",
    "symmetry-practice-instructions",
    "symmetry-practice",
    "symmetry-practice-feedback",
    "combined-practice",
    "main",
    "completion"
  ];
  assert(expectedPhaseOrder.every((phase, index) => phaseOrder[index] === phase),
    "timeline phases occur in the required order");

  const mainSequenceIds = [...new Set(mainSymmetry.map(row => row.sequenceId))];
  const mainAlternationValid = mainSequenceIds.every(sequenceId => {
    const types = plan.timeline.map(trial => trial.data || {})
      .filter(row => row.phase === "main" && row.sequenceId === sequenceId &&
        ["symmetry", "memory-presentation"].includes(row.trialType))
      .map(row => row.trialType);
    return types.length === 2 && types[0] === "symmetry" && types[1] === "memory-presentation";
  });
  assert(mainAlternationValid, "each main memory item alternates symmetry judgment then square presentation");

  const locationScore = task.scoreSquareRecall([0, 5], [0, 5]);
  const summary = task.computeSummary([
    { ...locationScore, sequenceLength: 2, exactSequenceAccuracy: 1 }
  ], [{ accuracy: true }, { accuracy: false }]);
  assert(summary.totalRecallPositions === 2 && summary.perfectSetScore === 2 &&
    summary.maxSpan === 2 && summary.completedSequences === 1 &&
    summary.symmetryAccuracy === 0.5,
  "participant summary fields are calculated correctly");

  const query = new URL(plan.transferSummaryToQualtrics(
    summary,
    "https://merceruniversity.co1.qualtrics.com/jfe/form/SV_1zccezoNm8UGOrA"
  ));
  assert(query.hostname === "merceruniversity.co1.qualtrics.com" &&
    query.searchParams.get("PROLIFIC_PID") === "validation-pid" &&
    query.searchParams.get("STUDY_ID") === "validation-study" &&
    query.searchParams.get("SESSION_ID") === "validation-session" &&
    query.searchParams.get("SYMMETRY_SPAN_totalRecallPositions") === "2",
  "Qualtrics transfer preserves participant IDs and adds summary fields to the existing destination");

  const mount = document.getElementById("validation-grid-mount");
  mount.hidden = false;
  mount.innerHTML = createRecallGrid(2);
  let callbacks = 0;
  let callbackData;
  initializeRecallGrid(2, function (...data) {
    callbacks++;
    callbackData = data;
  });
  mount.querySelectorAll(".recall-cell")[0].click();
  mount.querySelectorAll(".recall-cell")[1].click();
  submitRecall();
  submitRecall();
  assert(callbacks === 1 && callbackData[0].join(",") === "0,1" &&
    callbackData[1].map(event => event.order).join(",") === "1,2" &&
    Number.isInteger(callbackData[2]),
  "recall response order, reaction time, and single-submit handler are recorded");
  assert(mount.querySelectorAll(".recall-cell").length === 16,
    "recall grid contains exactly 16 locations");
  const blankCell = mount.querySelectorAll(".recall-cell")[0];
  blankCell.click();
  mount.querySelector("#blankRecallBtn").click();
  assert(mount.querySelector("#recallResponseString").textContent.includes("Blank") &&
    mount.querySelector("#submitRecallBtn").disabled === false,
  "blank response records a missing answer in the correct position without advancing automatically");
  mount.querySelector("#clearRecallBtn").click();
  assert(mount.querySelector("#recallResponseString").textContent === "",
  "clear resets recall selections");
  mount.remove();

  const finalResult = document.createElement("p");
  finalResult.textContent = failures === 0
    ? "All validation checks passed."
    : `${failures} validation check(s) failed.`;
  finalResult.className = failures === 0 ? "validation-pass" : "validation-fail";
  results.appendChild(finalResult);
  document.documentElement.dataset.validation = failures === 0 ? "passed" : "failed";
})();
