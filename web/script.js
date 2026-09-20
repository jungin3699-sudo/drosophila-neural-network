// ==========================================
// Drosophila Maze Simulator
// Python 신경망 시뮬레이션과 연결
// ==========================================


// ==========================================
// HTML 요소
// ==========================================

const mazeElement = document.getElementById("maze");

const responseValue =
    document.getElementById("responseValue");

const responseBar =
    document.getElementById("responseBar");

const statusElement =
    document.getElementById("status");

const directionElement =
    document.getElementById("direction");

const timeElement =
    document.getElementById("time");

const distanceElement =
    document.getElementById("distance");

const startButton =
    document.getElementById("startButton");

const pauseButton =
    document.getElementById("pauseButton");

const resetButton =
    document.getElementById("resetButton");


// ==========================================
// 웹사이트 상태
// ==========================================

let running = false;
let paused = false;

let startTime = null;
let elapsedTime = 0;

let simulationTimer = null;


// ==========================================
// Python 서버에서 현재 상태 가져오기
// ==========================================

async function getState() {

    const response = await fetch("/api/state");

    if (!response.ok) {
        throw new Error("시뮬레이션 상태를 가져오지 못했습니다.");
    }

    return await response.json();
}


// ==========================================
// Python에서 시뮬레이션 한 단계 실행
// ==========================================

async function stepSimulation() {

    const response = await fetch(
        "/api/step",
        {
            method: "POST"
        }
    );

    if (!response.ok) {
        throw new Error("시뮬레이션 실행에 실패했습니다.");
    }

    return await response.json();
}


// ==========================================
// Python 시뮬레이션 초기화
// ==========================================

async function resetPythonSimulation() {

    const response = await fetch(
        "/api/reset",
        {
            method: "POST"
        }
    );

    if (!response.ok) {
        throw new Error("시뮬레이션 초기화에 실패했습니다.");
    }

    return await response.json();
}


// ==========================================
// 미로 화면 생성
// ==========================================

function renderMaze(state) {

    const maze = state.maze;

    const rows = maze.length;
    const cols = maze[0].length;

    // Python 미로의 실제 크기에 맞춤
    mazeElement.style.gridTemplateColumns =
        `repeat(${cols}, 1fr)`;

    mazeElement.style.gridTemplateRows =
        `repeat(${rows}, 1fr)`;

    mazeElement.innerHTML = "";

    for (let row = 0; row < rows; row++) {

        for (let col = 0; col < cols; col++) {

            const cell =
                document.createElement("div");

            cell.classList.add("cell");

            const value =
                maze[row][col];

            // 벽
            if (value === "#") {

                cell.classList.add("wall");

            } else {

                cell.classList.add("path");
            }

            // 시작점
            if (value === "S") {

                cell.classList.add("start");
            }

            // 목표점
            if (value === "G") {

                cell.classList.add("goal");
            }

            // 현재 날파리 위치
            if (
                state.position.row === row &&
                state.position.col === col
            ) {

                cell.classList.add("fly");
            }

            mazeElement.appendChild(cell);
        }
    }
}


// ==========================================
// 정보 화면 업데이트
// ==========================================

function updateInformation(state) {

    // ------------------------------
    // 암컷 반응도
    // ------------------------------

    const response =
        Math.max(
            0,
            Math.min(
                100,
                state.female_response
            )
        );

    responseValue.textContent =
        response.toFixed(1);

    responseBar.style.width =
        `${response}%`;


    // ------------------------------
    // 방향
    // ------------------------------

    directionElement.textContent =
        state.direction;


    // ------------------------------
    // 이동 거리
    // ------------------------------

    distanceElement.textContent =
        state.distance;


    // ------------------------------
    // 상태
    // ------------------------------

    if (state.success) {

        statusElement.textContent =
            "목표 도착";

    } else if (state.finished) {

        statusElement.textContent =
            "시뮬레이션 종료";

    } else if (paused) {

        statusElement.textContent =
            "일시정지";

    } else if (running) {

        statusElement.textContent =
            "실행 중";

    } else {

        statusElement.textContent =
            "대기 중";
    }
}


