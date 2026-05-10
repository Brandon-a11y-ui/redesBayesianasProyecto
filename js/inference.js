// inference.js - Algoritmo de eliminación de variables
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

function getCurrentQuery() {
    const select = document.getElementById('queryVar');
    return select ? select.value : null;
}

function runInference() {
    const queryNodeId = getCurrentQuery();
    const evidence = getCurrentEvidence();
    
    if (!queryNodeId) {
        document.getElementById('resultPanel').innerHTML = '<p>❌ Selecciona una variable de consulta</p>';
        return;
    }
    
    const queryNode = nodes.find(n => n.id === queryNodeId);
    if (!queryNode) {
        document.getElementById('resultPanel').innerHTML = '<p>❌ Error: Nodo no encontrado</p>';
        return;
    }
    
    const evidenceText = Object.keys(evidence).length > 0 
        ? Object.entries(evidence).map(([k,v]) => `${k}=${v}`).join(', ')
        : 'ninguna';
    
    document.getElementById('resultPanel').innerHTML = `
        <p><strong>Variable consulta:</strong> ${queryNode.name}</p>
        <p><strong>Evidencia:</strong> ${evidenceText}</p>
        <p><strong>Resultado:</strong></p>
        <p>🚧 Algoritmo de eliminación de variables en construcción...</p>
        <p>Próximamente: cálculos exactos con factorización</p>
    `;
}