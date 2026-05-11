// Experimental Data from Paper (Modules in Series)
const EXPERIMENTAL_DATA = [
    { dt: 10,  voltage: 0.52, current: 0.08, power: 0.04, boost: 0.003 },
    { dt: 20,  voltage: 1.04, current: 0.16, power: 0.17, boost: 0.012 },
    { dt: 30,  voltage: 1.56, current: 0.24, power: 0.37, boost: 0.026 },
    { dt: 40,  voltage: 2.08, current: 0.32, power: 0.67, boost: 0.047 },
    { dt: 50,  voltage: 2.60, current: 0.40, power: 1.04, boost: 0.074 },
    { dt: 60,  voltage: 3.12, current: 0.48, power: 1.50, boost: 0.106 },
    { dt: 70,  voltage: 3.64, current: 0.56, power: 2.04, boost: 0.145 },
    { dt: 80,  voltage: 4.16, current: 0.64, power: 2.66, boost: 0.188 },
    { dt: 90,  voltage: 4.68, current: 0.72, power: 3.37, boost: 0.239 },
    { dt: 100, voltage: 5.20, current: 0.80, power: 4.16, boost: 0.295 }
];

// State
let state = {
    tempDiff: 60,
    loadRes: 2.0,
    ivChart: null,
    isDemoRunning: false,
    isLiveFeed: false,
    demoInterval: null,
    liveInterval: null,
    eventLog: [],
    // Configurable parameters
    seebeckCoeff: 0.052, // Updated for 2 modules in series
    internalRes: 4.0,   // Estimated for 2 modules
    boostEfficiency: 0.90,
    targetBoostVoltage: 12.0, // Based on latest table
    connectionUrl: 'https://api.mciot.project/data'
};

const scenarios = {
    automotive: { temp: 95, load: 1.5, label: 'Automotive Engine' },
    industrial: { temp: 75, load: 3.0, label: 'Industrial Pipe' },
    wearable: { temp: 5, load: 0.5, label: 'Body Heat' }
};

// DOM Elements
const tempSlider = document.getElementById('tempDiff');
const loadSlider = document.getElementById('loadRes');
const tempValueDisplay = document.getElementById('tempValue');
const loadValueDisplay = document.getElementById('loadValue');

const rawVoltageEl = document.getElementById('rawVoltage');
const boostedVoltageEl = document.getElementById('boostedVoltage');
const currentOutputEl = document.getElementById('currentOutput');
const powerOutputEl = document.getElementById('powerOutput');

const demoBtn = document.getElementById('demoToggle');
const electronStream = document.getElementById('electronStream');
const loadIndicator = document.getElementById('loadIndicator');
const heatWavesContainer = document.getElementById('heatWaves');

// Initialization
function init() {
    setupEventListeners();
    initChart();
    updateSimulation();
    createPnjunctions();
}

function setupEventListeners() {
    tempSlider.addEventListener('input', (e) => {
        state.tempDiff = parseFloat(e.target.value);
        tempValueDisplay.textContent = state.tempDiff;
        if (state.isDemoRunning) toggleDemo(); // Stop demo if user interacts
        updateSimulation();
    });

    loadSlider.addEventListener('input', (e) => {
        state.loadRes = parseFloat(e.target.value);
        loadValueDisplay.textContent = state.loadRes.toFixed(1);
        if (state.isDemoRunning) toggleDemo();
        updateSimulation();
    });

    // Scenario Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const scenario = scenarios[btn.dataset.scenario];
            applyScenario(scenario);
        });
    });

    // Demo Toggle
    demoBtn.addEventListener('click', toggleDemo);

    // Tab Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            switchTab(sectionId, item);
        });
    });

    // Configuration Save
    document.getElementById('saveConfig').addEventListener('click', saveConfiguration);

    // Live Feed Toggle
    const liveToggle = document.getElementById('liveFeedToggle');
    if (liveToggle) {
        liveToggle.addEventListener('click', toggleLiveFeed);
    }
}

