import random

# ==========================================
# 검증된 신경 연결 데이터
# ==========================================
# neuPrint에서 이전에 확인한 연결 수를 고정값으로 사용한다.
# 따라서 이 프로그램은 실행 중 인터넷 또는 API 토큰이 필요하지 않다.
connection_weights = {
    ("SMP598", "SMP702m"): 1152,
    ("SMP702m", "pC1x_a"): 444,
    ("pC1x_a", "SMP052"): 643,
    ("SMP052", "VES053"): 453,
    ("VES053", "DNa11"): 423,
    ("DNa11", "Sternal adductor MN"): 10,
}

# ==========================================
# 후보 신경 회로
# ==========================================

neuron_types = [
    "SMP598",
    "SMP702m",
    "pC1x_a",
    "SMP052",
    "VES053",
    "DNa11",
    "Sternal adductor MN"
]

# ==========================================
# 고정 연결값 확인
# ==========================================

for i in range(len(neuron_types) - 1):

    source = neuron_types[i]
    target = neuron_types[i + 1]

    weight = connection_weights[(source, target)]

    print(
        f"{source} → {target}: "
        f"{weight} connections"
    )


# ==========================================
# 신경망 활성화 계산
# ==========================================

def calculate_activation(stimulus_strength):
    """현재 위치에서의 암컷 자극을 신경 회로 입력으로 전달한다."""
    activation = {neuron: 0.0 for neuron in neuron_types}
    activation["SMP598"] = stimulus_strength

    for i in range(len(neuron_types) - 1):
        source = neuron_types[i]
        target = neuron_types[i + 1]
        weight = connection_weights[(source, target)]
        transmission = weight / (weight + 100)
        activation[target] = activation[source] * transmission

    return activation


# ==========================================
# 2D 미로
# ==========================================

maze = [
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
]

maze = [list(row) for row in maze]


# ==========================================
# 시작점 / 목표점 찾기
# ==========================================

for r in range(len(maze)):
    for c in range(len(maze[r])):

        if maze[r][c] == "S":
            start = (r, c)

        elif maze[r][c] == "G":
            goal = (r, c)


agent_position = start

# 방향
# 0 = 위
# 1 = 오른쪽
# 2 = 아래
# 3 = 왼쪽

direction = 1


# ==========================================
# 암컷 자극장
# ==========================================
# 목표 G에 암컷이 있다고 가정한다. 거리가 가까울수록 자극은 1에 가까워지고,
# 멀수록 0.05에 가까워진다. 이는 거리 의존적 화학/시각 자극을 단순화한 규칙이다.
open_positions = [
    (r, c)
    for r in range(len(maze))
    for c in range(len(maze[r]))
    if maze[r][c] != "#"
]
max_goal_distance = max(
    abs(r - goal[0]) + abs(c - goal[1])
    for r, c in open_positions
)


def female_stimulus(position):
    distance = abs(position[0] - goal[0]) + abs(position[1] - goal[1])
    normalized_distance = min(distance / max_goal_distance, 1.0)
    return 0.05 + 0.95 * (1.0 - normalized_distance)


# ==========================================
# 이동 함수
# ==========================================

directions = [
    (-1, 0),
    (0, 1),
    (1, 0),
    (0, -1)
]


def can_move(position, direction):

    dr, dc = directions[direction]

    nr = position[0] + dr
    nc = position[1] + dc

    if maze[nr][nc] == "#":
        return False

    return True


def move_agent(position, direction):

    dr, dc = directions[direction]

    return (
        position[0] + dr,
        position[1] + dc
    )


# ==========================================
# 주변 벽 감지
# ==========================================

def sense_environment():

    front = can_move(
        agent_position,
        direction
    )

    left_direction = (direction - 1) % 4

    right_direction = (direction + 1) % 4

    left = can_move(
        agent_position,
        left_direction
    )

    right = can_move(
        agent_position,
        right_direction
    )

    return front, left, right


# ==========================================
# 행동 선택
# ==========================================

