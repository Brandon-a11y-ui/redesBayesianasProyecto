// =========================================================================
// inference.js : Algoritmos de Inferencia (Bayes DCC & HMM Nativos)
// =========================================================================

// =========================================================================
// 1. MOTOR DE INFERENCIA BAYESIANO ORIGINAL (¡Intacto!)
// =========================================================================
function runInference() {
    const querySelect = document.getElementById('queryVar');
    const queryId = querySelect.value;
    if (!queryId) { alert('Selecciona una variable de consulta'); return; }

    const queryNode = nodes.find(n => n.id === queryId);
    const evidence = {};
    nodes.forEach(n => {
        const evVal = document.getElementById(`ev_${n.id}`).value;
        if (evVal !== 'none') { evidence[n.id] = (evVal === 'True'); }
    });

    if (evidence[queryId] !== undefined) {
        alert('La variable de consulta no puede ser parte de la evidencia');
        return;
    }

    const probTrue = calculateInference(queryId, true, evidence);
    const probFalse = calculateInference(queryId, false, evidence);
    const alphaSum = probTrue + probFalse;

    if (alphaSum === 0) {
        document.getElementById('resultPanel').innerHTML = `
            <p style="color:red;"><strong>Error:</strong> Combinación de evidencia imposible (Probabilidad conjunta = 0).</p>
        `;
        return;
    }

    const finalTrue = probTrue / alphaSum;
    const finalFalse = probFalse / alphaSum;

    let html = `
        <p><strong>Variable consulta:</strong> ${queryNode.name}</p>
        <p><strong>Evidencia:</strong> ${Object.keys(evidence).length > 0 ? Object.entries(evidence).map(([id, val]) => `${nodes.find(n => n.id === id).name}=${val}`).join(', ') : 'Ninguna'}</p>
        <p><strong>Resultados (Distribución a posteriori):</strong></p>
        <ul>
            <li>P(${queryNode.name}=True) = <strong>${finalTrue.toFixed(4)}</strong> (${(finalTrue * 100).toFixed(2)}%)</li>
            <li>P(${queryNode.name}=False) = <strong>${finalFalse.toFixed(4)}</strong> (${(finalFalse * 100).toFixed(2)}%)</li>
        </ul>
        <p style="font-size:11px; color:green; margin-top:5px;">✓ Inferencia mediante sumatoria de productos (DCC)</p>
    `;
    document.getElementById('resultPanel').innerHTML = html;
}

function calculateInference(queryId, queryVal, evidence) {
    const assignment = Object.assign({}, evidence);
    assignment[queryId] = queryVal;
    return sumOverHiddenVariables(nodes, assignment, 0);
}

function sumOverHiddenVariables(nodeList, assignment, index) {
    if (index === nodeList.length) { return calculateJointProbability(nodeList, assignment); }
    const currNode = nodeList[index];
    if (assignment[currNode.id] !== undefined) { return sumOverHiddenVariables(nodeList, assignment, index + 1); }
    
    assignment[currNode.id] = true;
    const valTrue = sumOverHiddenVariables(nodeList, assignment, index + 1);
    assignment[currNode.id] = false;
    const valFalse = sumOverHiddenVariables(nodeList, assignment, index + 1);
    delete assignment[currNode.id];
    
    return valTrue + valFalse;
}

function calculateJointProbability(nodeList, assignment) {
    let pConjunta = 1.0;
    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        const valNodo = assignment[node.id];
        let keyCPT = "";
        node.parents.forEach(pId => {
            const pNode = nodeList.find(n => n.id === pId);
            keyCPT += (keyCPT ? "," : "") + pNode.name + "=" + (assignment[pId] ? "True" : "False");
        });
        const probTrueInCPT = node.cpt[keyCPT] !== undefined ? node.cpt[keyCPT] : 0.5;
        pConjunta *= valNodo ? probTrueInCPT : (1.0 - probTrueInCPT);
    }
    return pConjunta;
}

