import os
import requests
import networkx as nx
import matplotlib.pyplot as plt
import random
import math

TOKEN = os.getenv("NEUPRINT_TOKEN")

URL = "https://neuprint.janelia.org/api/custom/custom"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

neuron_types = [
    "SMP598",
    "SMP702m",
    "pC1x_a",
    "SMP052",
    "VES053",
    "DNa11",
    "Sternal adductor MN"
]

G = nx.DiGraph()

for neuron in neuron_types:
    G.add_node(neuron)


def get_connection(source, target):

    query = f"""
    MATCH (a:Neuron)-[c:ConnectsTo]->(b:Neuron)
    WHERE a.type = "{source}"
      AND b.type = "{target}"
    RETURN c.weight AS connections
    """

    data = {
        "cypher": query,
        "dataset": "male-cns:v1.0"
    }

    response = requests.post(
        URL,
        headers=headers,
        json=data
    )

    response.raise_for_status()

    result = response.json()

    return sum(row[0] for row in result["data"])


# 실제 연결 추가
for i in range(len(neuron_types) - 1):

    source = neuron_types[i]
    target = neuron_types[i + 1]

    weight = get_connection(source, target)

    G.add_edge(
        source,
        target,
        weight=weight
    )

    print(
        f"{source} → {target}: "
        f"{weight} connections"
    )


# ==========================================
# 1. 신경망 활성화
# ==========================================

activation = {}

activation["SMP598"] = 1.0

for neuron in neuron_types[1:]:
    activation[neuron] = 0.0


for i in range(len(neuron_types) - 1):

    source = neuron_types[i]
    target = neuron_types[i + 1]

    weight = G[source][target]["weight"]

    transmission = weight / (weight + 100)

    activation[target] = (
        activation[source] * transmission
    )


print("\n=== 신경망 활성화 ===")

for neuron in neuron_types:

    print(
        f"{neuron}: "
        f"{activation[neuron]:.4f}"
    )


# ==========================================
# 2. 행동 점수 계산
# ==========================================

# 운동 출력 뉴런의 활성화를 이용해서
# 세 가지 행동의 기본 경향을 만든다.

motor_activation = activation["Sternal adductor MN"]

forward_score = 0.5 + motor_activation * 0.2
left_score = 0.25 + motor_activation * 0.1
right_score = 0.25 + motor_activation * 0.1


# ==========================================
# 3. 약간의 무작위성 추가
# ==========================================

noise_strength = 0.15

forward_score += random.uniform(
    -noise_strength,
    noise_strength
)

left_score += random.uniform(
    -noise_strength,
    noise_strength
)

right_score += random.uniform(
    -noise_strength,
    noise_strength
)


# 음수 방지
forward_score = max(0, forward_score)
left_score = max(0, left_score)
right_score = max(0, right_score)


# ==========================================
# 4. 확률로 변환
# ==========================================

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


print("\n=== 행동 확률 ===")

for action, probability in probabilities.items():

    print(
        f"{action}: "
        f"{probability:.3f}"
    )


# ==========================================
# 5. 확률에 따라 행동 선택
# ==========================================

actions = list(probabilities.keys())
weights = list(probabilities.values())

chosen_action = random.choices(
    actions,
    weights=weights,
    k=1
)[0]


print("\n=== 선택된 행동 ===")
print(chosen_action)


# ==========================================
# 6. 그래프 시각화
# ==========================================

plt.figure(figsize=(14, 6))

position = nx.spring_layout(
    G,
    seed=42
)

node_sizes = [
    1500 + activation[node] * 5000
    for node in G.nodes
]

nx.draw(
    G,
    position,
    with_labels=True,
    node_size=node_sizes,
    arrows=True,
    font_size=9
)

plt.title("Male CNS Neural Activation")

plt.show()