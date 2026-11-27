// Fly Neural Lab - GitHub Pages edition
// Python simulation.py의 이동·자극·신경 활성도 계산을 브라우저 JavaScript로 옮긴 버전.

const mazeElement = document.getElementById("maze");
const responseValue = document.getElementById("responseValue");
const responseBar = document.getElementById("responseBar");
const statusElement = document.getElementById("status");
const directionElement = document.getElementById("direction");
const timeElement = document.getElementById("time");
const distanceElement = document.getElementById("distance");
const activationValue = document.getElementById("activationValue");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");

const INITIAL_MAZE = [
    "###############",
    "#S    #       #",
    "### # # ##### #",
    "#   # #     # #",
    "# ### ##### # #",
    "# #       #   #",
    "# # ##### ### #",
    "#   #   #     #",
    "##### # ##### #",
    "#     #       #",
    "# ### ####### #",
    "#   #       #G#",
    "###############"
];

const NEURONS = [
    "SMP598", "SMP702m", "pC1x_a", "SMP052",
    "VES053", "DNa11", "Sternal adductor MN"
];
const CONNECTION_WEIGHTS = [1152, 444, 643, 453, 423, 10];
const DIRECTIONS = [
    { row: -1, col: 0, symbol: "↑" },
    { row: 0, col: 1, symbol: "→" },
    { row: 1, col: 0, symbol: "↓" },
    { row: 0, col: -1, symbol: "←" }
];

let maze = [];
let start = { row: 1, col: 1 };
let goal = { row: 11, col: 13 };
let position = { row: 1, col: 1 };
let direction = 1;
let stepCount = 0;
let distance = 0;
let visited = new Set();
let finished = false;
let success = false;
let lastAction = null;
let lastProbabilities = { forward: 0, left: 0, right: 0 };
let lastStimulus = 0;
let lastActivation = 0;

let running = false;
let paused = false;
let timer = null;
let startTime = 0;
let elapsedTime = 0;

function positionKey(row, col) {
    return row + "," + col;
}

function findEndpoints() {
    for (let row = 0; row < maze.length; row++) {
        for (let col = 0; col < maze[row].length; col++) {
            if (maze[row][col] === "S") start = { row, col };
            if (maze[row][col] === "G") goal = { row, col };
        }
    }
}

function maxGoalDistance() {
    let maxDistance = 1;
    for (let row = 0; row < maze.length; row++) {
        for (let col = 0; col < maze[row].length; col++) {
            if (maze[row][col] !== "#") {
                maxDistance = Math.max(
                    maxDistance,
                    Math.abs(row - goal.row) + Math.abs(col - goal.col)
                );
            }
        }
    }
    return maxDistance;
}

function femaleStimulus(point) {
    const distanceToGoal =
        Math.abs(point.row - goal.row) + Math.abs(point.col - goal.col);
    const normalized = Math.min(distanceToGoal / maxGoalDistance(), 1);
    return 0.05 + 0.95 * (1 - normalized);
}

function canMove(point, heading) {
    const vector = DIRECTIONS[heading];
    const row = point.row + vector.row;
    const col = point.col + vector.col;
    return row >= 0 && row < maze.length &&
        col >= 0 && col < maze[0].length &&
        maze[row][col] !== "#";
}

function moveTo(point, heading) {
    const vector = DIRECTIONS[heading];
    return { row: point.row + vector.row, col: point.col + vector.col };
}

function calculateActivation(stimulus) {
    const activation = {};
    NEURONS.forEach(name => { activation[name] = 0; });
    activation[NEURONS[0]] = stimulus;

    for (let i = 0; i < NEURONS.length - 1; i++) {
        const transmission = CONNECTION_WEIGHTS[i] /
            (CONNECTION_WEIGHTS[i] + 100);
        activation[NEURONS[i + 1]] = activation[NEURONS[i]] * transmission;
    }
    return activation;
}

function senseEnvironment() {
    return {
        front: canMove(position, direction),
        left: canMove(position, (direction + 3) % 4),
        right: canMove(position, (direction + 1) % 4)
    };
}

function chooseAction(motorActivation) {
    const environment = senseEnvironment();
    let forwardScore = 0.50;
    let leftScore = 0.25;
    let rightScore = 0.25;

    if (!environment.front) {
        forwardScore *= 0.05;
        leftScore += 0.25;
        rightScore += 0.25;
    }
    if (!environment.left) leftScore *= 0.1;
    if (!environment.right) rightScore *= 0.1;

    forwardScore += motorActivation * 0.2;
    leftScore += motorActivation * 0.1;
    rightScore += motorActivation * 0.1;

    const actionDirections = {
        forward: direction,
        left: (direction + 3) % 4,
        right: (direction + 1) % 4
    };
    const attractionGain = motorActivation * 3.0;

    for (const [action, heading] of Object.entries(actionDirections)) {
        if (!canMove(position, heading)) continue;
        const nextPosition = moveTo(position, heading);
        const signalAhead = femaleStimulus(nextPosition);
        if (action === "forward") forwardScore += attractionGain * signalAhead;
        else if (action === "left") leftScore += attractionGain * signalAhead;
        else rightScore += attractionGain * signalAhead;
    }

    const noise = 0.10;
    forwardScore = Math.max(0, forwardScore + (Math.random() * 2 - 1) * noise);
    leftScore = Math.max(0, leftScore + (Math.random() * 2 - 1) * noise);
    rightScore = Math.max(0, rightScore + (Math.random() * 2 - 1) * noise);

    const scores = {
        forward: forwardScore,
        left: leftScore,
        right: rightScore
    };
    const total = forwardScore + leftScore + rightScore || 1;
    const probabilities = {
        forward: scores.forward / total,
        left: scores.left / total,
        right: scores.right / total
    };

    let pick = Math.random();
    for (const action of ["forward", "left", "right"]) {
        pick -= probabilities[action];
        if (pick <= 0) return { action, probabilities };
    }
    return { action: "right", probabilities };
}

