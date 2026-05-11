// inference.js - Inferencia por enumeracion (DCC)
// Formula: P(X|e) = alfa * sumatoria P(X, e, y)

// Funcion principal llamada por el boton Inferir
async function runInference() {
    const queryVarName = getCurrentQuery();
    const evidence = getCurrentEvidence();
    const resultPanel = document.getElementById('resultPanel');

    if (!queryVarName) {
        resultPanel.innerHTML = '<p>Selecciona una variable de consulta</p>';
        return;
    }

    // Verificar que todos los nodos tengan CPT definida
    const missingCPTs = nodes.filter(n => !n.cpt || Object.keys(n.cpt).length === 0);
    if (missingCPTs.length > 0) {
        resultPanel.innerHTML = `
            <p><strong>Consulta:</strong> ${queryVarName}</p>
            <p><strong>Faltan CPTs para:</strong> ${missingCPTs.map(n => n.name).join(', ')}</p>
            <p>Haz doble clic en los nodos para definir sus probabilidades.</p>
        `;
        return;
    }

    try {
        const queryNode = nodes.find(n => n.name === queryVarName);
        const results = {};
        let alphaSum = 0;

        // Calcular P(Consulta = valor, Evidencia) para cada valor (True/False)
        for (const queryVal of queryNode.values) {
            const currentAssignment = { ...evidence, [queryVarName]: queryVal };
            const prob = sumOverHiddenVariables(currentAssignment);
            results[queryVal] = prob;
            alphaSum += prob;
        }

        // Mostrar resultados normalizados
        let html = `
            <p><strong>Variable consulta:</strong> ${queryVarName}</p>
            <p><strong>Evidencia:</strong> ${Object.keys(evidence).length > 0 ? Object.entries(evidence).map(([k,v]) => `${k}=${v}`).join(', ') : 'ninguna'}</p>
            <p><strong>Resultados (Distribucion a posteriori):</strong></p>
            <ul>
        `;

        for (const val in results) {
            const normalizedProb = results[val] / alphaSum;
            html += `<li>P(${queryVarName}=${val}) = ${normalizedProb.toFixed(4)} (${(normalizedProb * 100).toFixed(2)}%)</li>`;
        }

        html += `</ul><p>Inferencia mediante sumatoria de productos (DCC)</p>`;
        resultPanel.innerHTML = html;

    } catch (error) {
        console.error(error);
        resultPanel.innerHTML = `<p>Error en el calculo: ${error.message}</p>`;
    }
}

// Sumatoria recursiva sobre las variables ocultas
function sumOverHiddenVariables(assignment) {
    // Buscar la primera variable sin valor asignado
    const nextVar = nodes.find(n => assignment[n.name] === undefined);

    if (!nextVar) {
        // Caso base: evento atomico completo
        return calculateJointProbability(assignment);
    }

    // Sumar sobre todos los valores posibles de la variable
    let sum = 0;
    for (const val of nextVar.values) {
        sum += sumOverHiddenVariables({ ...assignment, [nextVar.name]: val });
    }
    return sum;
}

// Calcula el producto de probabilidades condicionales
function calculateJointProbability(assignment) {
    let jointProb = 1;

    for (const node of nodes) {
        // Obtener los padres del nodo actual
        const parents = edges.filter(e => e.target === node.id)
                             .map(e => nodes.find(n => n.id === e.source));
        
        const nodeVal = assignment[node.name];
        let prob = 0;

        if (parents.length === 0) {
            // Nodo raiz: probabilidad marginal
            prob = node.cpt[nodeVal];
        } else {
            // Nodo con padres: probabilidad condicional
            const parentValues = parents.map(p => assignment[p.name]);
            const comboIdx = getComboIndex(parents, parentValues);
            const valIdx = node.values.indexOf(nodeVal);
            
            if (node.cpt[comboIdx] && node.cpt[comboIdx][valIdx] !== undefined) {
                prob = node.cpt[comboIdx][valIdx];
            } else {
                prob = 0.001; // Valor por defecto si no se encuentra
            }
        }
        jointProb *= prob;
    }
    return jointProb;
}

// Busca el indice de la combinacion de padres que coincide con los valores actuales
function getComboIndex(parents, currentValues) {
    const combinations = cartesianProduct(parents.map(() => ['True', 'False']));
    
    for (let i = 0; i < combinations.length; i++) {
        if (combinations[i].every((val, idx) => val === currentValues[idx])) {
            return i;
        }
    }
    return 0;
}


