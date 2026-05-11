// graph.js - Manejo del grafo con layout automático y CPTs
let cy = null;
let nodes = [];
let edges = [];

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
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#666',
                    'target-arrow-color': '#666',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
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
    
    // Evento al hacer doble clic en un nodo (para definir CPT)
    cy.on('dbltap', 'node', (evt) => {
        const node = evt.target;
        const nodeId = node.data('id');
        showCPTModal(nodeId);
    });
    
    console.log("Cytoscape iniciado correctamente");
}

function addNodeToGraph(name) {
    if (!cy) {
        console.error("Cytoscape no está inicializado");
        return null;
    }
    
    const nodeId = `n${Date.now()}`;
    
    cy.add({
        group: 'nodes',
        data: { id: nodeId, label: name },
        position: { x: Math.random() * 500 + 50, y: Math.random() * 300 + 50 }
    });
    
    nodes.push({
        id: nodeId,
        name: name,
        values: ['True', 'False'],
        cpt: {}
    });
    
    // Aplicar layout para reorganizar automáticamente
    cy.layout({
        name: 'breadthfirst',
        fit: true,
        padding: 30,
        directed: true,
        roots: getRootNodes()
    }).run();
    
    updateSelectors();
    console.log(`Nodo agregado: ${name} (${nodeId})`);
    return nodeId;
}

// Obtener nodos que no tienen padres (raíces)
function getRootNodes() {
    const childNodes = new Set(edges.map(e => e.target));
    const rootIds = nodes.filter(n => !childNodes.has(n.id)).map(n => n.id);
    return rootIds;
}

// Verificar si agregar una arista crearía un ciclo
function wouldCreateCycle(parentId, childId) {
    const visited = new Set();
    const queue = [childId];
    
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === parentId) return true;
        
        if (visited.has(current)) continue;
        visited.add(current);
        
        const children = edges.filter(e => e.source === current).map(e => e.target);
        queue.push(...children);
    }
    return false;
}

function addEdgeToGraph(parentId, childId) {
    if (!cy) return false;
    
    const exists = edges.some(e => e.source === parentId && e.target === childId);
    if (exists) {
        alert('Esta conexión ya existe');
        return false;
    }
    
    if (wouldCreateCycle(parentId, childId)) {
        alert('Esta conexión crearía un ciclo (grafo no acíclico)');
        return false;
    }
    
    cy.add({
        group: 'edges',
        data: { id: `e${parentId}-${childId}`, source: parentId, target: childId }
    });
    
    edges.push({ source: parentId, target: childId });
    
    cy.layout({
        name: 'breadthfirst',
        fit: true,
        padding: 30,
        directed: true,
        roots: getRootNodes()
    }).run();
    
    updateSelectors();
    return true;
}

function updateSelectors() {
    const parentSelect = document.getElementById('selectParent');
    const childSelect = document.getElementById('selectChild');
    const querySelect = document.getElementById('queryVar');
    const evidencePanel = document.getElementById('evidencePanel');
    
    if (parentSelect) {
        parentSelect.innerHTML = '<option value="">-- Seleccionar --</option>';
        nodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = node.name;
            parentSelect.appendChild(option);
        });
    }
    
    if (childSelect) {
        childSelect.innerHTML = '<option value="">-- Seleccionar --</option>';
        nodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = node.name;
            childSelect.appendChild(option);
        });
    }
    
    if (querySelect) {
        querySelect.innerHTML = '<option value="">-- Seleccionar --</option>';
        nodes.forEach(node => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = node.name;
            querySelect.appendChild(option);
        });
    }
    
    if (evidencePanel) {
        evidencePanel.innerHTML = '';
        nodes.forEach(node => {
            const div = document.createElement('div');
            div.className = 'evidence-item';
            div.innerHTML = `
                <span style="width:80px">${node.name}:</span>
                <select id="ev_${node.id}">
                    <option value="">-- Sin evidencia --</option>
                    <option value="True">True</option>
                    <option value="False">False</option>
                </select>
            `;
            evidencePanel.appendChild(div);
        });
    }
}