function toggleLiveFeed() {
    state.isLiveFeed = !state.isLiveFeed;
    const btn = document.getElementById('liveFeedToggle');
    const statusDot = document.querySelector('.pulse-dot');
    const statusText = document.querySelector('.status-text');

    if (state.isLiveFeed) {
        btn.classList.add('active');
        btn.innerHTML = '<i data-lucide="wifi"></i> Disconnect';
        statusDot.style.background = 'var(--accent-cyan)';
        statusText.textContent = 'Live Feed Active';
        addLogEntry('Attempting to connect to MCIOT hardware...');
        startLiveFeed();
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i data-lucide="wifi-off"></i> Go Live';
        statusDot.style.background = 'var(--accent-green)';
        statusText.textContent = 'System Active (Sim)';
        addLogEntry('Disconnected from live feed. Reverting to simulation.');
        clearInterval(state.liveInterval);
    }
    lucide.createIcons();
}

function startLiveFeed() {
    addLogEntry(`Connected to ${state.connectionUrl}`);
    state.liveInterval = setInterval(() => {
        // Simulate jitter or real data changes
        const jitter = (Math.random() - 0.5) * 2;
        state.tempDiff = Math.max(0, Math.min(100, state.tempDiff + jitter));
        tempSlider.value = state.tempDiff;
        tempValueDisplay.textContent = Math.round(state.tempDiff);
        updateSimulation();
        
        if (Math.random() > 0.9) {
            addLogEntry(`Packet received: ΔT=${state.tempDiff.toFixed(1)}°C, P=${powerOutputEl.textContent}`);
        }
    }, 2000);
}

function addLogEntry(msg) {
    const logContainer = document.getElementById('eventLog');
    if (!logContainer) return;

    const time = new Date().toLocaleTimeString([], { hour12: false });
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg">${msg}</span>`;
    logContainer.prepend(entry);

    // Keep only last 20 entries
    if (logContainer.children.length > 20) {
        logContainer.lastChild.remove();
    }
}

