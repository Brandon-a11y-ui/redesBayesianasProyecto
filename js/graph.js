// =========================================================================
// graph.js : Gestión del lienzo (Cytoscape.js), CPTs y Estructuras HMM
// =========================================================================

let cy = null;
let nodes = [];
let edges = [];
let nextNodeId = 1;

// Estructuras de datos globales para almacenar las matrices del HMM
let hmmStates = [];       // Nombres de los estados ocultos
let hmmObservations = []; // Nombres de las observaciones posibles
let hmmPi = [];           // Vector Distribución Inicial (Array de tamaño N)
let hmmA = [];            // Matriz de Transición (Matriz de NxN)
let hmmB = [];            // Matriz de Emisión (Matriz de NxM)

// Inicializa el grafo con Cytoscape
function initGraph() {
    console.log("Iniciando Cytoscape...");
    
    const container = document.getElementById('cy');
    if (!container) {
        console.error("No se encontró el elemento #cy");
        return;
    }
    
    cy = cytoscape({
        container: container,
        elements: [],
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'background-color': '#1a237e',
                    'color': 'white',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'width': '80px',
                    'height': '40px',
                    'font-size': '12px',
                    'border-width': 2,
                    'border-color': '#0d1652'
                }
            },
            {
                selector: 'node.hmm-state',
                style: {
                    'background-color': '#2e7d32', // Verde para estados ocultos HMM
                    'shape': 'ellipse',
                    'width': '60px',
                    'height': '60px'
                }
            },
            {
                selector: 'node.hmm-obs',
                style: {
                    'background-color': '#0288d1', // Azul para observaciones HMM (Estilo Original)
                    'shape': 'rectangle',
                    'width': '80px',
                    'height': '40px'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#666',
                    'target-arrow-color': '#666',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
                }
            },
            {
                selector: 'edge.hmm-transition',
                style: {
                    'line-color': '#c62828', // Rojo sólido para transiciones
                    'target-arrow-color': '#c62828',
                    'line-style': 'solid'
                }
            },
            {
                selector: 'edge.hmm-emission',
                style: {
                    'line-color': '#757575', // Gris discontinuo para emisiones
                    'target-arrow-color': '#757575',
                    'line-style': 'dashed'
                }
            }
        ],
        layout: {
            name: 'breadthfirst',
            fit: true,
            padding: 30,
            directed: true
        }
    });

    // Manejador de doble clic original para las CPTs Bayesianas
    cy.on('dblclick', 'node', function(evt) {
        const modelType = document.getElementById('globalModelType').value;
        if (modelType === 'bayes') {
            const nodeClicked = evt.target;
            openCPTModal(nodeClicked.id());
        }
    });
}

// =========================================================================
// MÉTODOS DE MANIPULACIÓN DEL GRAFO (Redes Bayesianas Nativas)
// =========================================================================
function addNodeToGraph(name) {
    const id = 'n' + Date.now() + Math.floor(Math.random() * 1000);
    const modelType = document.getElementById('globalModelType').value;

    if (modelType === 'bayes') {
        const newNode = { id: id, name: name, parents: [], cpt: {}, values: ['True', 'False'] };
        nodes.push(newNode);
        cy.add({ data: { id: id, label: name } });
        initializeCPT(newNode);
        cy.layout({ name: 'breadthfirst', directed: true, padding: 30 }).run();
        updateSelectors();
    } else {
        nodes.push({ id: id, name: name, isObservation: false });
    }
}

function addEdgeToGraph(parentId, childId) {
    if (wouldCreateCycle(parentId, childId)) {
        alert("Error: No se puede conectar. Rompe la propiedad Acíclica de la Red (DAG).");
        return;
    }
    const childNode = nodes.find(n => n.id === childId);
    if (childNode && !childNode.parents.includes(parentId)) {
        childNode.parents.push(parentId);
        cy.add({ data: { id: parentId + '_' + childId, source: parentId, target: childId } });
        initializeCPT(childNode);
        cy.layout({ name: 'bezier' }).run();
    }
}

