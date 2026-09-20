import random


# ==========================================
# 초파리 미로 시뮬레이션
# ==========================================

class DrosophilaSimulation:

    def __init__(self):
        # ------------------------------------------
        # 검증된 신경 연결 데이터
        # ------------------------------------------

        self.connection_weights = {
            ("SMP598", "SMP702m"): 1152,
            ("SMP702m", "pC1x_a"): 444,
            ("pC1x_a", "SMP052"): 643,
            ("SMP052", "VES053"): 453,
            ("VES053", "DNa11"): 423,
            ("DNa11", "Sternal adductor MN"): 10,
        }

        # ------------------------------------------
        # 후보 신경 회로
        # ------------------------------------------

        self.neuron_types = [
            "SMP598",
            "SMP702m",
            "pC1x_a",
            "SMP052",
            "VES053",
            "DNa11",
            "Sternal adductor MN"
        ]

        # ------------------------------------------
        # 미로
        # ------------------------------------------

        self.maze = [
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

        self.maze = [list(row) for row in self.maze]

        # ------------------------------------------
        # 시작점 / 목표점
        # ------------------------------------------

        self.start = None
        self.goal = None

        for r in range(len(self.maze)):
            for c in range(len(self.maze[r])):

                if self.maze[r][c] == "S":
                    self.start = (r, c)

                elif self.maze[r][c] == "G":
                    self.goal = (r, c)

        # ------------------------------------------
        # 이동 방향
        #
        # 0 = 위
        # 1 = 오른쪽
        # 2 = 아래
        # 3 = 왼쪽
        # ------------------------------------------

        self.directions = [
            (-1, 0),
            (0, 1),
            (1, 0),
            (0, -1)
        ]

        self.direction_symbols = [
            "↑",
            "→",
            "↓",
            "←"
        ]

        # ------------------------------------------
        # 암컷 자극 계산을 위한 최대 거리
        # ------------------------------------------

        open_positions = [
            (r, c)
            for r in range(len(self.maze))
            for c in range(len(self.maze[r]))
            if self.maze[r][c] != "#"
        ]

        self.max_goal_distance = max(
            abs(r - self.goal[0]) + abs(c - self.goal[1])
            for r, c in open_positions
        )

        # 초기화
        self.reset()


    # ==========================================
    # 시뮬레이션 초기화
    # ==========================================

    def reset(self):

        self.agent_position = self.start

        # 처음에는 오른쪽을 바라봄
        self.direction = 1

        self.step_count = 0

        self.distance = 0

        self.visited = {self.agent_position}

        self.success = False

        self.finished = False

        self.last_action = None

        self.last_probabilities = {
            "forward": 0.0,
            "left": 0.0,
            "right": 0.0
        }

        self.last_stimulus = 0.0

        self.last_activation = 0.0

        return self.get_state()


    # ==========================================
    # 신경망 활성화 계산
    # ==========================================

    def calculate_activation(self, stimulus_strength):

        activation = {
            neuron: 0.0
            for neuron in self.neuron_types
        }

        activation["SMP598"] = stimulus_strength

        for i in range(len(self.neuron_types) - 1):

            source = self.neuron_types[i]
            target = self.neuron_types[i + 1]

            weight = self.connection_weights[
                (source, target)
            ]

            transmission = (
                weight / (weight + 100)
            )

            activation[target] = (
                activation[source] *
                transmission
            )

        return activation


    # ==========================================
    # 암컷 자극
    # ==========================================

    def female_stimulus(self, position):

        distance = (
            abs(position[0] - self.goal[0]) +
            abs(position[1] - self.goal[1])
        )

        normalized_distance = min(
            distance / self.max_goal_distance,
            1.0
        )

        return (
            0.05 +
            0.95 * (1.0 - normalized_distance)
        )


    # ==========================================
    # 이동 가능 여부
    # ==========================================

    def can_move(self, position, direction):

        dr, dc = self.directions[direction]

        nr = position[0] + dr
        nc = position[1] + dc

        # 혹시 모를 범위 오류 방지
        if nr < 0 or nr >= len(self.maze):
            return False

        if nc < 0 or nc >= len(self.maze[0]):
            return False

        return self.maze[nr][nc] != "#"


    # ==========================================
    # 위치 이동
    # ==========================================

    def move_agent(self, position, direction):

        dr, dc = self.directions[direction]

        return (
            position[0] + dr,
            position[1] + dc
        )


    # ==========================================
    # 주변 환경 감지
    # ==========================================

    def sense_environment(self):

        front = self.can_move(
            self.agent_position,
            self.direction
        )

        left_direction = (
            self.direction - 1
        ) % 4

        right_direction = (
            self.direction + 1
        ) % 4

        left = self.can_move(
            self.agent_position,
            left_direction
        )

        right = self.can_move(
            self.agent_position,
            right_direction
        )

        return front, left, right


    # ==========================================
    # 행동 선택
    # ==========================================

    def choose_action(self, motor_activation):

        front, left, right = (
            self.sense_environment()
        )

        # 기본 행동 점수
        forward_score = 0.50
        left_score = 0.25
        right_score = 0.25

        # 환경 정보 반영
        if not front:

            forward_score *= 0.05

            left_score += 0.25
            right_score += 0.25

        if not left:
            left_score *= 0.1

        if not right:
            right_score *= 0.1

        # 신경망 활성화 영향
        forward_score += (
            motor_activation * 0.2
        )

        left_score += (
            motor_activation * 0.1
        )

        right_score += (
            motor_activation * 0.1
        )

        # 암컷 자극이 강한 방향을 선호
        action_directions = {
            "forward": self.direction,
            "left": (self.direction - 1) % 4,
            "right": (self.direction + 1) % 4
        }

        attraction_gain = (
            motor_activation * 3.0
        )

        for action, action_direction in (
            action_directions.items()
        ):

            if self.can_move(
                self.agent_position,
                action_direction
            ):

                next_position = self.move_agent(
                    self.agent_position,
                    action_direction
                )

                signal_ahead = self.female_stimulus(
                    next_position
                )

                if action == "forward":

                    forward_score += (
                        attraction_gain *
                        signal_ahead
                    )

                elif action == "left":

                    left_score += (
                        attraction_gain *
                        signal_ahead
                    )

                else:

                    right_score += (
                        attraction_gain *
                        signal_ahead
                    )

        # 기존 코드의 무작위성 유지
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

        forward_score = max(
            0,
            forward_score
        )

        left_score = max(
            0,
            left_score
        )

        right_score = max(
            0,
            right_score
        )

        scores = {
            "forward": forward_score,
            "left": left_score,
            "right": right_score
        }

        total = sum(scores.values())

        if total <= 0:
            total = 1

        probabilities = {
            action: score / total
            for action, score in scores.items()
        }

        actions = list(probabilities.keys())

        weights = list(
            probabilities.values()
        )

        selected = random.choices(
            actions,
            weights=weights,
            k=1
        )[0]

        return selected, probabilities


    # ==========================================
    # 한 단계 실행
    # ==========================================

    def step(self):

        # 이미 끝났다면 상태만 반환
        if self.finished:

            return self.get_state()

        self.step_count += 1

        # --------------------------------------
        # 현재 위치의 암컷 자극
        # --------------------------------------

        stimulus_strength = (
            self.female_stimulus(
                self.agent_position
            )
        )

        # --------------------------------------
        # 신경망 활성화
        # --------------------------------------

        activation = (
            self.calculate_activation(
                stimulus_strength
            )
        )

        motor_activation = (
            activation[
                "Sternal adductor MN"
            ]
        )

        # --------------------------------------
        # 행동 선택
        # --------------------------------------

        action, probabilities = (
            self.choose_action(
                motor_activation
            )
        )

        self.last_action = action

        self.last_probabilities = probabilities

        self.last_stimulus = (
            stimulus_strength
        )

        self.last_activation = (
            motor_activation
        )

        # --------------------------------------
        # 행동 적용
        # --------------------------------------

        if action == "left":

            self.direction = (
                self.direction - 1
            ) % 4

            if self.can_move(
                self.agent_position,
                self.direction
            ):

                self.agent_position = (
                    self.move_agent(
                        self.agent_position,
                        self.direction
                    )
                )

                self.distance += 1

        elif action == "right":

            self.direction = (
                self.direction + 1
            ) % 4

            if self.can_move(
                self.agent_position,
                self.direction
            ):

                self.agent_position = (
                    self.move_agent(
                        self.agent_position,
                        self.direction
                    )
                )

                self.distance += 1

        elif action == "forward":

            if self.can_move(
                self.agent_position,
                self.direction
            ):

                self.agent_position = (
                    self.move_agent(
                        self.agent_position,
                        self.direction
                    )
                )

                self.distance += 1

        # 방문 위치 기록
        self.visited.add(
            self.agent_position
        )

        # --------------------------------------
        # 목표 도착
        # --------------------------------------

        if self.agent_position == self.goal:

            self.success = True
            self.finished = True

        return self.get_state()


    # ==========================================
    # 현재 상태 반환
    # ==========================================

    def get_state(self):

        front, left, right = (
            self.sense_environment()
        )

        return {
            "step": self.step_count,

            "position": {
                "row": self.agent_position[0],
                "col": self.agent_position[1]
            },

            "direction": (
                self.direction_symbols[
                    self.direction
                ]
            ),

            "female_stimulus": (
                self.last_stimulus
            ),

            "female_response": (
                self.last_stimulus * 100
            ),

            "motor_activation": (
                self.last_activation
            ),

            "probabilities": (
                self.last_probabilities
            ),

            "environment": {
                "front": front,
                "left": left,
                "right": right
            },

            "distance": self.distance,

            "visited_count": len(
                self.visited
            ),

            "success": self.success,

            "finished": self.finished,

            "action": self.last_action,

            "maze": [
                "".join(row)
                for row in self.maze
            ]
        }


# ==========================================
# 테스트
# ==========================================

if __name__ == "__main__":

    simulation = DrosophilaSimulation()

    print("=== 초파리 시뮬레이션 테스트 ===")

    for _ in range(10):

        state = simulation.step()

        print(
            f"Step {state['step']} | "
            f"위치 {state['position']} | "
            f"방향 {state['direction']} | "
            f"암컷 반응도 "
            f"{state['female_response']:.1f}% | "
            f"행동 {state['action']}"
        )

        if state["finished"]:
            break