// ==========================================
// 화면 전체 업데이트
// ==========================================

function updateScreen(state) {

    renderMaze(state);

    updateInformation(state);
}


// ==========================================
// 시간 표시
// ==========================================

function updateTime() {

    if (!running || paused) {
        return;
    }

    elapsedTime =
        (performance.now() - startTime) / 1000;

    timeElement.textContent =
        elapsedTime.toFixed(1);

    requestAnimationFrame(updateTime);
}


// ==========================================
// 시뮬레이션 한 단계 진행
// ==========================================

async function runStep() {

    // 실행 중이 아니면 종료
    if (!running || paused) {
        return;
    }

    try {

        const state =
            await stepSimulation();

        updateScreen(state);

        // 목표 도착
        if (state.success) {

            running = false;

            statusElement.textContent =
                "목표 도착";

            return;
        }

        // 시뮬레이션 종료
        if (state.finished) {

            running = false;

            statusElement.textContent =
                "시뮬레이션 종료";

            return;
        }

        // 다음 단계 예약
        simulationTimer =
            setTimeout(
                runStep,
                500
            );

    } catch (error) {

        console.error(error);

        running = false;

        statusElement.textContent =
            "오류 발생";

        alert(
            "시뮬레이션 실행 중 오류가 발생했습니다.\n" +
            error.message
        );
    }
}


// ==========================================
// 시작
// ==========================================

async function startSimulation() {

    // 이미 실행 중이면 아무것도 하지 않음
    if (running && !paused) {
        return;
    }


    // 일시정지 상태에서 다시 시작
    if (paused) {

        paused = false;

        startTime =
            performance.now() -
            elapsedTime * 1000;

        running = true;

        statusElement.textContent =
            "실행 중";

        updateTime();

        runStep();

        return;
    }


    // 완전히 새로 시작
    try {

        const state =
            await resetPythonSimulation();

        updateScreen(state);

        running = true;
        paused = false;

        elapsedTime = 0;

        timeElement.textContent =
            "0.0";

        startTime =
            performance.now();

        statusElement.textContent =
            "실행 중";

        updateTime();

        runStep();

    } catch (error) {

        console.error(error);

        statusElement.textContent =
            "오류 발생";

        alert(
            "시뮬레이션을 시작할 수 없습니다.\n" +
            error.message
        );
    }
}


// ==========================================
// 일시정지
// ==========================================

function pauseSimulation() {

    if (!running) {
        return;
    }

    paused = true;

    clearTimeout(simulationTimer);

    statusElement.textContent =
        "일시정지";
}


// ==========================================
// 재시작
// ==========================================

async function resetSimulation() {

    running = false;
    paused = false;

    clearTimeout(simulationTimer);

    try {

        const state =
            await resetPythonSimulation();

        elapsedTime = 0;

        timeElement.textContent =
            "0.0";

        statusElement.textContent =
            "대기 중";

        updateScreen(state);

    } catch (error) {

        console.error(error);

        statusElement.textContent =
            "오류 발생";

        alert(
            "시뮬레이션을 초기화할 수 없습니다.\n" +
            error.message
        );
    }
}


// ==========================================
// 버튼 연결
// ==========================================

startButton.addEventListener(
    "click",
    startSimulation
);

pauseButton.addEventListener(
    "click",
    pauseSimulation
);

resetButton.addEventListener(
    "click",
    resetSimulation
);


// ==========================================
// 처음 화면 표시
// ==========================================

async function initialize() {

    try {

        const state =
            await getState();

        updateScreen(state);

    } catch (error) {

        console.error(error);

        statusElement.textContent =
            "서버 연결 실패";

        alert(
            "Python 서버에 연결할 수 없습니다.\n" +
            "터미널에서 python app.py가 실행 중인지 확인하세요."
        );
    }
}

initialize();