def choose_action(motor_activation):

    front, left, right = sense_environment()

    # 기본 행동 점수
    forward_score = 0.50
    left_score = 0.25
    right_score = 0.25

    # 환경 정보를 반영
    if not front:
        forward_score *= 0.05
        left_score += 0.25
        right_score += 0.25

    if not left:
        left_score *= 0.1

    if not right:
        right_score *= 0.1

    # 신경망 활성화의 영향
    forward_score += motor_activation * 0.2

    left_score += motor_activation * 0.1
    right_score += motor_activation * 0.1

    # 암컷 자극이 더 강해지는 방향으로 움직일 가능성을 조금 높인다.
    # 벽 뒤의 자극은 감지하지 않는 것으로 처리한다.
    action_directions = {
        "forward": direction,
        "left": (direction - 1) % 4,
        "right": (direction + 1) % 4,
    }
    attraction_gain = motor_activation * 3.0

    for action, action_direction in action_directions.items():
        if can_move(agent_position, action_direction):
            next_position = move_agent(agent_position, action_direction)
            signal_ahead = female_stimulus(next_position)
            if action == "forward":
                forward_score += attraction_gain * signal_ahead
            elif action == "left":
                left_score += attraction_gain * signal_ahead
            else:
                right_score += attraction_gain * signal_ahead

    # 무작위성
    noise = 0.10

    forward_score += random.uniform(
        -noise,
        noise
    )

    left_score += random.uniform(
        -noise,
        noise
    )

    right_score += random.uniform(
        -noise,
        noise
    )

    forward_score = max(0, forward_score)
    left_score = max(0, left_score)
    right_score = max(0, right_score)

    scores = {
        "forward": forward_score,
        "left": left_score,
        "right": right_score
    }

    total = sum(scores.values())

    probabilities = {
        action: score / total
        for action, score in scores.items()
    }

    actions = list(probabilities.keys())
    weights = list(probabilities.values())

    selected = random.choices(
        actions,
        weights=weights,
        k=1
    )[0]

    return selected, probabilities


# ==========================================
# 미로 출력
# ==========================================

def print_maze():

    for r in range(len(maze)):

        row = ""

        for c in range(len(maze[r])):

            if (r, c) == agent_position:
                row += "A"

            else:
                row += maze[r][c]

        print(row)


# ==========================================
# 미로 탐색
# ==========================================

MAX_STEPS = 300

print("\n=== 미로 탐색 시작 ===")

print(f"시작 위치: {start}")
print(f"목표 위치(암컷): {goal}")

visited = set()
visited.add(agent_position)

success = False

for step in range(1, MAX_STEPS + 1):

    # 현재 환경 감지
    front, left, right = sense_environment()

    # 현재 위치에서 자극을 계산하고, 이를 신경 회로 입력으로 사용한다.
    stimulus_strength = female_stimulus(agent_position)
    activation = calculate_activation(stimulus_strength)
    motor_activation = activation["Sternal adductor MN"]

    # 행동 선택
    action, probabilities = choose_action(motor_activation)

    print(
        f"\nStep {step}"
    )

    print(
        f"위치: {agent_position}"
    )

    print(
        f"감지 - "
        f"앞:{front}, "
        f"왼쪽:{left}, "
        f"오른쪽:{right}"
    )

    print(f"암컷 자극 세기: {stimulus_strength:.2f}")
    print(f"운동뉴런 활성도: {motor_activation:.4f}")

    print(
        f"행동 확률 - "
        f"앞:{probabilities['forward']:.2f}, "
        f"왼쪽:{probabilities['left']:.2f}, "
        f"오른쪽:{probabilities['right']:.2f}"
    )

    print(
        f"선택 행동: {action}"
    )

    # 행동 적용
    if action == "left":

        direction = (
            direction - 1
        ) % 4

        if can_move(
            agent_position,
            direction
        ):

            agent_position = move_agent(
                agent_position,
                direction
            )

    elif action == "right":

        direction = (
            direction + 1
        ) % 4

        if can_move(
            agent_position,
            direction
        ):

            agent_position = move_agent(
                agent_position,
                direction
            )

    elif action == "forward":

        if can_move(
            agent_position,
            direction
        ):

            agent_position = move_agent(
                agent_position,
                direction
            )

    visited.add(agent_position)

    # 목표 도달
    if agent_position == goal:

        success = True

        print("\n=== 목표 도달! ===")
        print(
            f"탐색 성공 - {step} steps"
        )

        break


# ==========================================
# 결과
# ==========================================

print("\n=== 탐색 결과 ===")

print(
    f"성공 여부: {success}"
)

print(
    f"이동 횟수: {step}"
)

print(
    f"방문한 위치 수: {len(visited)}"
)

print("\n=== 최종 미로 ===")

print_maze()
