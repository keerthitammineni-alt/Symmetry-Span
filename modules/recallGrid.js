// =====================================================
// Automated Shortened OSPAN
// Recall Grid Module
// Version 0.2
// =====================================================

// Letters in the original Foster et al. grid
const LETTERS = [
    "F","H","J","K",
    "L","N","P","Q",
    "R","S","T","Y"
];

// Stores the participant's responses
let recallResponses = [];

// Function to call when Enter is pressed
let finishCallback = null;


// -----------------------------------------------------
// Build the HTML
// -----------------------------------------------------

function createRecallGrid() {

    let html = "";

    html += `
    <div class="recall-panel">

        <h2>Recall</h2>

        <p class="instructions">
            Select the letters in the order they were presented.
            If you forgot a letter, press Blank.
        </p>

        <div class="letter-grid">
    `;

    LETTERS.forEach(letter => {

        html += `
        <div class="letter-cell">

            <div
                class="number-box"
                id="box-${letter}"
                data-letter="${letter}">
            </div>

            <div class="letter">
                ${letter}
            </div>

        </div>
        `;

    });

    html += `
        </div>

        <div
            id="responseString"
            class="response-string">
        </div>

        <div class="button-row">

            <button id="clearBtn">

                Clear

            </button>

            <button id="blankBtn">

                Blank

            </button>

            <button
                id="enterBtn"
                disabled>

                Enter

            </button>

        </div>

    </div>
    `;

    return html;

}



// -----------------------------------------------------
// Initialize after the page loads
// -----------------------------------------------------

function initializeRecallGrid(callback){

    finishCallback = callback;

    recallResponses = [];

    LETTERS.forEach(letter=>{

        document
            .getElementById(`box-${letter}`)
            .addEventListener("click",function(){

                addLetter(letter);

            });

    });

    document
        .getElementById("clearBtn")
        .addEventListener("click",clearRecall);

    document
        .getElementById("blankBtn")
        .addEventListener("click",blankRecall);

    document
        .getElementById("enterBtn")
        .addEventListener("click",submitRecall);

}



// -----------------------------------------------------
// Add a letter
// -----------------------------------------------------

function addLetter(letter){

    if(recallResponses.includes(letter))
        return;

    recallResponses.push(letter);

    updateDisplay();

}



// -----------------------------------------------------
// Blank button
// -----------------------------------------------------

function blankRecall(){

    recallResponses.push("_");

    updateDisplay();

}



// -----------------------------------------------------
// Clear button
// -----------------------------------------------------

function clearRecall(){

    recallResponses = [];

    updateDisplay();

}



// -----------------------------------------------------
// Refresh screen
// -----------------------------------------------------

function updateDisplay(){

    LETTERS.forEach(letter=>{

        const box =
            document.getElementById(`box-${letter}`);

        const index =
            recallResponses.indexOf(letter);

        if(index === -1){

            box.innerHTML = "";

        }

        else{

            box.innerHTML = index + 1;

        }

    });

    document
        .getElementById("responseString")
        .innerHTML =
        recallResponses.join(" ");

    document
        .getElementById("enterBtn")
        .disabled =
        recallResponses.length === 0;

}



// -----------------------------------------------------
// Finish trial
// -----------------------------------------------------

function submitRecall(){

    if(finishCallback){

        finishCallback([...recallResponses]);

    }

}
