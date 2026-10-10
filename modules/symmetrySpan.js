(function (root) {
  "use strict";

  const GRID_SIZE = 8;
  const MEMORY_GRID_SIZE = 4;
  const MEMORY_LOCATION_COUNT = MEMORY_GRID_SIZE * MEMORY_GRID_SIZE;

  function shuffle(items, random = Math.random) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function validateSymmetryGrid(grid) {
    if (!Array.isArray(grid) || grid.length !== GRID_SIZE ||
        grid.some(row => !Array.isArray(row) || row.length !== GRID_SIZE ||
          row.some(cell => typeof cell !== "boolean"))) {
      throw new Error("A symmetry grid must be an 8 by 8 matrix of booleans.");
    }
    return true;
  }

  function isSymmetricalGrid(grid) {
    validateSymmetryGrid(grid);
    return grid.every(row => row.every((cell, column) =>
      cell === row[GRID_SIZE - 1 - column]
    ));
  }

  function generateSymmetryGrid(symmetrical, random = Math.random) {
    if (typeof symmetrical !== "boolean") {
      throw new Error("The requested symmetry category must be a boolean.");
    }
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let column = 0; column < GRID_SIZE / 2; column++) {
        const filled = random() < 0.5;
        grid[row][column] = filled;
        grid[row][GRID_SIZE - 1 - column] = filled;
      }
    }
    if (!symmetrical) {
      const row = Math.floor(random() * GRID_SIZE);
      const column = Math.floor(random() * (GRID_SIZE / 2));
      grid[row][column] = !grid[row][column];
    }
    if (isSymmetricalGrid(grid) !== symmetrical) {
      throw new Error("Generated symmetry grid does not match its requested category.");
    }
    return grid;
  }

  function renderSymmetryGrid(grid) {
    validateSymmetryGrid(grid);
    const cells = grid.flat().map(filled =>
      `<span class="symmetry-cell${filled ? " is-filled" : ""}"></span>`
    ).join("");
    return `<div class="symmetry-grid" role="img" aria-label="Eight by eight square pattern">${cells}</div>`;
  }

  function generateMemorySequence(length, random = Math.random) {
    if (!Number.isInteger(length) || length < 1 || length > 7) {
      throw new Error("A memory sequence length must be an integer from 1 to 7.");
    }
    return shuffle(Array.from({ length: MEMORY_LOCATION_COUNT }, (_, index) => index), random)
      .slice(0, length);
  }

  function renderMemorySquare(position) {
    if (!Number.isInteger(position) || position < 0 || position >= MEMORY_LOCATION_COUNT) {
      throw new Error("A memory location must be an integer from 0 to 15.");
    }
    const cells = Array.from({ length: MEMORY_LOCATION_COUNT }, (_, index) =>
      `<span class="memory-stimulus-cell${index === position ? " is-highlighted" : ""}"></span>`
    ).join("");
    return `<div class="memory-stimulus-grid" role="img" aria-label="A square is highlighted in a four by four grid">${cells}</div>`;
  }

  function scoreSquareRecall(presented, selected) {
    if (!Array.isArray(presented) || presented.length < 1 || presented.length > 7 ||
        presented.some(location => !Number.isInteger(location) || location < 0 || location >= MEMORY_LOCATION_COUNT) ||
        new Set(presented).size !== presented.length) {
      throw new Error("Presented memory locations must be 1 to 7 unique integers from 0 to 15.");
    }
    if (!Array.isArray(selected) ||
        selected.some(location => location !== null &&
          (!Number.isInteger(location) || location < 0 || location >= MEMORY_LOCATION_COUNT)) ||
        new Set(selected.filter(location => location !== null)).size !== selected.filter(location => location !== null).length) {
      throw new Error("Selected memory locations must be unique integers from 0 to 15 or null.");
    }
    const locationCorrect = presented.reduce((count, location) =>
      count + (selected.includes(location) ? 1 : 0), 0);
    const positionCorrect = presented.reduce((count, location, index) =>
      count + (selected[index] === location ? 1 : 0), 0);
    return {
      locationCorrect,
      locationAccuracy: locationCorrect / presented.length,
      positionCorrect,
      positionAccuracy: positionCorrect / presented.length,
      exactSequenceAccuracy: Number(
        selected.length === presented.length && positionCorrect === presented.length
      )
    };
  }

  function generateBalancedAnswers(trialCount, random = Math.random) {
    if (!Number.isInteger(trialCount) || trialCount < 0 || trialCount % 2 !== 0) {
      throw new Error("The main symmetry trial count must be an even non-negative integer.");
    }
    return shuffle([
      ...Array(trialCount / 2).fill(true),
      ...Array(trialCount / 2).fill(false)
    ], random);
  }

  function computeSummary(recallTrials, symmetryTrials) {
    const totalLocationCorrect = recallTrials.reduce((sum, trial) => sum + trial.locationCorrect, 0);
    const totalRecallPositions = recallTrials.reduce((sum, trial) => sum + trial.positionCorrect, 0);
    const totalPresentedPositions = recallTrials.reduce((sum, trial) => sum + trial.sequenceLength, 0);
    const perfectSetScore = recallTrials.reduce((sum, trial) =>
      sum + (trial.exactSequenceAccuracy ? trial.sequenceLength : 0), 0);
    const maxSpan = recallTrials.reduce((max, trial) =>
      trial.exactSequenceAccuracy ? Math.max(max, trial.sequenceLength) : max, 0);
    const symmetryCorrect = symmetryTrials.filter(trial => trial.accuracy).length;
    return {
      totalRecallPositions,
      totalPresentedPositions,
      recallPositionAccuracy: totalPresentedPositions ? totalRecallPositions / totalPresentedPositions : 0,
      totalLocationCorrect,
      recallLocationAccuracy: totalPresentedPositions ? totalLocationCorrect / totalPresentedPositions : 0,
      perfectSetScore,
      maxSpan,
      completedSequences: recallTrials.length,
      symmetryCorrect,
      symmetryTrials: symmetryTrials.length,
      symmetryAccuracy: symmetryTrials.length ? symmetryCorrect / symmetryTrials.length : 0
    };
  }

  root.SymmetrySpan = Object.freeze({
    GRID_SIZE,
    MEMORY_GRID_SIZE,
    MEMORY_LOCATION_COUNT,
    shuffle,
    validateSymmetryGrid,
    isSymmetricalGrid,
    generateSymmetryGrid,
    renderSymmetryGrid,
    generateMemorySequence,
    renderMemorySquare,
    scoreSquareRecall,
    generateBalancedAnswers,
    computeSummary
  });
})(window);
