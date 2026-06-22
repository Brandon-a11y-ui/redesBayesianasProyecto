// =========================================================================
// graph.js : Gestión del lienzo (Cytoscape.js), CPTs y Estructuras HMM
// =========================================================================

let cy;
let nodes = []; // Estructura: { id, name, parents: [], cpt: {} }

// Estructuras de datos globales para almacenar las matrices del HMM
let hmmStates = [];       // Nombres de los estados ocultos
let hmmObservations = []; // Nombres de las observaciones posibles
let hmmPi = [];           // Vector Distribución Inicial (Array de tamaño N)
let hmmA = [];            // Matriz de Transición (Matriz de NxN)
let hmmB = [];            // Matriz de Emisión (Matriz de NxM)

// Inicialización del lienzo Cytoscape
function initGraph() {
    cy = cytoscape({
        container: document.getElementById('cy'),
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#1a237e',
                    'label': 'data(name)',
                    'color': '#fff',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': '12px',
                    'width': '60px',
                    'height': '60px'
                }
            },
            {
                selector: 'node.hmm-state',
                style: {
                    'background-color': '#2e7d32', // Verde para estados ocultos HMM
                    'shape': 'ellipse'
                }
            },
            {
                selector: 'node.hmm-obs',
                style: {
                    'background-color': '#ef6c00', // Naranja para observaciones HMM
                    'shape': 'rectangle'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 3,
                    'line-color': '#78909c',
                    'target-arrow-color': '#78909c',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'control-point-step-size': 40
                }
            },
            {
                selector: 'edge.hmm-edge',
                style: {
                    'line-color': '#455a64',
                    'target-arrow-color': '#455a64',
                    'label': 'data(label)',
                    'font-size': '10px',
                    'color': '#333',
                    'text-background-opacity': 0.7,
                    'text-background-color': '#fff',
                    'text-background-padding': '3px',
                    'text-background-shape': 'roundrectangle'
                }
            }
        ],
        layout: { name: 'grid' }
    });

    // Evento de doble clic sobre los nodos del grafo
    cy.on('dblclick', 'node', (evt) => {
        const nodeClicked = evt.target;
        const currentModel = document.getElementById('globalModelType').value;

        if (currentModel === 'bayes') {
            openCPTModal(nodeClicked.id());
        } else {
            alert("En el modo HMM, los parámetros globales se configuran colectivamente desde el botón 'Configurar Matrices HMM' en el panel izquierdo.");
        }
    });
}

// =========================================================================
// MÉTODOS DE LA INTERFAZ DE USUARIO Y GRAFO (BAYES ORIGINAL)
// =========================================================================
function addNodeToGraph(name) {
    const id = 'n' + (nodes.length + 1) + '_' + Date.now();
    const newNode = {
        id: id,
        name: name,
        parents: [],
        cpt: {}
    };
    
    initializeCPT(newNode);
    nodes.push(newNode);

    cy.add({
        group: 'nodes',
        data: { id: id, name: name }
    });

    cy.layout({
        name: 'breadthfirst',
        directed: true,
        animate: true,
        animationDuration: 300,
        fit: true,
        padding: 40
    }).run();

    updateSelectors();
}

function addEdgeToGraph(parentId, childId) {
    if (parentId === childId) return;

    if (wouldCreateCycle(parentId, childId)) {
        alert("Error: No se puede añadir la conexión ya que generaría un ciclo. Las Redes Bayesianas son Grafos Acíclicos Dirigidos (DAG).");
        return;
    }

    const childNode = nodes.find(n => n.id === childId);
    if (!childNode) return;

    if (childNode.parents.includes(parentId)) {
        alert("La conexión ya existe actualmente.");
        return;
    }

    childNode.parents.push(parentId);
    
    cy.add({
        group: 'edges',
        data: { id: parentId + '_' + childId, source: parentId, target: childId }
    });

    initializeCPT(childNode);

    cy.layout({
        name: 'breadthfirst',
        directed: true,
        animate: true,
        animationDuration: 300,
        fit: true,
        padding: 40
    }).run();

    updateSelectors();
}

function wouldCreateCycle(sourceId, targetId) {
    let visited = new Set();
    let queue = [targetId];

    while (queue.length > 0) {
        let curr = queue.shift();
        if (curr === sourceId) return true;

        let currNode = nodes.find(n => n.id === curr);
        if (currNode && currNode.parents) {
            let childrenIds = [];
            nodes.forEach(n => {
                if (n.parents.includes(curr)) { childrenIds.push(n.id); }
            });
            childrenIds.forEach(c => {
                if (!visited.has(c)) {
                    visited.add(c);
                    queue.push(c);
                }
            });
        }
    }
    return false;
}

function initializeCPT(node) {
    node.cpt = {};
    const combinations = getParentCombinations(node.parents);

    if (combinations.length === 0) {
        node.cpt["true"] = 0.5;
    } else {
        combinations.forEach(comb => {
            node.cpt[comb] = 0.5;
        });
    }
}

function getParentCombinations(parentIds) {
    if (!parentIds || parentIds.length === 0) return [];
    
    let results = [[]];
    for (let i = 0; i < parentIds.length; i++) {
        let pNode = nodes.find(n => n.id === parentIds[i]);
        let pName = pNode ? pNode.name : parentIds[i];
        
        let newResults = [];
        results.forEach(res => {
            newResults.push([...res, `${pName}=True`]);
            newResults.push([...res, `${pName}=False`]);
        });
        results = newResults;
    }
    return results.map(res => res.join(', '));
}

function updateSelectors() {
    const selParent = document.getElementById('selectParent');
    const selChild = document.getElementById('selectChild');
    const queryVar = document.getElementById('queryVar');
    const evPanel = document.getElementById('evidencePanel');

    if (!selParent) return; 

    selParent.innerHTML = '';
    selChild.innerHTML = '';
    queryVar.innerHTML = '<option value="">-- Seleccionar --</option>';
    if (evPanel) evPanel.innerHTML = '';

    nodes.forEach(n => {
        let opt1 = document.createElement('option');
        opt1.value = n.id; opt1.textContent = n.name;
        selParent.appendChild(opt1);

        let opt2 = document.createElement('option');
        opt2.value = n.id; opt2.textContent = n.name;
        selChild.appendChild(opt2);

        let opt3 = document.createElement('option');
        opt3.value = n.id; opt3.textContent = n.name;
        queryVar.appendChild(opt3);

        if (evPanel) {
            let div = document.createElement('div');
            div.className = 'evidence-row';
            div.innerHTML = `
                <span>${n.name}:</span>
                <select id="ev_${n.id}">
                    <option value="none">Sin Evidencia</option>
                    <option value="True">True</option>
                    <option value="False">False</option>
                </select>
            `;
            evPanel.appendChild(div);
        }
    });
}

function clearGraph() {
    if (cy) cy.elements().remove();
    nodes = [];
    hmmStates = [];
    hmmObservations = [];
    hmmPi = [];
    hmmA = [];
    hmmB = [];
    updateSelectors();
    document.getElementById('resultPanel').innerHTML = '<p>Esperando consulta o secuencia...</p>';
}

// =========================================================================
// VENTANA MODAL PARA EDICIÓN DE CPTS (CON PARSER DE PERMUTACIÓN DE CLAVES)
// =========================================================================
let currentModalNodeId = null;

function openCPTModal(nodeId) {
    currentModalNodeId = nodeId;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    document.getElementById('modalNodeName').textContent = node.name;
    const body = document.getElementById('modalBody');
    body.innerHTML = '';

    const combinations = getParentCombinations(node.parents);
    let tableHtml = `<table class="cpt-table">`;

    if (combinations.length === 0) {
        // Nodo raíz (Prior sin condiciones)
        let savedVal = 0.5;
        if (node.cpt) {
            if (node.cpt["true"] !== undefined) savedVal = node.cpt["true"];
            else if (node.cpt["True"] !== undefined) savedVal = node.cpt["True"];
            else if (node.cpt[""] !== undefined) savedVal = node.cpt[""];
        }
        
        tableHtml += `
            <thead>
                <tr><th>Condición</th><th>P(True)</th><th>P(False)</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td>Prior Probabilidad Base</td>
                    <td><input type="number" step="0.01" min="0" max="1" id="cpt_base_true" value="${savedVal}" oninput="syncModalInputs('cpt_base_true','cpt_base_false')"></td>
                    <td><input type="number" id="cpt_base_false" value="${(1 - savedVal).toFixed(4)}" disabled></td>
                </tr>
            </tbody>`;
    } else {
        // Nodo condicionado
        tableHtml += `<thead><tr>`;
        node.parents.forEach(pId => {
            let pNode = nodes.find(n => n.id === pId);
            tableHtml += `<th>${pNode ? pNode.name : 'Padre'}</th>`;
        });
        tableHtml += `<th>P(True | Padres)</th><th>P(False | Padres)</th></tr></thead><tbody>`;

        combinations.forEach((comb, idx) => {
            const states = comb.split(', ');
            tableHtml += `<tr>`;
            states.forEach(st => {
                let val = st.split('=')[1];
                tableHtml += `<td>${val}</td>`;
            });

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
                    valTrue = node.cpt[correctKey];
                } else if (node.cpt[comb] !== undefined) {
                    valTrue = node.cpt[comb];
                }
            }
            
            const valFalse = (1 - valTrue).toFixed(4);

            tableHtml += `
                <td><input type="number" step="0.01" min="0" max="1" class="cpt-matrix-input" data-comb="${comb}" id="cpt_input_t_${idx}" value="${valTrue}" oninput="syncModalInputs('cpt_input_t_${idx}','cpt_input_f_${idx}')"></td>
                <td id="cpt_input_f_${idx}">${valFalse}</td>
            </tr>`;
        });
    }

    tableHtml += `</tbody></table><p><small style="color:#2e7d32; font-weight:bold;">Cada fila debe sumar exactamente 1.0</small></p>`;
    body.innerHTML = tableHtml;
    document.getElementById('cptModal').style.display = 'block';
}

