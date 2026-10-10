# Symmetry Span

Browser-based spatial working-memory experiment implemented with the repository's local jsPsych 8.2.3 build and HTML response plugins 2.1.0. The active entry point is `index.html`; grids are generated as arrays and rendered in HTML/CSS without image assets.

## Reviewed repository architecture

- `index.html` loads the local jsPsych bundle, the two response plugins, reusable task helpers, the 4 × 4 recall UI, and `experiment.js`.
- `modules/symmetrySpan.js` provides grid generation/validation, rendering, memory sequence generation, recall scoring, balanced trial planning, and summary scoring.
- `modules/recallGrid.js` collects ordered spatial responses.
- `experiment.js` builds practice/main timelines, attaches trial metadata, creates CSV downloads, and transfers summary scores to the existing Qualtrics URL.
- `experiment.v2.js`, `modules/mathengine.js`, and `modules/letterpresentation.js` are legacy OSPAN references and are not loaded by the active task.

## Experiment flow

1. Welcome and task instructions.
2. Three symmetry-only practice judgments. Their category counts are 2/1 in either order: with three trials, exact 50/50 balance is impossible. Feedback is shown.
3. Three spatial-memory-only practice sequences, each with two unique locations and recall feedback.
4. Combined-task instructions and a configurable number of practice sequences (two locations per sequence). Symmetry judgments and square presentations alternate; completed recall sequences receive practice feedback.
5. Main Symmetry Span sequences. Sequence lengths are randomized; each sequence alternates symmetry judgment and memory-square presentation, followed by ordered recall. No correctness feedback is shown.
6. Completion, a participant-level summary, a trial-level CSV download link, and return to Qualtrics when configured.

## Configuration

Override `window.SYMMETRY_SPAN_CONFIG` in a script before `experiment.js` in `index.html`:

```html
<script>
  window.SYMMETRY_SPAN_CONFIG = {
    spans: [1, 2, 3, 4, 5, 6, 7],
    repetitionsPerSpan: 2,
    combinedPracticeTrials: 2,
    stimulusDuration: 800,
    interStimulusInterval: 250,
    qualtricsReturnUrl: "https://merceruniversity.co1.qualtrics.com/jfe/form/SV_1zccezoNm8UGOrA"
  };
</script>
```

- `spans`: non-empty list of integer sequence lengths from 1 to 7. Each selected length is repeated `repetitionsPerSpan` times.
- `repetitionsPerSpan`: positive integer.
- `combinedPracticeTrials`: positive integer; practice sequences each contain two locations.
- `stimulusDuration` and `interStimulusInterval`: non-negative integer milliseconds.
- `qualtricsReturnUrl`: existing study destination by default. Set to `""` to disable the redirect.

To guarantee exactly equal numbers of symmetrical and asymmetrical judgments, the total number of main-task memory items (`sum(spans) × repetitionsPerSpan`) must be even. Invalid odd totals are rejected instead of silently producing an imbalanced task. The default schedule uses two replications at every span 1–7 and is balanced.

## Trial data and scoring

Symmetry rows include a unique trial ID, phase/practice labels, 8 × 8 boolean matrix serialized as JSON, correct answer derived from the matrix, response label, accuracy, and jsPsych reaction time (`rt`).

Memory presentation rows include unique trial ID, sequence ID, serial position, presented location (integer 0–15), and presentation timestamp. Recall rows include the presented and selected sequences, sequence length, response order and response timestamps, recall reaction time, and the following measures:

- **Location accuracy:** number of presented locations selected, regardless of order, divided by sequence length.
- **Position accuracy:** number of correct location-at-serial-position responses divided by sequence length.
- **Exact-sequence accuracy:** 1 only if every location is recalled in the original order; otherwise 0.
- A blank response is represented by `null`. Locations cannot be repeated in a generated sequence or selected twice on the recall grid.

Participant-level summary parameters sent to Qualtrics are:

- `SYMMETRY_SPAN_totalRecallPositions`: number of position-correct recall responses.
- `SYMMETRY_SPAN_totalPresentedPositions`: total main-task locations presented.
- `SYMMETRY_SPAN_recallPositionAccuracy`: position-correct proportion across the task.
- `SYMMETRY_SPAN_totalLocationCorrect`: number of presented locations selected, regardless of order.
- `SYMMETRY_SPAN_recallLocationAccuracy`: location-membership proportion across the task.
- `SYMMETRY_SPAN_perfectSetScore`: sum of lengths of exactly recalled sequences (partial-credit-unit score).
- `SYMMETRY_SPAN_maxSpan`: longest exactly recalled sequence.
- `SYMMETRY_SPAN_completedSequences`: number of completed main-task recall sequences.
- `SYMMETRY_SPAN_symmetryCorrect`, `SYMMETRY_SPAN_symmetryTrials`, and `SYMMETRY_SPAN_symmetryAccuracy`.

## Qualtrics and trial-data transfer

The original Qualtrics destination and URL participant identifiers are preserved. The `transferSummaryToQualtrics(summary)` function appends the detected `PROLIFIC_PID`, `STUDY_ID`, and `SESSION_ID` identifiers plus the summary fields to the configured destination URL. URL query parameters are not a trial-level data-storage mechanism and are not guaranteed to populate Embedded Data automatically. Configure the matching Embedded Data fields / URL parameter capture in the Qualtrics Survey Flow, and verify the returned values in a test response before production.

The completion screen exposes a direct download link for `symmetry-span-trial-data.csv`; participants should save it before pressing Finish. Trial-level records are also available in the jsPsych data object and are printed to the browser console when the timeline completes. Qualtrics does not receive the trial-level CSV. Upload/store it only through an institutionally approved data-storage workflow. Browser download restrictions, participant cancellation, or closing the page before the download completes can prevent local CSV receipt; use an approved server-side storage method if guaranteed central collection is required.

## Run locally

Serve the repository root over HTTP:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000/> in a modern browser. The files must remain in their current relative paths; opening the HTML directly as `file://` is not the supported deployment approach.

## Repeatable validation

With the local server running, open <http://localhost:8000/tests/validation.html>. The page runs browser-based checks for 8 × 8 grid shape/symmetry, rendered grid cell counts, unique 1–7 location sequences, recall scoring, balanced main symmetry labels, required phase order, trial labels, combined-task alternation, summary calculations, and single-submit recall response handling. A final PASS/FAIL line is displayed on the page; check the browser console for JavaScript errors.

## Deployment

The repository includes `.github/workflows/deploy-pages.yml`, which uploads the static site and deploys it to GitHub Pages on each push to `main` (or a manual workflow dispatch). In repository **Settings → Pages**, set the build and deployment source to **GitHub Actions**. After the first successful workflow, the task will be available at:

`https://keerthitammineni-alt.github.io/Symmetry-Span/`

The published root is the repository root; the workflow retains the relative paths for `index.html`, `jspsych/`, `modules/`, `experiment.js`, and `style.css`. Confirm the Pages deployment workflow succeeds and test the resulting task URL before sharing it with participants. Configure and verify Qualtrics Embedded Data capture as described above. `experiment.v2.js` remains in the repository as a reference but is not loaded at runtime.

## License

This project is provided as-is for research and educational use.
