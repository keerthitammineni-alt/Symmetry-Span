console.log("experiment.v2.js loaded");

// =====================================================
// Automated Shortened OSPAN (v2)
// Version 0.4
// Random Letter Practice
// =====================================================

// Initialize jsPsych
const jsPsych = initJsPsych({
    on_finish: function () {
        console.log(jsPsych.data.get().csv());
    }
});

const timeline = [];

// =====================================================
// Random Sample Without Replacement
// =====================================================

function sampleLetters(n){
    let pool = [...LETTERS];

    // Fisher-Yates shuffle
    for(let i = pool.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0,n);
}

// =====================================================
// Score Recall
// =====================================================

function scoreRecall(presented, recalled){
    let correct = 0;
    for(let i = 0; i < presented.length; i++){
        if(recalled[i] === presented[i]){
            correct++;
        }
    }
    return correct;
}

// =====================================================
// Random Integer
// =====================================================

function randInt(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =====================================================
// Generate One Math Problem
// =====================================================

function generateMathProblem(){
    while(true){
        const a = randInt(1,5);
        const b = randInt(1,5);
        const useMultiply = Math.random() < 0.5;

        let leftValue;
        let leftText;

        if(useMultiply){
            leftValue = a * b;
            leftText = `(${a} × ${b})`;
        }else{
            leftValue = Math.floor(a * b / b);
            leftText = `(${a*b} ÷ ${b})`;
        }

        const c = randInt(1,5);
        const add = Math.random() < 0.5;

        let correctAnswer;
        if(add){
            correctAnswer = leftValue + c;
        }else{
            correctAnswer = leftValue - c;
        }

        if(correctAnswer < 0 || correctAnswer > 15)
            continue;

        const isTrue = Math.random() < 0.5;

        let displayedAnswer;
        if(isTrue){
            displayedAnswer = correctAnswer;
        }else{
            do{
                displayedAnswer = correctAnswer + randInt(-2,2);
            }while(
                displayedAnswer === correctAnswer ||
                displayedAnswer < 0 ||
                displayedAnswer > 15
            );
        }

        return{
            equation: `${leftText} ${add ? "+" : "-"} ${c} = ${displayedAnswer}`,
            correctAnswer: correctAnswer,
            displayedAnswer: displayedAnswer,
            isTrue: isTrue
        };
    }
}

// =====================================================
// Welcome
// =====================================================

timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <h1>Automated Shortened OSPAN</h1>
        <p>Development Version 0.4</p>
    `,
    choices:["Continue"]
});

// =====================================================
// Ready
// =====================================================

timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <h2>Letter Practice</h2>
        <p>Get ready.</p>
    `,
    choices:["Begin"]
});

// =====================================================
// Letter Presentation
// =====================================================

function createLetterPresentation(letterArray){
    const trials = [];

    letterArray.forEach(letter=>{
        trials.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="
                    font-size:72px;
                    font-family:Arial;
                    font-weight:bold;
                ">
                    ${letter}
                </div>
            `,
            choices: "NO_KEYS",
            trial_duration:800
        });

        trials.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus:"",
            choices: "NO_KEYS",
            trial_duration:250
        });
    });

    return trials;
}

// =====================================================
// Build One Complete OSPAN Trial
// =====================================================

function createOSPANTrial(setSize){
    const trial = {
        letters: sampleLetters(setSize),
        math: []
    };

    for(let i=0;i<setSize;i++){
        trial.math.push(generateMathProblem());
    }

    return trial;
}

// =====================================================
// Run blocks for spans 3..7 in random order
// =====================================================

window.spans = jsPsych.randomization.shuffle([3,4,5,6,7]);
console.log('Block order (spans):', window.spans);

for (const span of window.spans){
    // Block start screen
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: `<h2>Span size: ${span}</h2><p>Press Continue to begin this block.</p>`,
        choices:["Continue"]
    });

    const blockTrial = createOSPANTrial(span);

    // Present math + letter for each item
    for (let i=0;i<blockTrial.letters.length;i++){
        timeline.push(...createMathTimeline(blockTrial.math[i]));
        timeline.push(...createLetterPresentation([ blockTrial.letters[i] ]));
    }

    // Recall screen for this block
    timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus:function(){
            return createRecallGrid();
        },
        choices: "NO_KEYS",
        trial_duration:null,
        on_load:function(){
            initializeRecallGrid(function(responses){
                const score = scoreRecall(blockTrial.letters, responses);

                jsPsych.finishTrial({
                    span: blockTrial.letters.length,
                    presentedLetters: blockTrial.letters,
                    recalledLetters: responses,
                    correctLetters: score
                });
            });
        }
    });

    // Feedback for this block
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus:function(){
            const last = jsPsych.data.get().last(1).values()[0];

            return `
                <h2>Block feedback — span ${last.span}</h2>
                <p>You recalled <strong>${last.correctLetters}</strong> of <strong>${last.span}</strong> letters correctly.</p>
            `;
        },
        choices:["Continue"]
    });

    // Short break
    timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: `<p>Short break. Press Continue when ready for the next block.</p>`,
        choices:["Continue"]
    });
}

// =====================================================
// Create One Math Trial
// =====================================================

function createMathTimeline(problem){
    return [
        // Equation
        {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: `
                <div style="
                    font-size:48px;
                    font-family:Arial;
                    text-align:center;
                ">
                    ${problem.equation.replace(/=.+/, "= ?")}
                </div>
                <br><br>
                <p>Work the problem, then click the mouse.</p>
            `,
            choices: "NO_KEYS",
            response_ends_trial: false,
            on_load: function(){
                setTimeout(function(){
                    document.addEventListener("click", advanceMathScreen);
                },200);

                function advanceMathScreen(){
                    document.removeEventListener("click", advanceMathScreen);
                    jsPsych.finishTrial();
                }
            }
        },

        // True / False Screen
        {
            type: jsPsychHtmlButtonResponse,
            stimulus: `
                <div style="
                    font-size:48px;
                    font-family:Arial;
                ">
                    ${problem.displayedAnswer}
                </div>
            `,
            choices:["True","False"],
            data:{
                correct: problem.isTrue
            },
            on_finish:function(data){
                data.correctMath =
                    (data.response===0 && problem.isTrue) ||
                    (data.response===1 && !problem.isTrue);
            }
        }
    ];
}

// =====================================================
// Run
// =====================================================

jsPsych.run(timeline);