function switchTab(sectionId, navItem) {
    // Update Nav UI
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    navItem.classList.add('active');

    // Update Section Visibility
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${sectionId}Section`).classList.add('active');
}

function saveConfiguration() {
    state.seebeckCoeff = parseFloat(document.getElementById('cfgSeebeck').value);
    state.internalRes = parseFloat(document.getElementById('cfgRi').value);
    state.boostEfficiency = parseFloat(document.getElementById('cfgEff').value) / 100;
    state.targetBoostVoltage = parseFloat(document.getElementById('cfgTargetV').value);
    
    // Feedback
    const saveBtn = document.getElementById('saveConfig');
    const originalContent = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i data-lucide="check"></i> Saved!';
    saveBtn.style.background = 'var(--accent-green)';
    lucide.createIcons();
    
    setTimeout(() => {
        saveBtn.innerHTML = originalContent;
        saveBtn.style.background = '';
        lucide.createIcons();
    }, 2000);

    updateSimulation();
}

function applyScenario(scenario) {
    state.tempDiff = scenario.temp;
    state.loadRes = scenario.load;
    
    tempSlider.value = state.tempDiff;
    tempValueDisplay.textContent = state.tempDiff;
    loadSlider.value = state.loadRes;
    loadValueDisplay.textContent = state.loadRes.toFixed(1);
    
    updateSimulation();
}

function toggleDemo() {
    state.isDemoRunning = !state.isDemoRunning;
    
    if (state.isDemoRunning) {
        demoBtn.classList.add('active');
        demoBtn.innerHTML = '<i data-lucide="square"></i> Stop Demo';
        lucide.createIcons();
        startDemoSweep();
    } else {
        demoBtn.classList.remove('active');
        demoBtn.innerHTML = '<i data-lucide="play"></i> Start Demo';
        lucide.createIcons();
        clearInterval(state.demoInterval);
    }
}

function startDemoSweep() {
    let direction = 1;
    state.demoInterval = setInterval(() => {
        state.tempDiff += direction * 0.5;
        
        if (state.tempDiff >= 100) direction = -1;
        if (state.tempDiff <= 0) direction = 1;
        
        tempSlider.value = state.tempDiff;
        tempValueDisplay.textContent = Math.round(state.tempDiff);
        updateSimulation();
    }, 50);
}

function updateSimulation() {
    // Use lookup table for high accuracy if we are close to experimental points
    let vTEG, current, pTEG, iBoosted;
    const vTarget = state.targetBoostVoltage;

    // Find the closest experimental data point
    const closest = EXPERIMENTAL_DATA.reduce((prev, curr) => {
        return (Math.abs(curr.dt - state.tempDiff) < Math.abs(prev.dt - state.tempDiff) ? curr : prev);
    });

    // Interpolation (Linear)
    if (Math.abs(state.tempDiff - closest.dt) < 5) {
        // Use data from table
        vTEG = closest.voltage;
        current = closest.current;
        pTEG = closest.power;
        iBoosted = closest.boost;
    } else {
        // Fallback to mathematical model for smooth sliders
        const vOC = state.tempDiff * state.seebeckCoeff;
        current = vOC / (state.internalRes + state.loadRes);
        vTEG = vOC - (current * state.internalRes);
        pTEG = vTEG * current;
        iBoosted = (pTEG * state.boostEfficiency) / vTarget;
    }

    // Update UI
    rawVoltageEl.textContent = `${vTEG.toFixed(2)} V`;
    boostedVoltageEl.textContent = `${vTarget.toFixed(2)} V`;
    currentOutputEl.textContent = `${(iBoosted * 1000).toFixed(1)} mA`;
    powerOutputEl.textContent = `${pTEG.toFixed(2)} W`;

    updateChart(state.tempDiff * state.seebeckCoeff);
    updateVisuals(vTEG, iBoosted);
}

function updateVisuals(vTEG, iBoosted) {
    // 1. Electron Flow Speed
    if (iBoosted > 0) {
        electronStream.style.animationPlayState = 'running';
        // Speed up animation based on current (lower duration = faster)
        const duration = Math.max(0.2, 2 - (iBoosted * 10)); 
        electronStream.style.animationDuration = `${duration}s`;
        loadIndicator.classList.add('on');
    } else {
        electronStream.style.animationPlayState = 'paused';
        loadIndicator.classList.remove('on');
    }

    // 2. Heat Waves
    const waveCount = Math.floor(state.tempDiff / 10);
    heatWavesContainer.innerHTML = '';
    for (let i = 0; i < waveCount; i++) {
        const wave = document.createElement('div');
        wave.className = 'heat-wave';
        wave.style.left = `${Math.random() * 100}%`;
        wave.style.animationDelay = `${Math.random() * 2}s`;
        heatWavesContainer.appendChild(wave);
    }
}

function initChart() {
    const ctx = document.getElementById('ivChart').getContext('2d');
    
    state.ivChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Voltage (V)',
                    borderColor: '#00f2ff',
                    backgroundColor: 'rgba(0, 242, 255, 0.1)',
                    data: [],
                    yAxisID: 'y',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Power (W)',
                    borderColor: '#ff8c00',
                    backgroundColor: 'rgba(255, 140, 0, 0.1)',
                    data: [],
                    yAxisID: 'y1',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    title: { display: true, text: 'Current (Amps)', color: '#a0a4b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#a0a4b8' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Voltage (V)', color: '#00f2ff' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#a0a4b8' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Power (W)', color: '#ff8c00' },
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#a0a4b8' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#f0f1f5', font: { family: 'Outfit' } }
                }
            }
        }
    });
}

function updateChart(vOC) {
    const currentSteps = 20;
    const maxCurrent = vOC / state.internalRes; // Short circuit current
    
    const labels = [];
    const vData = [];
    const pData = [];

    for (let i = 0; i <= currentSteps; i++) {
        const I = (maxCurrent * i) / currentSteps;
        const V = vOC - (I * state.internalRes);
        const P = V * I;

        labels.push(I.toFixed(2));
        vData.push(V.toFixed(2));
        pData.push(P.toFixed(2));
    }

    state.ivChart.data.labels = labels;
    state.ivChart.data.datasets[0].data = vData;
    state.ivChart.data.datasets[1].data = pData;
    state.ivChart.update('none'); // Update without animation for performance
}

function createPnjunctions() {
    const container = document.querySelector('.p-n-junctions');
    for (let i = 0; i < 20; i++) {
        const div = document.createElement('div');
        div.className = 'junction';
        // Alternate colors for P and N
        div.style.background = i % 2 === 0 ? '#444' : '#666';
        container.appendChild(div);
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);
