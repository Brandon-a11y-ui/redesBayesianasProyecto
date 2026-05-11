// inference.js - Usando librería bayesjs para inferencia

// Cargar la librería bayesjs (desde CDN)
function loadBayesJS() {
    return new Promise((resolve, reject) => {
        if (window.bayes) {
            resolve(window.bayes);
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/bayesjs@0.2.0/dist/bayes.min.js';
        script.onload = () => resolve(window.bayes);
        script.onerror = () => reject(new Error('No se pudo cargar bayesjs'));
        document.head.appendChild(script);
    });
}

// Convertir la red de nuestra interfaz al formato de bayesjs
function convertToBayesFormat() {
    const network = { nodes: {}, edges: [] };
    
    // Agregar nodos con sus valores
    for (const node of nodes) {
        network.nodes[node.name] = { values: node.values };
    }
    
    // Agregar conexiones (edges)
    for (const edge of edges) {
        const parentNode = nodes.find(n => n.id === edge.source);
        const childNode = nodes.find(n => n.id === edge.target);
        if (parentNode && childNode) {
            network.edges.push({ from: parentNode.name, to: childNode.name });
        }
    }
    
    // Agregar CPTs
    const cpts = {};
    for (const node of nodes) {
        const parents = edges.filter(e => e.target === node.id)
            .map(e => nodes.find(n => n.id === e.source).name);
        
        if (parents.length === 0) {
            // Nodo sin padres: { "True": 0.01, "False": 0.99 }
            cpts[node.name] = node.cpt;
        } else {
            // Nodo con padres: reorganizar al formato de bayesjs
            const formattedCPT = {};
            const parentCombos = generateParentCombinations(parents);
            
            for (let i = 0; i < parentCombos.length; i++) {
                const combo = parentCombos[i];
                const comboKey = combo.join(',');
                
                const probs = {};
                for (let j = 0; j < node.values.length; j++) {
                    const value = node.values[j];
                    let prob = 0;
                    if (node.cpt[i] && node.cpt[i][j] !== undefined) {
                        prob = node.cpt[i][j];
                    }
                    probs[value] = prob;
                }
                formattedCPT[comboKey] = probs;
            }
            cpts[node.name] = formattedCPT;
        }
    }
    
    return { network, cpts };
}

// Generar todas las combinaciones de valores de los padres
function generateParentCombinations(parents) {
    if (parents.length === 0) return [[]];
    const result = [];
    function generate(current, depth) {
        if (depth === parents.length) {
            result.push([...current]);
            return;
        }
        generate([...current, 'True'], depth + 1);
        generate([...current, 'False'], depth + 1);
    }
    generate([], 0);
    return result;
}

// Obtener evidencia actual
function getCurrentEvidence() {
    const evidence = {};
    for (const node of nodes) {
        const select = document.getElementById(`ev_${node.id}`);
        if (select && select.value !== '') {
            evidence[node.name] = select.value;
        }
    }
    return evidence;
}

// Obtener variable de consulta actual
function getCurrentQuery() {
    const select = document.getElementById('queryVar');
    if (!select || !select.value) return null;
    const nodeId = select.value;
    const node = nodes.find(n => n.id === nodeId);
    return node ? node.name : null;
}

// Función principal de inferencia
async function runInference() {
    const queryVar = getCurrentQuery();
    const evidence = getCurrentEvidence();
    
    if (!queryVar) {
        document.getElementById('resultPanel').innerHTML = '<p>❌ Selecciona una variable de consulta</p>';
        return;
    }
    
    // Verificar que todas las CPTs existan
    const missingCPTs = nodes.filter(n => !n.cpt || Object.keys(n.cpt).length === 0);
    if (missingCPTs.length > 0) {
        document.getElementById('resultPanel').innerHTML = `
            <p><strong>Variable consulta:</strong> ${queryVar}</p>
            <p><strong>⚠️ Faltan CPTs para:</strong> ${missingCPTs.map(n => n.name).join(', ')}</p>
            <p><em>Haz doble clic en cada nodo para definir sus probabilidades.</em></p>
        `;
        return;
    }
    
    try {
        // Cargar bayesjs
        const bayes = await loadBayesJS();
        
        // Convertir nuestra red al formato de bayesjs
        const { network, cpts } = convertToBayesFormat();
        
        // Crear el modelo en bayesjs
        const model = bayes.fromObject({ network, cpts });
        
        // Ejecutar inferencia
        const result = bayes.infer(model, queryVar, evidence);
        
        // Mostrar resultados
        let html = `
            <p><strong>Variable consulta:</strong> ${queryVar}</p>
            <p><strong>Evidencia:</strong> ${Object.keys(evidence).length > 0 ? Object.entries(evidence).map(([k,v]) => `${k}=${v}`).join(', ') : 'ninguna'}</p>
            <p><strong>Resultados (eliminación de variables):</strong></p>
            <ul>
        `;
        
        for (const [value, prob] of Object.entries(result)) {
            html += `<li>P(${queryVar}=${value}) = ${prob.toFixed(4)} (${(prob * 100).toFixed(2)}%)</li>`;
        }
        
        html += `</ul><p><small>✓ Inferencia usando algoritmo de eliminación de variables (bayesjs)</small></p>`;
        document.getElementById('resultPanel').innerHTML = html;
        
    } catch (error) {
        console.error(error);
        document.getElementById('resultPanel').innerHTML = `
            <p><strong>Variable consulta:</strong> ${queryVar}</p>
            <p><strong>❌ Error al ejecutar inferencia:</strong> ${error.message}</p>
            <p><em>Verifica que todas las CPTs tengan valores válidos (suma 1.0 por fila).</em></p>
        `;
    }
}