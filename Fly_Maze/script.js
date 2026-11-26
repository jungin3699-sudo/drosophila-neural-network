// Biology-inspired baseline; these values are illustrative, not measured biological constants.
function generateMaze(width = 15, height = 11) {
    const grid = Array.from({ length: height }, () => Array(width).fill("#"));
    const stack = [{ x: 1, y: 1 }];
    grid[1][1] = ".";
    const steps = [{ x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 }];
    while (stack.length) {
        const current = stack[stack.length - 1];
        const shuffled = [...steps];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        let carved = false;
        for (const d of shuffled) {
            const nx = current.x + d.x, ny = current.y + d.y;
            if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && grid[ny][nx] === "#") {
                grid[current.y + d.y / 2][current.x + d.x / 2] = ".";
                grid[ny][nx] = ".";
                stack.push({ x: nx, y: ny });
                carved = true;
                break;
            }
        }
        if (!carved) stack.pop();
    }
    // A few extra passages create loops, so the fly can encounter alternatives.
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        if (grid[y][x] !== "#" || Math.random() >= 0.10) continue;
        const joinsHorizontal = grid[y][x - 1] !== "#" && grid[y][x + 1] !== "#";
        const joinsVertical = grid[y - 1][x] !== "#" && grid[y + 1][x] !== "#";
        if (joinsHorizontal || joinsVertical) grid[y][x] = ".";
    }
    grid[1][1] = "S";
    grid[height - 2][width - 2] = "G";
    return grid.map(row => row.join(""));
}

const mazeElement = document.getElementById("maze");
const statusElement = document.getElementById("status");
const behaviorElement = document.getElementById("behaviorMode");
const stepElement = document.getElementById("stepCounter");
const neuralInfo = document.getElementById("neuralInfo");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");

const DIRECTIONS = [
    { x: 0, y: -1, name: "북쪽", index: 0 },
    { x: 1, y: 0, name: "동쪽", index: 1 },
    { x: 0, y: 1, name: "남쪽", index: 2 },
    { x: -1, y: 0, name: "서쪽", index: 3 }
];
// The goal is on the east side. Air carries its odor toward the west;
// movement upwind therefore points east, toward the source.
const WIND = { x: -1, y: 0 };
const ODOR_THRESHOLD = 0.025;
const DIFFUSION_RATE = 0.10, ADVECTION_RATE = 0.22, DECAY_RATE = 0.03;

let maze = [], odorMap = [], timer = null, running = false, stepCount = 0;
let fly = { x: 1, y: 1, heading: 1 };
let goal = { x: 13, y: 9 }, lastOdor = 0, odorLossSteps = 0;
let visitedCounts = new Map();

function key(x, y) { return x + "," + y; }
function isOpen(x, y) {
    const cell = maze[y]?.[x];
    return cell === "." || cell === "S" || cell === "G";
}
function getOdor(x, y) { return isOpen(x, y) ? (odorMap[y]?.[x] ?? 0) : 0; }

function calculateOdorDiffusion() {
    const height = maze.length, width = maze[0].length;
    odorMap = Array.from({ length: height }, () => Array(width).fill(0));
    odorMap[goal.y][goal.x] = 1;
    // Odor spreads only through open cells; advection carries it downwind.
    for (let iteration = 0; iteration < 900; iteration++) {
        const next = Array.from({ length: height }, () => Array(width).fill(0));
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            if (!isOpen(x, y)) continue;
            if (x === goal.x && y === goal.y) { next[y][x] = 1; continue; }
            let neighborSum = 0;
            for (const d of DIRECTIONS) if (isOpen(x + d.x, y + d.y)) neighborSum += odorMap[y + d.y][x + d.x];
            const upwindX = x - WIND.x, upwindY = y - WIND.y;
            const advected = isOpen(upwindX, upwindY) ? odorMap[upwindY][upwindX] : 0;
            const retained = 1 - 4 * DIFFUSION_RATE - ADVECTION_RATE - DECAY_RATE;
            next[y][x] = Math.max(0, Math.min(1,
                odorMap[y][x] * retained + DIFFUSION_RATE * neighborSum + ADVECTION_RATE * advected));
        }
        odorMap = next;
    }
}

