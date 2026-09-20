# Male CNS 기반 초파리 신경회로 모델

weights = {
    "SMP598_to_SMP702m": 288.0,
    "SMP702m_to_pC1x_a": 111.0,
    "pC1x_a_to_SMP052": 321.5,
}

total_output = {
    "SMP598": 2004.0,
    "SMP702m": 679.0,
    "pC1x_a": 3040.0,
}

# 연결 비율 계산
w1 = weights["SMP598_to_SMP702m"] / total_output["SMP598"]
w2 = weights["SMP702m_to_pC1x_a"] / total_output["SMP702m"]
w3 = weights["pC1x_a_to_SMP052"] / total_output["pC1x_a"]

print("=== Male CNS 연결 가중치 ===")
print(f"SMP598 → SMP702m : {w1:.4f}")
print(f"SMP702m → pC1x_a : {w2:.4f}")
print(f"pC1x_a → SMP052  : {w3:.4f}")