function clearGraph() {
    nodes = [];
    hmmStates = [];
    hmmObservations = [];
    hmmPi = [];
    hmmA = [];
    hmmB = [];
    if (cy) cy.elements().remove();
    updateSelectors();
}

function wouldCreateCycle(startId, endId) {
    if (startId === endId) return true;
    let visited = new Set();
    let queue = [endId];
    while (queue.length > 0) {
        let curr = queue.shift();
        if (curr === startId) return true;
        visited.add(curr);
        let currNode = nodes.find(n => n.id === curr);
        if (currNode && currNode.parents) {
            currNode.parents.forEach(p => {
                if (!visited.has(p)) queue.push(p);
            });
        }
    }
    return false;
}

function updateSelectors() {
    const pSel = document.getElementById('selectParent');
    const cSel = document.getElementById('selectChild');
    const qSel = document.getElementById('queryVar');
    const evPanel = document.getElementById('evidencePanel');

    if (!pSel || !cSel || !qSel) return;

    pSel.innerHTML = '';
    cSel.innerHTML = '';
    qSel.innerHTML = '';
    if (evPanel) evPanel.innerHTML = '';

    nodes.forEach(n => {
        const o1 = document.createElement('option'); o1.value = n.id; o1.textContent = n.name;
        const o2 = document.createElement('option'); o2.value = n.id; o2.textContent = n.name;
        const o3 = document.createElement('option'); o3.value = n.id; o3.textContent = n.name;
        
        pSel.appendChild(o1);
        cSel.appendChild(o2);
        qSel.appendChild(o3);

        if (evPanel) {
            const row = document.createElement('div');
            row.className = 'evidence-row';
            row.innerHTML = `
                <span>${n.name}:</span>
                <select id="ev_${n.id}">
                    <option value="">Sin evidencia</option>
                    <option value="True">True</option>
                    <option value="False">False</option>
                </select>
            `;
            evPanel.appendChild(row);
        }
    });
}

// =========================================================================
// GESTIÓN DE TABLAS DE PROBABILIDAD CONDICIONAL (CPT Bayesianas)
// =========================================================================
let currentEditingNodeId = null;

function initializeCPT(node) {
    node.cpt = {};
    const combinations = getParentCombinations(node.parents);
    combinations.forEach(comb => {
        node.cpt[comb] = 0.5;
    });
}

function getParentCombinations(parentIds) {
    if (parentIds.length === 0) return [""];
    let result = [""];
    parentIds.forEach(pId => {
        const pNode = nodes.find(n => n.id === pId);
        let newResult = [];
        result.forEach(res => {
            newResult.push((res ? res + "," : "") + pNode.name + "=True");
            newResult.push((res ? res + "," : "") + pNode.name + "=False");
        });
        result = newResult;
    });
    return result;
}