function resetSimulationState() {
    maze = INITIAL_MAZE.map(row => row.split(""));
    findEndpoints();
    position = { ...start };
    direction = 1;
    stepCount = 0;
    distance = 0;
    visited = new Set([positionKey(position.row, position.col)]);
    finished = false;
    success = false;
    lastAction = null;
    lastProbabilities = { forward: 0, left: 0, right: 0 };
    lastStimulus = 0;
    lastActivation = 0;
    elapsedTime = 0;
    timeElement.textContent = "0.0";
    renderScreen();
    statusElement.textContent = "대기 중";
}

function stepSimulation() {
    if (finished) return;

    stepCount++;
    const stimulus = femaleStimulus(position);
    const activation = calculateActivation(stimulus);
    const motorActivation = activation["Sternal adductor MN"];
    const selected = chooseAction(motorActivation);
    lastAction = selected.action;
    lastProbabilities = selected.probabilities;
    lastStimulus = stimulus;
    lastActivation = motorActivation;

    if (lastAction === "left") direction = (direction + 3) % 4;
    else if (lastAction === "right") direction = (direction + 1) % 4;

    if (canMove(position, direction)) {
        position = moveTo(position, direction);
        distance++;
    }

    visited.add(positionKey(position.row, position.col));

    if (position.row === goal.row && position.col === goal.col) {
        success = true;
        finished = true;
        stopTimer();
        statusElement.textContent = "목표 도착";
    }
    renderScreen();
}

function renderMaze() {
    mazeElement.replaceChildren();
    mazeElement.style.gridTemplateColumns = "repeat(" + maze[0].length + ", minmax(0, 1fr))";
    mazeElement.style.gridTemplateRows = "repeat(" + maze.length + ", minmax(0, 1fr))";

    for (let row = 0; row < maze.length; row++) {
        for (let col = 0; col < maze[row].length; col++) {
            const cell = document.createElement("div");
            cell.className = "cell " + (maze[row][col] === "#" ? "wall" : "path");
            if (maze[row][col] === "S") cell.classList.add("start");
            if (maze[row][col] === "G") cell.classList.add("goal");
            if (visited.has(positionKey(row, col))) cell.classList.add("visited");
            if (position.row === row && position.col === col) cell.classList.add("fly");
            mazeElement.appendChild(cell);
        }
    }
}

function renderInformation() {
    responseValue.textContent = (lastStimulus * 100).toFixed(1);
    responseBar.style.width = Math.max(0, Math.min(100, lastStimulus * 100)) + "%";
    directionElement.textContent = DIRECTIONS[direction].symbol;
    distanceElement.textContent = String(distance);
    activationValue.textContent = lastActivation.toFixed(3);
    if (!success && !paused && running) statusElement.textContent = "실행 중";
    else if (!success && paused) statusElement.textContent = "일시정지";
    else if (!success && !running) statusElement.textContent = "대기 중";
}

function renderScreen() {
    renderMaze();
    renderInformation();
}

function updateClock() {
    if (!running || paused) return;
    elapsedTime = (performance.now() - startTime) / 1000;
    timeElement.textContent = elapsedTime.toFixed(1);
}

function runLoop() {
    if (!running || paused || finished) return;
    stepSimulation();
    updateClock();
    if (running && !finished) timer = setTimeout(runLoop, 500);
}

function stopTimer() {
    running = false;
    paused = false;
    if (timer !== null) clearTimeout(timer);
    timer = null;
}

function startSimulation() {
    if (running && !paused) return;

    if (paused) {
        paused = false;
        running = true;
        startTime = performance.now() - elapsedTime * 1000;
        statusElement.textContent = "실행 중";
        runLoop();
        return;
    }

    resetSimulationState();
    running = true;
    startTime = performance.now();
    statusElement.textContent = "실행 중";
    runLoop();
}

function pauseSimulation() {
    if (!running) return;
    updateClock();
    paused = true;
    running = false;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    statusElement.textContent = "일시정지";
}

function resetSimulation() {
    stopTimer();
    resetSimulationState();
}

startButton.addEventListener("click", startSimulation);
pauseButton.addEventListener("click", pauseSimulation);
resetButton.addEventListener("click", resetSimulation);

resetSimulation();