function clearGraph() {
    if (cy) {
        cy.elements().remove();
    }
    nodes = [];
    edges = [];
    updateSelectors();
    document.getElementById('resultPanel').innerHTML = '<p>Grafo limpiado</p>';
}

function getGraphData() {
    return { nodes: nodes, edges: edges };
}

// ============================================
// FUNCIONES PARA CPTs
// ============================================

// Producto cartesiano de arrays
function cartesianProduct(arrays) {
    if (!arrays || arrays.length === 0) return [[]];
    return arrays.reduce((acc, curr) => {
        return acc.flatMap(c => curr.map(v => [...c, v]));
    }, [[]]);
}

// Calcular la suma de una fila y mostrarla
function updateRowSum(nodeId, comboIdx, numValues) {
    let sum = 0;
    for (let i = 0; i < numValues; i++) {
        const input = document.getElementById(`cpt_${nodeId}_${comboIdx}_${i}`);
        if (input && input.value) {
            sum += parseFloat(input.value) || 0;
        }
    }
    const sumSpan = document.getElementById(`sum_${nodeId}_${comboIdx}`);
    if (sumSpan) {
        sumSpan.textContent = sum.toFixed(3);
        sumSpan.style.color = Math.abs(sum - 1.0) < 0.01 ? '#2e7d32' : '#d32f2f';
    }
}

// Mostrar ventana modal para definir CPT de un nodo
function showCPTModal(nodeId) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    // Buscar los padres de este nodo
    const parents = edges.filter(e => e.target === nodeId).map(e => {
        const parentNode = nodes.find(n => n.id === e.source);
        return { id: e.source, name: parentNode ? parentNode.name : '?' };
    });
    
    // Actualizar título
    document.getElementById('modalNodeName').textContent = node.name;
    
    // Generar la tabla de CPT
    const modalBody = document.getElementById('modalBody');
    
    if (parents.length === 0) {
        // Nodo sin padres (probabilidad marginal)
        modalBody.innerHTML = `
            <table class="cpt-table">
                <thead>
                    <tr><th>${node.name}</th><th>Probabilidad</th></tr>
                </thead>
                <tbody>
                    ${node.values.map((val, idx) => `
                        <tr>
                            <td class="row-label">${val}</td>
                            <td><input type="number" id="cpt_${nodeId}_${idx}" step="0.01" min="0" max="1" placeholder="0.0 - 1.0"></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p><small>⚠️ Las probabilidades deben sumar 1.0</small></p>
        `;
    } else {
        // Nodo con padres (probabilidad condicional)
        const combinations = cartesianProduct(parents.map(() => ['True', 'False']));
        const combinationLabels = combinations.map(combo => 
            parents.map((p, i) => `${p.name}=${combo[i]}`).join(', ')
        );
        
        let tableHtml = `
            <table class="cpt-table">
                <thead>
                    <tr>
                        <th>Combinación de padres</th>
                        ${node.values.map(v => `<th>P(${node.name}=${v} | padres)</th>`).join('')}
                        <th>Suma</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        combinations.forEach((combo, comboIdx) => {
            const comboLabel = combinationLabels[comboIdx];
            tableHtml += `
                <tr>
                    <td class="row-label">${comboLabel}</td>
                    ${node.values.map((val, valIdx) => `
                        <td><input type="number" id="cpt_${nodeId}_${comboIdx}_${valIdx}" step="0.01" min="0" max="1" placeholder="0.0 - 1.0"></td>
                    `).join('')}
                    <td><span id="sum_${nodeId}_${comboIdx}" class="sum-indicator">0.00</span></td>
                </tr>
            `;
        });
        
        tableHtml += `</tbody>
            </table>
            <p><small>⚠️ Cada fila debe sumar 1.0</small></p>
        `;
        modalBody.innerHTML = tableHtml;
        
        // Agregar eventos para calcular sumas en tiempo real
        for (let comboIdx = 0; comboIdx < combinations.length; comboIdx++) {
            for (let valIdx = 0; valIdx < node.values.length; valIdx++) {
                const input = document.getElementById(`cpt_${nodeId}_${comboIdx}_${valIdx}`);
                if (input) {
                    input.addEventListener('input', () => updateRowSum(nodeId, comboIdx, node.values.length));
                }
            }
        }
    }
    
    // Cargar valores existentes si ya hay una CPT
    if (node.cpt && Object.keys(node.cpt).length > 0) {
        if (parents.length === 0) {
            for (let idx = 0; idx < node.values.length; idx++) {
                const val = node.values[idx];
                const input = document.getElementById(`cpt_${nodeId}_${idx}`);
                if (input && node.cpt[val] !== undefined) {
                    input.value = node.cpt[val];
                }
            }
        } else {
            const combinations = cartesianProduct(parents.map(() => ['True', 'False']));
            for (let comboIdx = 0; comboIdx < combinations.length; comboIdx++) {
                for (let valIdx = 0; valIdx < node.values.length; valIdx++) {
                    const input = document.getElementById(`cpt_${nodeId}_${comboIdx}_${valIdx}`);
                    if (input && node.cpt[comboIdx] && node.cpt[comboIdx][valIdx] !== undefined) {
                        input.value = node.cpt[comboIdx][valIdx];
                    }
                }
                updateRowSum(nodeId, comboIdx, node.values.length);
            }
        }
    }
    
    // Mostrar el modal
    document.getElementById('cptModal').style.display = 'block';
    window.currentCPTNodeId = nodeId;
}