function openCPTModal(nodeId) {
    currentEditingNodeId = nodeId;
    const node = nodes.find(n => n.id === nodeId);
    document.getElementById('modalNodeName').textContent = node.name;
    
    const body = document.getElementById('modalBody');
    body.innerHTML = '';

    let html = `<table class="cpt-table"><thead><tr>`;
    node.parents.forEach(pId => {
        html += `<th>${nodes.find(n => n.id === pId).name}</th>`;
    });
    html += `<th>P(${node.name} = True)</th><th>P(${node.name} = False)</th></tr></thead><tbody>`;

    const combinations = getParentCombinations(node.parents);
    combinations.forEach((comb, idx) => {
        html += `<tr>`;
        if (comb !== "") {
            const parts = comb.split(',');
            parts.forEach(p => { html += `<td>${p.split('=')[1]}</td>`; });
        }

        // --- ALGORITMO DE EMPAREJAMIENTO DE LLAVES POR CONTENIDO ---
        let valTrue = 0.5;
        if (node.cpt) {
            let currentPairs = comb.split(',').map(s => s.trim().toLowerCase());
            
            let correctKey = Object.keys(node.cpt).find(jsonKey => {
                let jsonPairs = jsonKey.split(',').map(s => s.trim().toLowerCase());
                if (jsonPairs.length !== currentPairs.length) return false;
                return jsonPairs.every(p => currentPairs.includes(p));
            });

            if (correctKey !== undefined) {
                valTrue = typeof node.cpt[correctKey] === 'number' ? node.cpt[correctKey] : 0.5;
            } else if (node.cpt[comb] !== undefined) {
                valTrue = typeof node.cpt[comb] === 'number' ? node.cpt[comb] : 0.5;
            }
        }

        const valFalse = (1 - valTrue).toFixed(4);

        html += `
            <td><input type="number" step="0.01" min="0" max="1" id="cpt_val_${idx}" value="${valTrue}" onchange="document.getElementById('cpt_lbl_${idx}').innerText = (1 - this.value).toFixed(4)"></td>
            <td id="cpt_lbl_${idx}">${valFalse}</td>
        </tr>`;
    });
    html += `</tbody></table>`;
    body.innerHTML = html;
    document.getElementById('cptModal').style.display = 'block';
}

function closeCPTModal() {
    document.getElementById('cptModal').style.display = 'none';
    currentEditingNodeId = null;
}

function saveCurrentCPT() {
    if (!currentEditingNodeId) return;
    const node = nodes.find(n => n.id === currentEditingNodeId);
    const combinations = getParentCombinations(node.parents);
    
    let newCPT = {};
    for (let i = 0; i < combinations.length; i++) {
        const inputVal = parseFloat(document.getElementById(`cpt_val_${i}`).value);
        if (isNaN(inputVal) || inputVal < 0 || inputVal > 1) {
            alert("Por favor, introduce valores probabilísticos válidos entre 0.0 y 1.0");
            return;
        }
        newCPT[combinations[i]] = inputVal;
    }
    node.cpt = newCPT;
    closeCPTModal();
    alert(`CPT de "${node.name}" guardada con éxito.`);
}

// =========================================================================
// ENTREGA NATIVA RECONSTRUIDA PARA MODELOS OCULTOS DE MARKOV (HMM) - INTACTA
// =========================================================================
function renderHMMTopology(statesTokens, observationsTokens) {
    clearGraph();
    hmmStates = statesTokens.map(s => s.trim()).filter(s => s);
    hmmObservations = observationsTokens.map(o => o.trim()).filter(o => o);

    const canvasWidth = document.getElementById('cy').clientWidth || 600;
    const paddingX = 80;

    // 1. Renderizar Estados Ocultos (Fila Superior - Círculos Verdes)
    const stateSpacing = (canvasWidth - paddingX * 2) / Math.max(1, hmmStates.length - 1);
    hmmStates.forEach((stateName, index) => {
        const id = 'state_' + stateName;
        const posX = paddingX + index * stateSpacing;
        const posY = 100;

        cy.add({
            group: 'nodes',
            data: { id: id, label: stateName },
            position: { x: posX, y: posY },
            classes: 'hmm-state'
        });
        nodes.push({ id: id, name: stateName, isObservation: false, values: ['True', 'False'] });
    });

    // 2. Renderizar Observaciones (Fila Inferior - Rectángulos Azules Originales)
    const obsSpacing = (canvasWidth - paddingX * 2) / Math.max(1, hmmObservations.length - 1);
    hmmObservations.forEach((obsName, index) => {
        const id = 'obs_' + obsName;
        const posX = paddingX + index * obsSpacing;
        const posY = 280;

        cy.add({
            group: 'nodes',
            data: { id: id, label: obsName },
            position: { x: posX, y: posY },
            classes: 'hmm-obs'
        });
        nodes.push({ id: id, name: obsName, isObservation: true });
    });

    // 3. Crear Arcos de Transición en la Cadena Oculta (Rojo Sólido)
    for (let i = 0; i < hmmStates.length; i++) {
        for (let j = 0; j < hmmStates.length; j++) {
            cy.add({
                group: 'edges',
                data: {
                    id: `t_edge_${hmmStates[i]}_${hmmStates[j]}`,
                    source: 'state_' + hmmStates[i],
                    target: 'state_' + hmmStates[j]
                },
                classes: 'hmm-transition'
            });
        }
    }

    // 4. Crear Arcos de Emisión (Gris Discontinuo)
    for (let i = 0; i < hmmStates.length; i++) {
        for (let j = 0; j < hmmObservations.length; j++) {
            cy.add({
                group: 'edges',
                data: {
                    id: `e_edge_${hmmStates[i]}_${hmmObservations[j]}`,
                    source: 'state_' + hmmStates[i],
                    target: 'obs_' + hmmObservations[j]
                },
                classes: 'hmm-emission'
            });
        }
    }

    cy.fit(50);
}

