from flask import Flask, jsonify, send_from_directory
from simulation import DrosophilaSimulation

app = Flask(__name__)

# 시뮬레이션 객체 생성
simulation = DrosophilaSimulation()


# ==========================================
# 웹사이트
# ==========================================

@app.route("/")
def index():
    return send_from_directory("web", "index.html")


# CSS / JavaScript 파일
@app.route("/<path:filename>")
def web_files(filename):
    return send_from_directory("web", filename)


# ==========================================
# 시뮬레이션 초기화
# ==========================================

@app.route("/api/reset", methods=["POST"])
def reset():

    state = simulation.reset()

    return jsonify(state)


# ==========================================
# 시뮬레이션 한 단계 실행
# ==========================================

@app.route("/api/step", methods=["POST"])
def step():

    state = simulation.step()

    return jsonify(state)


# ==========================================
# 현재 상태 확인
# ==========================================

@app.route("/api/state", methods=["GET"])
def state():

    return jsonify(
        simulation.get_state()
    )


# ==========================================
# 서버 실행
# ==========================================

if __name__ == "__main__":

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )