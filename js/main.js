// main.js - Punto de entrada y controladores
document.addEventListener('DOMContentLoaded', () => {
    console.log("Página cargada, inicializando...");
    
    initGraph();
    updateSelectors();
    
    // Botón agregar nodo
    document.getElementById('btnAddNode').addEventListener('click', () => {
        const nameInput = document.getElementById('nodeName');
        const name = nameInput.value.trim();
        
        if (name === '') {
            alert('Escribe un nombre para el nodo');
            return;
        }
        
        if (nodes.some(n => n.name === name)) {
            alert(`Ya existe un nodo llamado "${name}"`);
            return;
        }
        
        addNodeToGraph(name);
        nameInput.value = '';
    });
    
    // Botón conectar nodos
    document.getElementById('btnAddEdge').addEventListener('click', () => {
        const parentId = document.getElementById('selectParent').value;
        const childId = document.getElementById('selectChild').value;
        
        if (!parentId || !childId) {
            alert('Selecciona un nodo padre y un nodo hijo');
            return;
        }
        
        if (parentId === childId) {
            alert('No puedes conectar un nodo consigo mismo');
            return;
        }
        
        addEdgeToGraph(parentId, childId);
    });
    
    // Botón inferir
    document.getElementById('btnInfer').addEventListener('click', () => {
        runInference();
    });
    
    // Botón limpiar
    document.getElementById('btnClear').addEventListener('click', () => {
        if (confirm('¿Limpiar toda la red? No se puede deshacer.')) {
            clearGraph();
        }
    });
    
    // ===== Eventos de la ventana modal =====
    const modal = document.getElementById('cptModal');
    const closeButtons = document.querySelectorAll('.close-modal, #btnCancelModal');
    
    closeButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', closeCPTModal);
        }
    });
    
    // Cerrar modal haciendo clic fuera del contenido
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeCPTModal();
        }
    });
    
    // Guardar CPT
    const saveBtn = document.getElementById('btnSaveCPT');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentCPT);
    }
    
    console.log("✅ Sistema listo");
});