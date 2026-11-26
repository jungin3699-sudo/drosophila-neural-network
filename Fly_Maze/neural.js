const NEURON_NAMES = [
    "SMP598",
    "SMP702m",
    "pC1x_a",
    "SMP052",
    "VES053",
    "DNa11",
    "Sternal adductor MN"
];

const RAW_CONNECTION_COUNTS = [1152, 444, 643, 453, 423, 10];
const MAX_CONNECTION = Math.max(...RAW_CONNECTION_COUNTS);
const CONNECTION_WEIGHTS = RAW_CONNECTION_COUNTS.map(count => count / MAX_CONNECTION);

function sigmoid(value) {
    if (value >= 0) {
        const z = Math.exp(-value);
        return 1 / (1 + z);
    }
    const z = Math.exp(value);
    return z / (1 + z);
}

function activate(weightedInput, gain = 4.0) {
    if (gain <= 0) throw new Error("Gain must be positive");
    if (weightedInput < 0 || weightedInput > 1) {
        throw new Error("Input must be between 0 and 1");
    }
    const raw = sigmoid(gain * weightedInput);
    const minimum = sigmoid(0);
    const maximum = sigmoid(gain);
    const normalized = (raw - minimum) / (maximum - minimum);
    return Math.max(0, Math.min(1, normalized));
}

function combineStimuli(stimuli) {
    const coefficients = {
        front_obstacle: 0.35,
        left_obstacle: 0.20,
        right_obstacle: 0.20,
        female_stimulus: 0.25
    };
    let combined = 0;
    for (const key in coefficients) {
        const value = stimuli[key] ?? 0;
        if (typeof value !== "number" || value < 0 || value > 1) {
            throw new Error(key + " must be between 0 and 1");
        }
        combined += value * coefficients[key];
    }
    return combined;
}

function calculateNeuralActivity(stimuli) {
    const stimulus = combineStimuli(stimuli);
    const activations = { [NEURON_NAMES[0]]: stimulus };
    for (let i = 0; i < CONNECTION_WEIGHTS.length; i++) {
        const source = NEURON_NAMES[i];
        const target = NEURON_NAMES[i + 1];
        const weightedInput = activations[source] * CONNECTION_WEIGHTS[i];
        activations[target] = activate(weightedInput);
    }
    return { stimulus, activations };
}