function showInferenceSteps() {
    const queryId = document.getElementById('queryVar').value;
    if (!queryId) { alert("Realiza primero una consulta bayesiana"); return; }
    const queryNode = nodes.find(n => n.id === queryId);
    
    let html = `<h5>📋 Pasos de inferencia (DCC)</h5>`;
    html += `<p><strong>Consulta:</strong> ${queryNode.name}</p>`;
    html += `<p><strong>1. Factores Iniciales (CPTs):</strong> Multiplicando la red factorizada de manera topológica.</p>`;
    html += `<p><strong>2. Marginalización:</strong> Sumando recursivamente sobre los estados ocultos de las variables no observadas.</p>`;
    html += `<p><strong>3. Normalización:</strong> Ajustando los pesos mediante factor $\\alpha$ para asegurar axiomas de probabilidad.</p>`;
    
    document.getElementById('resultPanel').innerHTML += `<div style="margin-top:10px; border-top:1px dashed #999; padding-top:5px; font-size:11px; color:#555;">${html}</div>`;
}

// =========================================================================
// 2. MOTOR PROBABILÍSTICO PARA MODELOS OCULTOS DE MARKOV (NUEVO)
// =========================================================================
function runHMMInference() {
    const obsInput = document.getElementById('hmmObservations').value.trim();
    const algorithm = document.getElementById('selectAlgorithm').value;
    const resultPanel = document.getElementById('resultPanel');

    // Validar parámetros cargados
    if (hmmStates.length === 0 || hmmObservations.length === 0) {
        alert("Error: No hay una topología HMM cargada en el sistema.");
        return;
    }
    if (hmmPi.length === 0 || hmmA.length === 0 || hmmB.length === 0) {
        alert("Por favor, abre el panel 'Definir Matrices' y guarda los valores probabilísticos antes de resolver.");
        return;
    }
    if (!obsInput) {
        alert("Por favor, introduce una secuencia de observaciones separadas por comas (ej: Casa, Cine, Trabajo).");
        return;
    }

    // Convertir el texto de observaciones ingresado en índices numéricos correspondientes
    const tokens = obsInput.split(',').map(t => t.trim());
    const obsSequenceIndices = [];
    
    for (let t = 0; t < tokens.length; t++) {
        const idx = hmmObservations.indexOf(tokens[t]);
        if (idx === -1) {
            alert(`Error: La observación "${tokens[t]}" no coincide con ninguna de las observaciones declaradas en el grafo.`);
            return;
        }
        obsSequenceIndices.push(idx);
    }

    // Ejecutar el algoritmo correspondiente según la selección de la GUI
    if (algorithm === 'viterbi') {
        executeViterbi(obsSequenceIndices, tokens);
    } else if (algorithm === 'forward') {
        executeForwardHMM(obsSequenceIndices, tokens);
    } else if (algorithm === 'backward') {
        executeBackwardHMM(obsSequenceIndices, tokens);
    }
}

// A. Algoritmo de Viterbi (Decodificación de la secuencia de estados más probable)
function executeViterbi(obsIndices, obsTokens) {
    const T = obsIndices.length;
    const N = hmmStates.length;

    const delta = Array.from({ length: T }, () => new Array(N).fill(0));
    const psi = Array.from({ length: T }, () => new Array(N).fill(0));

    // Paso 1: Inicialización (Tiempo t = 0)
    for (let i = 0; i < N; i++) {
        delta[0][i] = hmmPi[i] * hmmB[i][obsIndices[0]];
    }

    // Paso 2: Recursión temporal
    for (let t = 1; t < T; t++) {
        for (let j = 0; j < N; j++) {
            let maxVal = -1;
            let maxIdx = 0;
            for (let i = 0; i < N; i++) {
                const val = delta[t-1][i] * hmmA[i][j];
                if (val > maxVal) {
                    maxVal = val;
                    maxIdx = i;
                }
            }
            delta[t][j] = maxVal * hmmB[j][obsIndices[t]];
            psi[t][j] = maxIdx;
        }
    }

    // Paso 3: Terminación
    const pathIndices = new Array(T).fill(0);
    let maxFinalVal = -1;
    let maxFinalIdx = 0;
    for (let i = 0; i < N; i++) {
        if (delta[T-1][i] > maxFinalVal) {
            maxFinalVal = delta[T-1][i];
            maxFinalIdx = i;
        }
    }
    pathIndices[T-1] = maxFinalIdx;

    // Paso 4: Reconstrucción del camino óptimo hacia atrás (Backtracking)
    for (let t = T - 2; t >= 0; t--) {
        pathIndices[t] = psi[t+1][pathIndices[t+1]];
    }

    // Formatear y renderizar reporte detallado en la GUI
    let html = `<strong>🔮 RESULTADOS: ALGORITMO DE VITERBI</strong><br>`;
    html += `Secuencia de observaciones evaluada: [${obsTokens.join(' → ')}]<br><br>`;
    html += `<strong>Secuencia de estados ocultos más probable:</strong><br>`;
    
    const statePathNames = pathIndices.map(idx => hmmStates[idx]);
    html += `<span style="color:#2e7d32; font-weight:bold;">${statePathNames.join(' → ')}</span><br><br>`;
    
    html += `<strong>Desglose por pasos temporales (Camino Óptimo):</strong><br><ul>`;
    for (let t = 0; t < T; t++) {
        html += `<li>Tiempo t=${t+1} (${obsTokens[t]}): Estado estimado = <strong>${statePathNames[t]}</strong></li>`;
    }
    html += `</ul>`;

    document.getElementById('resultPanel').innerHTML = html;
}

// B. Algoritmo Forward HMM (Filtrado con Factores de Escala)
function executeForwardHMM(obsIndices, obsTokens) {
    const T = obsIndices.length;
    const N = hmmStates.length;

    const alpha = Array.from({ length: T }, () => new Array(N).fill(0));
    const c = new Array(T).fill(0); // Factores de escala

    // Paso 1: Inicialización
    let sumAlpha0 = 0;
    for (let i = 0; i < N; i++) {
        alpha[0][i] = hmmPi[i] * hmmB[i][obsIndices[0]];
        sumAlpha0 += alpha[0][i];
    }
    c[0] = sumAlpha0 !== 0 ? 1.0 / sumAlpha0 : 0;
    for (let i = 0; i < N; i++) { alpha[0][i] *= c[0]; }

    // Paso 2: Recursión
    for (let t = 1; t < T; t++) {
        let sumAlphaT = 0;
        for (let j = 0; j < N; j++) {
            let sumTransition = 0;
            for (let i = 0; i < N; i++) {
                sumTransition += alpha[t-1][i] * hmmA[i][j];
            }
            alpha[t][j] = sumTransition * hmmB[j][obsIndices[t]];
            sumAlphaT += alpha[t][j];
        }
        c[t] = sumAlphaT !== 0 ? 1.0 / sumAlphaT : 0;
        for (let j = 0; j < N; j++) { alpha[t][j] *= c[t]; }
    }

    // Formatear matriz de salida filtrada
    let html = `<strong>📊 RESULTADOS: ALGORITMO FORWARD (Filtrado)</strong><br>`;
    html += `Matriz de intensidades probabilísticas escaladas por paso de tiempo:<br><br>`;
    html += `<table style="width:100%; font-size:11px; border-collapse:collapse;" border="1">`;
    html += `<tr style="background:#ef6c00; color:white;"><th>Tiempo (Obs)</th>`;
    hmmStates.forEach(s => { html += `<th>${s}</th>`; });
    html += `</tr>`;

    for (let t = 0; t < T; t++) {
        html += `<tr><td><strong>t=${t+1} (${obsTokens[t]})</strong></td>`;
        for (let i = 0; i < N; i++) {
            html += `<td>${alpha[t][i].toFixed(4)}</td>`;
        }
        html += `</tr>`;
    }
    html += `</table><br><p style="font-size:11px; color:#555;">Nota: Los valores corresponden a las probabilidades locales $P(S_t \\mid O_{1:t})$ normalizadas por paso de tiempo.</p>`;

    document.getElementById('resultPanel').innerHTML = html;
}

// C. Algoritmo Backward HMM (Suavizado combinatorio temporal)
function executeBackwardHMM(obsIndices, obsTokens) {
    const T = obsIndices.length;
    const N = hmmStates.length;

    // Para calcular las distribuciones suavizadas completas (Gamma), calculamos primero un paso Forward complementario
    const alpha = Array.from({ length: T }, () => new Array(N).fill(0));
    const c = new Array(T).fill(0);

    let sumAlpha0 = 0;
    for (let i = 0; i < N; i++) {
        alpha[0][i] = hmmPi[i] * hmmB[i][obsIndices[0]];
        sumAlpha0 += alpha[0][i];
    }
    c[0] = sumAlpha0 !== 0 ? 1.0 / sumAlpha0 : 0;
    for (let i = 0; i < N; i++) { alpha[0][i] *= c[0]; }

    for (let t = 1; t < T; t++) {
        let sumAlphaT = 0;
        for (let j = 0; j < N; j++) {
            let sumTransition = 0;
            for (let i = 0; i < N; i++) { sumTransition += alpha[t-1][i] * hmmA[i][j]; }
            alpha[t][j] = sumTransition * hmmB[j][obsIndices[t]];
            sumAlphaT += alpha[t][j];
        }
        c[t] = sumAlphaT !== 0 ? 1.0 / sumAlphaT : 0;
        for (let j = 0; j < N; j++) { alpha[t][j] *= c[t]; }
    }

    // Inicialización y ejecución del algoritmo Backward hacia atrás
    const beta = Array.from({ length: T }, () => new Array(N).fill(0));
    for (let i = 0; i < N; i++) { beta[T-1][i] = 1.0 * c[T-1]; }

    for (let t = T - 2; t >= 0; t--) {
        for (let i = 0; i < N; i++) {
            let sumBack = 0;
            for (let j = 0; j < N; j++) {
                sumBack += hmmA[i][j] * hmmB[j][obsIndices[t+1]] * beta[t+1][j];
            }
            beta[t][i] = sumBack * c[t];
        }
    }

    // Cálculo de la distribución de suavizado suavizada final (Gamma)
    const gamma = Array.from({ length: T }, () => new Array(N).fill(0));
    for (let t = 0; t < T; t++) {
        let sumGammaT = 0;
        for (let i = 0; i < N; i++) {
            gamma[t][i] = alpha[t][i] * beta[t][i];
            sumGammaT += gamma[t][i];
        }
        if (sumGammaT !== 0) {
            for (let i = 0; i < N; i++) { gamma[t][i] /= sumGammaT; }
        }
    }

    // Formatear y renderizar reporte final de suavizado en la GUI
    let html = `<strong>📉 RESULTADOS: ALGORITMO BACKWARD (Suavizado Gamma)</strong><br>`;
    html += `Distribución final suavizada considerando toda la secuencia de observaciones:<br><br>`;
    html += `<table style="width:100%; font-size:11px; border-collapse:collapse;" border="1">`;
    html += `<tr style="background:#ef6c00; color:white;"><th>Día (Tiempo)</th>`;
    hmmStates.forEach(s => { html += `<th>${s}</th>`; });
    html += `</tr>`;

    for (let t = 0; t < T; t++) {
        html += `<tr><td><strong>t=${t+1} (${obsTokens[t]})</strong></td>`;
        for (let i = 0; i < N; i++) {
            html += `<td>${gamma[t][i].toFixed(4)}</td>`;
        }
        html += `</tr>`;
    }
    html += `</table><br><p style="font-size:11px; color:#555;">✓ Inferencia temporal completada con éxito. Probabilidades suavizadas $P(S_t \\mid O_{1:T})$.</p>`;

    document.getElementById('resultPanel').innerHTML = html;
}