// =========================================================================
// CONSTRUCTOR DE FORMULARIOS DE MATRICES HMM - INTACTO
// =========================================================================
function buildHMMModalTables() {
    const container = document.getElementById('hmmModalBody');
    container.innerHTML = '';

    if (hmmStates.length === 0 || hmmObservations.length === 0) return;

    let html = '';

    // Vector Pi
    html += `<h4>Vector de Distribución Inicial (π)</h4>`;
    html += `<table class="hmm-matrix-table"><thead><tr>`;
    hmmStates.forEach(s => { html += `<th>${s}</th>`; });
    html += `</tr></thead><tbody><tr>`;
    hmmStates.forEach((s, i) => {
        const val = hmmPi[i] !== undefined ? hmmPi[i] : (1 / hmmStates.length).toFixed(2);
        html += `<td><input type="number" step="0.01" min="0" max="1" id="hmm_pi_${i}" value="${val}"></td>`;
    });
    html += `</tr></tbody></table><hr>`;

    // Matriz A
    html += `<h4>Matriz de Transición de Estados (A) [Fila -> Columna]</h4>`;
    html += `<table class="hmm-matrix-table"><thead><tr><th>Estado Actual</th>`;
    hmmStates.forEach(s => { html += `<th>${s}</th>`; });
    html += `</tr></thead><tbody>`;
    hmmStates.forEach((sRow, i) => {
        html += `<tr><td><strong>${sRow}</strong></td>`;
        hmmStates.forEach((sCol, j) => {
            let val = (1 / hmmStates.length).toFixed(2);
            if (hmmA[i] && hmmA[i][j] !== undefined) val = hmmA[i][j];
            html += `<td><input type="number" step="0.01" min="0" max="1" id="hmm_A_${i}_${j}" value="${val}"></td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table><hr>`;

    // Matriz B
    html += `<h4>Matriz de Emisión de Observaciones (B)</h4>`;
    html += `<table class="hmm-matrix-table"><thead><tr><th>Estado Oculto</th>`;
    hmmObservations.forEach(o => { html += `<th>${o}</th>`; });
    html += `</tr></thead><tbody>`;
    hmmStates.forEach((s, i) => {
        html += `<tr><td><strong>${s}</strong></td>`;
        hmmObservations.forEach((o, j) => {
            let val = (1 / hmmObservations.length).toFixed(2);
            if (hmmB[i] && hmmB[i][j] !== undefined) val = hmmB[i][j];
            html += `<td><input type="number" step="0.01" min="0" max="1" id="hmm_B_${i}_${j}" value="${val}"></td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table>`;

    container.innerHTML = html;
}

function saveHMMParameters() {
    hmmPi = [];
    hmmA = [];
    hmmB = [];

    const N = hmmStates.length;
    const M = hmmObservations.length;

    for (let i = 0; i < N; i++) {
        hmmPi.push(parseFloat(document.getElementById(`hmm_pi_${i}`).value));
    }

    for (let i = 0; i < N; i++) {
        let row = [];
        for (let j = 0; j < N; j++) {
            row.push(parseFloat(document.getElementById(`hmm_A_${i}_${j}`).value));
        }
        hmmA.push(row);
    }

    for (let i = 0; i < N; i++) {
        let row = [];
        for (let j = 0; j < M; j++) {
            row.push(parseFloat(document.getElementById(`hmm_B_${i}_${j}`).value));
        }
        hmmB.push(row);
    }

    alert("📊 Parámetros del HMM almacenados correctamente en memoria y listos para inferencia.");
}

// =========================================================================
// MÉTODOS DE PERSISTENCIA (LECTURA OPTIMIZADA DESDE TU FUNCIÓN ADAPTADA)
// =========================================================================
function saveNetwork() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(nodes));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "red_bayesiana.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
}

function loadNetworkFromFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            
            // Lector tolerante para arreglos directos o envueltos
            const uploadedNodes = parsedData.nodes ? parsedData.nodes : parsedData;
            
            if (!Array.isArray(uploadedNodes)) {
                throw new Error("El formato del JSON no contiene un arreglo de nodos válido.");
            }

            clearGraph();
            nodes = []; 

            // Inyectar nodos conservando la CPT original intacta
            uploadedNodes.forEach(n => {
                let cleanParents = [];
                if (n.parents && Array.isArray(n.parents)) {
                    cleanParents = n.parents.map(p => typeof p === 'object' ? String(p.id || p.parentId) : String(p));
                }

                nodes.push({
                    id: String(n.id),         
                    name: String(n.name),
                    parents: cleanParents,
                    cpt: n.cpt || {},
                    values: n.values || ['True', 'False']
                });
            });
            
            // Renderizar los nodos en Cytoscape
            nodes.forEach(n => {
                cy.add({ 
                    group: 'nodes',
                    data: { id: n.id, label: n.name }
                });
            });
            
            // Renderizar aristas basándose en la lista de padres
            nodes.forEach(n => {
                if (n.parents && n.parents.length > 0) {
                    n.parents.forEach(pId => {
                        if (cy.getElementById(pId).length > 0) {
                            const edgeId = pId + '_' + n.id;
                            if (cy.getElementById(edgeId).length === 0) {
                                cy.add({ 
                                    group: 'edges',
                                    data: { id: edgeId, source: pId, target: n.id }
                                });
                            }
                        }
                    });
                }
            });

            // Compatibilidad por aristas externas explícitas
            if (parsedData.edges && Array.isArray(parsedData.edges)) {
                parsedData.edges.forEach(e => {
                    const sId = String(e.source || e.parentId);
                    const tId = String(e.target || e.childId);
                    const edgeId = sId + '_' + tId;

                    if (cy.getElementById(sId).length > 0 && cy.getElementById(tId).length > 0) {
                        if (cy.getElementById(edgeId).length === 0) {
                            cy.add({ group: 'edges', data: { id: edgeId, source: sId, target: tId } });
                        }
                        const childNode = nodes.find(node => node.id === tId);
                        if (childNode && !childNode.parents.includes(sId)) {
                            childNode.parents.push(sId);
                        }
                    }
                });
            }
            
            cy.layout({
                name: 'breadthfirst',
                directed: true,
                animate: false,
                fit: true,
                padding: 40
            }).run();
            
            cy.fit(50); 
            updateSelectors(); 
            
            alert("¡Red Bayesiana y valores de la CPT restaurados al 100%!");
        } catch (err) {
            console.error(err);
            alert("Error crítico al cargar el archivo JSON: " + err.message);
        }
    };
    reader.readAsText(file);
}

const saveNetworkToFile = saveNetwork;