// Guardar la CPT del nodo actual
function saveCurrentCPT() {
    const nodeId = window.currentCPTNodeId;
    if (!nodeId) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const parents = edges.filter(e => e.target === nodeId);
    const combinations = parents.length > 0 ? cartesianProduct(parents.map(() => ['True', 'False'])) : [];
    
    const newCPT = {};
    
    if (parents.length === 0) {
        // Nodo sin padres
        let rowSum = 0;
        for (let idx = 0; idx < node.values.length; idx++) {
            const val = node.values[idx];
            const input = document.getElementById(`cpt_${nodeId}_${idx}`);
            if (input && input.value) {
                const prob = parseFloat(input.value);
                newCPT[val] = prob;
                rowSum += prob;
            }
        }
        if (Math.abs(rowSum - 1.0) > 0.01) {
            alert(`Las probabilidades suman ${rowSum.toFixed(3)}. Deben sumar 1.0.`);
            return;
        }
    } else {
        // Nodo con padres
        for (let comboIdx = 0; comboIdx < combinations.length; comboIdx++) {
            newCPT[comboIdx] = [];
            let rowSum = 0;
            for (let valIdx = 0; valIdx < node.values.length; valIdx++) {
                const input = document.getElementById(`cpt_${nodeId}_${comboIdx}_${valIdx}`);
                if (input && input.value) {
                    const prob = parseFloat(input.value);
                    newCPT[comboIdx][valIdx] = prob;
                    rowSum += prob;
                }
            }
            if (Math.abs(rowSum - 1.0) > 0.01) {
                alert(`La fila ${comboIdx + 1} suma ${rowSum.toFixed(3)}. Debe sumar 1.0.`);
                return;
            }
        }
    }
    
    node.cpt = newCPT;
    console.log(`✅ CPT guardada para "${node.name}":`, newCPT);
    alert(`✅ CPT guardada para el nodo "${node.name}"`);
    closeCPTModal();
}

// Cerrar ventana modal
function closeCPTModal() {
    const modal = document.getElementById('cptModal');
    if (modal) {
        modal.style.display = 'none';
    }
    window.currentCPTNodeId = null;
}