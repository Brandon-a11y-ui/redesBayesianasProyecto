// inference.js - Implementación de Inferencia por Enumeración (DCC)
// Basado en la fórmula: P(X|e) = α * Σ P(X, e, y)

/**
 * Función principal llamada por el botón "Inferir"
 */
async function runInference() {
    const queryVarName = getCurrentQuery();
    const evidence = getCurrentEvidence();
    const resultPanel = document.getElementById('resultPanel');

    if (!queryVarName) {
        resultPanel.innerHTML = '<p>❌ Selecciona una variable de consulta</p>';
        return;
    }

    // Verificar que todos los nodos tengan su CPT definida
    const missingCPTs = nodes.filter(n => !n.cpt || Object.keys(n.cpt).length === 0);
    if (missingCPTs.length > 0) {
        resultPanel.innerHTML = `
            <p><strong>Consulta:</strong> ${queryVarName}</p>
            <p><strong>⚠️ Faltan CPTs para:</strong> ${missingCPTs.map(n => n.name).join(', ')}</p>
            <p><em>Haz doble clic en los nodos para definir sus probabilidades.</em></p>
        `;
        return;
    }

    try {
        const queryNode = nodes.find(n => n.name === queryVarName);
        const results = {};
        let alphaSum = 0;

        // Calculamos P(Consulta = valor, Evidencia) para cada estado (True/False)
        for (const queryVal of queryNode.values) {
            const currentAssignment = { ...evidence, [queryVarName]: queryVal };
            
            // La sumatoria sobre variables ocultas (DCC)
            const prob = sumOverHiddenVariables(currentAssignment);
            results[queryVal] = prob;
            alphaSum += prob;
        }

        // Mostrar resultados normalizados (Alfa)
        let html = `
            <p><strong>Variable consulta:</strong> ${queryVarName}</p>
            <p><strong>Evidencia:</strong> ${Object.keys(evidence).length > 0 ? Object.entries(evidence).map(([k,v]) => `${k}=${v}`).join(', ') : 'ninguna'}</p>
            <p><strong>Resultados (Distribución a posteriori):</strong></p>
            <ul>
        `;

        for (const val in results) {
            const normalizedProb = results[val] / alphaSum;
            html += `<li>P(${queryVarName}=${val}) = ${normalizedProb.toFixed(4)} (${(normalizedProb * 100).toFixed(2)}%)</li>`;
        }

        html += `</ul><p><small>✓ Inferencia mediante sumatoria de productos (DCC)</small></p>`;
        resultPanel.innerHTML = html;

    } catch (error) {
        console.error(error);
        resultPanel.innerHTML = `<p>❌ Error en el cálculo: ${error.message}</p>`;
    }
}

/**
 * Sumatoria recursiva sobre las variables ocultas (las que no son ni consulta ni evidencia)
 */
function sumOverHiddenVariables(assignment) {
    // Buscar la primera variable que no tenga un valor asignado en este escenario
    const nextVar = nodes.find(n => assignment[n.name] === undefined);

    if (!nextVar) {
        // Caso base: Ya tenemos un evento atómico completo. Calculamos el producto de la red.
        return calculateJointProbability(assignment);
    }

    // Caso recursivo: Sumar los resultados de asignar cada valor posible (True/False)
    let sum = 0;
    for (const val of nextVar.values) {
        sum += sumOverHiddenVariables({ ...assignment, [nextVar.name]: val });
    }
    return sum;
}

/**
 * Calcula el producto de probabilidades condicionales: Π P(Xi | padres(Xi))
 */
function calculateJointProbability(assignment) {
    let jointProb = 1;

    for (const node of nodes) {
        const parents = edges.filter(e => e.target === node.id)
                             .map(e => nodes.find(n => n.id === e.source));
        
        const nodeVal = assignment[node.name];
        let prob = 0;

        if (parents.length === 0) {
            // Nodo raíz: P(Nodo)
            prob = node.cpt[nodeVal];
        } else {
            // Nodo con padres: P(Nodo | Padres)
            const parentValues = parents.map(p => assignment[p.name]);
            const comboIdx = getComboIndex(parents, parentValues);
            const valIdx = node.values.indexOf(nodeVal);
            
            // Accedemos a la fila (comboIdx) y a la columna del valor (valIdx)
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

/**
 * Busca el índice de la combinación de padres que coincide con los valores actuales
 */
function getComboIndex(parents, currentValues) {
    // Generamos las mismas combinaciones que genera el modal en graph.js
    const combinations = cartesianProduct(parents.map(() => ['True', 'False']));
    
    for (let i = 0; i < combinations.length; i++) {
        // Si todos los valores de la combinación coinciden con los del escenario actual
        if (combinations[i].every((val, idx) => val === currentValues[idx])) {
            return i;
        }
    }
    return 0;
}

// Funciones auxiliares para obtener el estado actual de la UI
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

function getCurrentQuery() {
    const select = document.getElementById('queryVar');
    if (!select || !select.value) return null;
    const node = nodes.find(n => n.id === select.value);
    return node ? node.name : null;
}