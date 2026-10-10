let recallResponses = [];
let recallResponseEvents = [];
let recallFinishCallback = null;
let recallTargetCount = 0;
let recallStartedAt = 0;
let recallSubmitted = false;
let recallRoot = null;

function createRecallGrid(targetCount) {
  const count = Number.isInteger(targetCount) && targetCount > 0 ? targetCount : 1;
  const cells = Array.from({ length: 16 }, (_, index) =>
    `<button class="recall-cell" type="button" data-position="${index}" aria-label="Row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}"></button>`
  ).join("");

  return `
    <section class="recall-panel">
      <h2>Recall the square locations</h2>
      <p class="instructions">Select the locations in the order they appeared. Select Blank when you cannot remember a location. You need ${count} response${count === 1 ? "" : "s"}.</p>
      <div class="recall-grid" role="group" aria-label="Four by four recall grid">${cells}</div>
      <p id="recallResponseString" class="response-string" aria-live="polite"></p>
      <div class="button-row">
        <button id="clearRecallBtn" type="button">Clear</button>
        <button id="blankRecallBtn" type="button">Blank</button>
        <button id="submitRecallBtn" type="button" disabled>Submit</button>
      </div>
    </section>
  `;
}

function initializeRecallGrid(targetCount, callback) {
  if (!Number.isInteger(targetCount) || targetCount < 1 || targetCount > 16) {
    throw new Error("Recall grid target count must be an integer from 1 to 16.");
  }
  if (typeof callback !== "function") {
    throw new Error("Recall grid requires a completion callback.");
  }

  recallResponses = [];
  recallResponseEvents = [];
  recallTargetCount = targetCount;
  recallFinishCallback = callback;
  recallStartedAt = performance.now();
  recallSubmitted = false;
  recallRoot = document.querySelector(".recall-panel");
  if (!recallRoot) {
    throw new Error("Recall grid panel is missing from the document.");
  }

  recallRoot.querySelectorAll(".recall-cell").forEach(cell => {
    cell.addEventListener("click", () => addRecallResponse(Number(cell.dataset.position)));
  });
  recallRoot.querySelector("#clearRecallBtn").addEventListener("click", clearRecall);
  recallRoot.querySelector("#blankRecallBtn").addEventListener("click", addBlankResponse);
  recallRoot.querySelector("#submitRecallBtn").addEventListener("click", submitRecall);
  updateRecallGrid();
}

function addRecallResponse(position) {
  if (recallResponses.length >= recallTargetCount ||
      recallResponses.includes(position) ||
      !Number.isInteger(position) || position < 0 || position > 15) {
    return;
  }
  recordRecallResponse(position);
}

function addBlankResponse() {
  if (recallResponses.length < recallTargetCount) {
    recordRecallResponse(null);
  }
}

function recordRecallResponse(position) {
  recallResponses.push(position);
  recallResponseEvents.push({
    order: recallResponses.length,
    position,
    timestampMs: Math.round(performance.now() - recallStartedAt)
  });
  updateRecallGrid();
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
    cell.disabled = recallResponses.length >= recallTargetCount || responseIndex !== -1;
  });

  const display = recallRoot.querySelector("#recallResponseString");
  display.textContent = recallResponses.map(position =>
    position === null ? "Blank" : `R${Math.floor(position / 4) + 1}C${position % 4 + 1}`
  ).join(" → ");
  recallRoot.querySelector("#blankRecallBtn").disabled = recallResponses.length >= recallTargetCount;
  recallRoot.querySelector("#submitRecallBtn").disabled = recallResponses.length !== recallTargetCount;
}

function submitRecall() {
  if (!recallSubmitted && recallResponses.length === recallTargetCount && recallFinishCallback) {
    recallSubmitted = true;
    recallFinishCallback(
      [...recallResponses],
      recallResponseEvents.map(event => ({ ...event })),
      Math.round(performance.now() - recallStartedAt)
    );
  }
}
