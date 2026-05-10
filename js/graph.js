// graph.js - Manejo del grafo con layout automático
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