// Mostrar pasos intermedios de eliminacion (RF10)
function showInferenceSteps() {
    const queryVarName = getCurrentQuery();
    const evidence = getCurrentEvidence();
    const resultPanel = document.getElementById('resultPanel');
    
    if (!queryVarName) {
        resultPanel.innerHTML = '<p>Selecciona una variable de consulta</p>';
        return;
    }
    
    const missingCPTs = nodes.filter(n => !n.cpt || Object.keys(n.cpt).length === 0);
    if (missingCPTs.length > 0) {
        resultPanel.innerHTML = `<p>Faltan CPTs para: ${missingCPTs.map(n => n.name).join(', ')}</p>`;
        return;
    }
    
    let stepsHtml = `<h3>Pasos de inferencia (Eliminacion de Variables)</h3>`;
    stepsHtml += `<p><strong>Consulta:</strong> ${queryVarName}</p>`;
    stepsHtml += `<p><strong>Evidencia:</strong> ${Object.keys(evidence).length > 0 ? Object.entries(evidence).map(([k,v]) => `${k}=${v}`).join(', ') : 'ninguna'}</p><hr>`;
    
    // Paso 1: Mostrar factores iniciales (CPTs)
    stepsHtml += `<h4>Paso 1: Factores iniciales (CPTs)</h4><ul>`;
    for (const node of nodes) {
        const parents = edges.filter(e => e.target === node.id).map(e => {
            const p = nodes.find(n => n.id === e.source);
            return p ? p.name : null;
        }).filter(p => p);
        
        if (parents.length === 0) {
            stepsHtml += `<li><strong>${node.name}</strong>: P(${node.name}) = {`;
            for (const val of node.values) {
                stepsHtml += `${val}: ${node.cpt[val] || 0}, `;
            }
            stepsHtml += `}</li>`;
        } else {
            stepsHtml += `<li><strong>${node.name}</strong>: P(${node.name} | ${parents.join(', ')})<br>`;
            const combinations = cartesianProduct(parents.map(() => ['True', 'False']));
            stepsHtml += `<table style="margin-left:20px; border-collapse:collapse; font-size:12px; border:1px solid #ccc;">`;
            stepsHtml += `<tr><th>${parents.join(', ')}</th><th>P(True)</th><th>P(False)</th></tr>`;
            for (let i = 0; i < combinations.length; i++) {
                const combo = combinations[i];
                const comboLabel = combo.join(',');
                stepsHtml += `<tr><td style="border:1px solid #ccc; padding:4px;">${comboLabel}</td>`;
                for (let j = 0; j < node.values.length; j++) {
                    const prob = node.cpt[i] ? node.cpt[i][j] : 0;
                    stepsHtml += `<td style="border:1px solid #ccc; padding:4px;">${prob}</td>`;
                }
                stepsHtml += `</tr>`;
            }
            stepsHtml += ` primesie</li>`;
        }
    }
    stepsHtml += `</ul><hr>`;
    
    // Paso 2: Aplicar evidencia
    stepsHtml += `<h4>Paso 2: Aplicar evidencia</h4><ul>`;
    for (const [varName, varValue] of Object.entries(evidence)) {
        stepsHtml += `<li>${varName} = ${varValue} -> se filtran las filas que no coinciden</li>`;
    }
    stepsHtml += `</ul><hr>`;
    
    // Paso 3: Identificar variables a eliminar (ocultas)
    const evidenceVars = new Set(Object.keys(evidence));
    const varsToEliminate = nodes.filter(n => n.name !== queryVarName && !evidenceVars.has(n.name)).map(n => n.name);
    
    stepsHtml += `<h4>Paso 3: Identificar variables a eliminar</h4>`;
    stepsHtml += `<p>Variables ocultas (ni consulta ni evidencia): <strong>${varsToEliminate.join(', ') || 'ninguna'}</strong></p><hr>`;
    
    // Paso 4: Proceso de eliminacion
    stepsHtml += `<h4>Paso 4: Eliminacion de variables</h4>`;
    stepsHtml += `<p>El algoritmo multiplica factores que comparten variables y luego marginaliza (suma) sobre la variable eliminada.</p><ul>`;
    
    let remainingVars = [...nodes.map(n => n.name)];
    for (const varToElim of varsToEliminate) {
        stepsHtml += `<li><strong>Eliminando ${varToElim}:</strong><ul>`;
        stepsHtml += `<li>Se multiplican los factores que contienen a ${varToElim}</li>`;
        stepsHtml += `<li>Se suman (marginalizan) los valores de ${varToElim}</li>`;
        stepsHtml += `<li>Resultado: nuevo factor sin ${varToElim}</li></ul></li>`;
        remainingVars = remainingVars.filter(v => v !== varToElim);
    }
    stepsHtml += `</ul><hr>`;
    
    // Paso 5: Factor final
    stepsHtml += `<h4>Paso 5: Factor final</h4>`;
    stepsHtml += `<p>Variables restantes: <strong>${remainingVars.join(', ')}</strong></p>`;
    stepsHtml += `<p>Se multiplican los factores restantes y se normaliza para obtener P(${queryVarName} | evidencia).</p><hr>`;
    
    // Paso 6: Ejecutar la inferencia real y mostrar resultado
    try {
        const queryNode = nodes.find(n => n.name === queryVarName);
        const results = {};
        let alphaSum = 0;
        
        for (const queryVal of queryNode.values) {
            const currentAssignment = { ...evidence, [queryVarName]: queryVal };
            const prob = sumOverHiddenVariables(currentAssignment);
            results[queryVal] = prob;
            alphaSum += prob;
        }
        
        stepsHtml += `<h4>Resultado final (normalizado)</h4><ul>`;
        for (const val in results) {
            const normalizedProb = results[val] / alphaSum;
            stepsHtml += `<li>P(${queryVarName}=${val}) = ${normalizedProb.toFixed(4)} (${(normalizedProb * 100).toFixed(2)}%)</li>`;
        }
        stepsHtml += `</ul>`;
        
    } catch (error) {
        stepsHtml += `<p>Error al calcular resultado: ${error.message}</p>`;
    }
    
    resultPanel.innerHTML = stepsHtml;
}

// Obtiene la evidencia actual desde los selects del panel
function getCurrentEvidence() {
    const evidence = {};
    nodes.forEach(node => {
        const select = document.getElementById(`ev_${node.id}`);
        if (select && select.value !== '') {
            evidence[node.name] = select.value;
        }
    });
    return evidence;
}

// Obtiene la variable de consulta seleccionada
function getCurrentQuery() {
    const select = document.getElementById('queryVar');
    if (!select || !select.value) return null;
    const node = nodes.find(n => n.id === select.value);
    return node ? node.name : null;
}