function relativeObstacle(offset) {
    const d = DIRECTIONS[(fly.heading + offset + 4) % 4];
    return isOpen(fly.x + d.x, fly.y + d.y) ? 0 : 1;
}

function getCandidates() {
    return DIRECTIONS.flatMap(d => {
        const x = fly.x + d.x, y = fly.y + d.y;
        if (!isOpen(x, y)) return [];
        const odor = getOdor(x, y);
        const neural = calculateNeuralActivity({
            front_obstacle: relativeObstacle(0),
            left_obstacle: relativeObstacle(-1),
            right_obstacle: relativeObstacle(1),
            female_stimulus: odor
        });
        return [{ x, y, direction: d, odor, activations: neural.activations }];
    });
}

function dot(a, b) { return a.x * b.x + a.y * b.y; }
function chooseCandidate(candidates, currentOdor) {
    const odorDetected = currentOdor >= ODOR_THRESHOLD;
    const trend = currentOdor - lastOdor;
    const crosswind = { x: -WIND.y, y: WIND.x };
    const upwind = { x: -WIND.x, y: -WIND.y };
    const heading = DIRECTIONS[fly.heading];
    const scored = candidates.map(candidate => {
        const visits = visitedCounts.get(key(candidate.x, candidate.y)) ?? 0;
        let score = -Math.min(visits, 5) * 0.08 + dot(candidate.direction, heading) * 0.12;
        if (odorDetected) {
            score += (candidate.odor - currentOdor) * 7;
            score += dot(candidate.direction, upwind) * 0.28;
            if (trend > 0.002) score += dot(candidate.direction, heading) * 0.12;
            else if (trend < -0.002) score += Math.abs(dot(candidate.direction, crosswind)) * 0.22;
        } else {
            score += Math.abs(dot(candidate.direction, crosswind)) * 0.42 + Math.random() * 0.10;
        }
        return { candidate, score };
    });
    const temperature = 0.24, maxScore = Math.max(...scored.map(item => item.score));
    const weights = scored.map(item => Math.exp((item.score - maxScore) / temperature));
    let pick = Math.random() * weights.reduce((sum, value) => sum + value, 0);
    for (let i = 0; i < scored.length; i++) {
        pick -= weights[i];
        if (pick <= 0) return scored[i].candidate;
    }
    return scored[scored.length - 1].candidate;
}

function updateNeuralInfo(candidate, currentOdor) {
    neuralInfo.replaceChildren();
    const sensory = document.createElement("div");
    sensory.className = "sensory-row";
    sensory.textContent = "현재 냄새 " + currentOdor.toFixed(3) +
        " · 다음 칸 냄새 " + candidate.odor.toFixed(3) +
        " · 선택 방향 " + candidate.direction.name;
    neuralInfo.appendChild(sensory);
    for (const [name, value] of Object.entries(candidate.activations)) {
        const row = document.createElement("div");
        row.className = "neuron-row";
        const label = document.createElement("strong");
        label.textContent = name;
        row.append(label, document.createTextNode(": " + value.toFixed(3)));
        neuralInfo.appendChild(row);
    }
}

function renderMaze() {
    mazeElement.replaceChildren();
    mazeElement.style.gridTemplateColumns = "repeat(" + maze[0].length + ", var(--cell-size))";
    for (let y = 0; y < maze.length; y++) for (let x = 0; x < maze[y].length; x++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        if (!isOpen(x, y)) cell.classList.add("wall");
        if (x === goal.x && y === goal.y) cell.classList.add("goal");
        if ((visitedCounts.get(key(x, y)) ?? 0) > 0) cell.classList.add("visited");
        if (x === fly.x && y === fly.y) {
            cell.classList.add("fly");
            const sprite = document.createElement("span");
            sprite.className = "fly-sprite";
            sprite.setAttribute("role", "img");
            sprite.setAttribute("aria-label", "날파리");
            sprite.style.setProperty("--heading-angle", (fly.heading * 90) + "deg");

            const wingLeft = document.createElement("i");
            wingLeft.className = "fly-wing left";
            const wingRight = document.createElement("i");
            wingRight.className = "fly-wing right";
            const core = document.createElement("span");
            core.className = "fly-core";
            const body = document.createElement("i");
            body.className = "fly-body";
            for (const part of ["fly-head", "fly-eye left", "fly-eye right", "fly-antenna left", "fly-antenna right"]) {
                const detail = document.createElement("i");
                detail.className = part;
                body.appendChild(detail);
            }
            core.appendChild(body);
            sprite.append(wingLeft, wingRight, core);
            cell.appendChild(sprite);
        }
        if (isOpen(x, y) && !(x === goal.x && y === goal.y)) {
            cell.style.setProperty("--odor", Math.min(0.72, getOdor(x, y) * 1.5).toFixed(3));
        }
        mazeElement.appendChild(cell);
    }
}

