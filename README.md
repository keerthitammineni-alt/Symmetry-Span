# Symmetry Span

This repository contains a browser-based implementation of the Automated Shortened OSPAN (Operation Span) working-memory task built with jsPsych.

## Project overview

The task combines:
- arithmetic verification trials
- letter presentation and memory encoding
- recall grid responses
- randomized span blocks
- practice blocks before the main task
- optional Qualtrics redirect at completion

## Included files

- `index.html` — entry point for the task
- `experiment.js` — main experiment flow and trial logic
- `experiment.v2.js` — alternate version of the experiment
- `style.css` — styling for the task UI
- `jspsych/` — jsPsych library assets
- `modules/` — custom task modules such as the recall grid

## Run locally

From the repository root, start a simple local web server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## Notes

- The experiment is designed to run in a browser.
- The `jspsych` and `modules` directories are required for the task to function correctly.
- The task is configured to log data and optionally redirect to a Qualtrics completion URL when `window.qualtricsReturnUrl` is set.

## License

This project is provided as-is for research and educational use.