function syncModalInputs(trueInputId, falseInputId) {
    const trueInput = document.getElementById(trueInputId);
    const falseInput = document.getElementById(falseInputId);
    if (trueInput && falseInput) {
        let val = parseFloat(trueInput.value);
        if (isNaN(val)) val = 0;
        if (val < 0) { val = 0; trueInput.value = 0; }
        if (val > 1) { val = 1; trueInput.value = 1; }
        
        if(falseInput.tagName === 'INPUT') {
            falseInput.value = (1 - val).toFixed(4);
        } else {
            falseInput.innerText = (1 - val).toFixed(4);
        }
    }
}

// =========================================================================
// ENTREGA NATIVA: RENDERIZADOR E INGESTA AUTOMÁTICA DEL HMM (MANTENIDO)
// =========================================================================
function renderHMMTopology(statesTokens, observationsTokens) {
    if (cy) cy.elements().remove();
    nodes = [];

    // Limpieza e inyección limpia en variables globales
    hmmStates = statesTokens.map(s => s.trim()).filter(s => s);
    hmmObservations = observationsTokens.map(o => o.trim()).filter(o => o);

    // 1. Dibujar Estados Ocultos (Círculos verdes en fila superior)
    hmmStates.forEach((stateName, idx) => {
        const nodeId = 'hmm_s_' + idx;
        nodes.push({ id: nodeId, name: stateName, type: 'state' });
        cy.add({
            group: 'nodes',
            data: { id: nodeId, name: stateName },
            classes: 'hmm-state',
            position: { x: 150 + (idx * 160), y: 100 }
        });
    });

    // 2. Dibujar Nodos de Observación (Rectángulos naranjas en fila inferior)
    hmmObservations.forEach((obsName, idx) => {
        const nodeId = 'hmm_o_' + idx;
        nodes.push({ id: nodeId, name: obsName, type: 'observation' });
        cy.add({
            group: 'nodes',
            data: { id: nodeId, name: obsName },
            classes: 'hmm-obs',
            position: { x: 150 + (idx * 140), y: 280 }
        });
    });

    // 3. Dibujar aristas de Transición (A)
    for (let i = 0; i < hmmStates.length; i++) {
        let srcId = 'hmm_s_' + i;
        cy.add({ group: 'edges', data: { id: `trans_self_${i}`, source: srcId, target: srcId, label: 'a(i,i)' }, classes: 'hmm-edge' });
        if (i < hmmStates.length - 1) {
            let dstId = 'hmm_s_' + (i + 1);
            cy.add({ group: 'edges', data: { id: `trans_next_${i}`, source: srcId, target: dstId, label: 'a(i,j)' }, classes: 'hmm-edge' });
        }
    }

    // 4. Dibujar aristas de Emisión (B)
    for (let i = 0; i < hmmStates.length; i++) {
        for (let j = 0; j < Math.min(hmmObservations.length, 3); j++) {
            cy.add({
                group: 'edges',
                data: { id: `emis_${i}_${j}`, source: 'hmm_s_' + i, target: 'hmm_o_' + j, label: 'b(i,k)' },
                classes: 'hmm-edge'
            });
        }
    }
    cy.fit();
}

// =========================================================================
// MÉTODOS DE PERSISTENCIA (CON TU IMPLEMENTACIÓN ESTRICTA DE CARGA)
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
            const uploadedNodes = parsedData.nodes ? parsedData.nodes : parsedData;
            
            if (!Array.isArray(uploadedNodes)) {
                throw new Error("El formato del JSON no contiene un arreglo de nodos válido.");
            }

            clearGraph();
            nodes = []; 

            uploadedNodes.forEach(n => {
                let cleanParents = [];
                if (n.parents && Array.isArray(n.parents)) {
                    cleanParents = n.parents.map(p => typeof p === 'object' ? String(p.id || p.parentId) : String(p));
                }

                nodes.push({
                    id: String(n.id),         
                    name: String(n.name),
                    parents: cleanParents,
                    cpt: n.cpt || {}          
                });
            });
            
            nodes.forEach(n => {
                cy.add({ 
                    group: 'nodes',
                    data: { id: n.id, name: n.name }
                });
            });
            
            nodes.forEach(n => {
                if (n.parents && n.parents.length > 0) {
                    n.parents.forEach(pId => {
                        if (cy.getElementById(pId).length > 0) {
                            const edgeId = pId + '_' + n.id;
                            if (cy.getElementById(edgeId).length === 0) {
                                cy.add({ 
                                    group: 'edges',
                                    data: { 
                                        id: edgeId, 
                                        source: pId, 
                                        target: n.id 
                                    }
                                });
                            }
                        }
                    });
                }
            });

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
            
            alert("¡Red Bayesiana, jerarquías y valores de la CPT restaurados al 100%!");
        } catch (err) {
            console.error(err);
            alert("Error crítico al cargar el archivo JSON: " + err.message);
        }
    };
    reader.readAsText(file);
}

// Alises de compatibilidad global para main.js
const saveNetworkToFile = saveNetwork;