function moveFly() {
    if (fly.x === goal.x && fly.y === goal.y) {
        statusElement.textContent = "목표 냄새 발생 지점에 도착했습니다.";
        pauseSimulation(); return;
    }
    const currentOdor = getOdor(fly.x, fly.y), candidates = getCandidates();
    if (!candidates.length) { statusElement.textContent = "이동할 수 있는 통로가 없습니다."; pauseSimulation(); return; }
    const selected = chooseCandidate(candidates, currentOdor);
    fly.heading = selected.direction.index;
    fly.x = selected.x; fly.y = selected.y; stepCount++;
    const positionKey = key(fly.x, fly.y);
    visitedCounts.set(positionKey, (visitedCounts.get(positionKey) ?? 0) + 1);

    if (currentOdor >= ODOR_THRESHOLD) {
        odorLossSteps = 0;
        behaviorElement.textContent = currentOdor - lastOdor < -0.002
            ? "행동 상태: 냄새가 약해져 바람 가로 탐색"
            : "행동 상태: 냄새 감지 · 바람 거슬러 이동";
    } else {
        odorLossSteps++;
        behaviorElement.textContent = "행동 상태: 냄새 소실 · 바람 가로 탐색 (" + odorLossSteps + "회)";
    }
    updateNeuralInfo(selected, currentOdor);
    lastOdor = currentOdor;
    stepElement.textContent = "이동 횟수: " + stepCount;
    renderMaze();
    if (fly.x === goal.x && fly.y === goal.y) {
        statusElement.textContent = "목표 냄새 발생 지점에 도착했습니다.";
        pauseSimulation();
    } else if (stepCount >= 500) {
        statusElement.textContent = "500회 이동에 도달했습니다. 새 미로로 다시 시작할 수 있습니다.";
        pauseSimulation();
    } else statusElement.textContent = "탐색 중 · 진행 방향: " + selected.direction.name;
}

function startSimulation() {
    if (running) return;
    running = true;
    document.body.classList.add("sim-running");
    statusElement.textContent = "바람과 냄새 신호를 이용해 탐색 중입니다.";
    timer = setInterval(moveFly, 450);
}
function pauseSimulation() {
    running = false;
    document.body.classList.remove("sim-running");
    if (timer !== null) clearInterval(timer);
    timer = null;
}
function resetSimulation() {
    pauseSimulation();
    maze = generateMaze().map(row => row.split(""));
    const startY = maze.findIndex(row => row.includes("S"));
    const startX = maze[startY].indexOf("S");
    goal = { x: maze[0].length - 2, y: maze.length - 2 };
    fly = { x: startX, y: startY, heading: 1 };
    visitedCounts = new Map([[key(fly.x, fly.y), 1]]);
    stepCount = 0; lastOdor = 0; odorLossSteps = 0;
    calculateOdorDiffusion();
    statusElement.textContent = "시작 버튼을 눌러 탐색하세요.";
    behaviorElement.textContent = "행동 상태: 대기";
    stepElement.textContent = "이동 횟수: 0";
    neuralInfo.textContent = "미로를 시작하면 감각 입력과 회로 활성도를 표시합니다.";
    renderMaze();
}

startBtn.addEventListener("click", startSimulation);
pauseBtn.addEventListener("click", pauseSimulation);
resetBtn.addEventListener("click", resetSimulation);
resetSimulation();
