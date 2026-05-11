// main.js : Punto de entrada y controladores de la interfaz
// Inicializacion cuando la pagina termina de cargar
document.addEventListener('DOMContentLoaded', () => {
    console.log("Pagina cargada, inicializando...");
    
    initGraph();
    updateSelectors();
    
    // Boton para agregar un nuevo nodo
    document.getElementById('btnAddNode').addEventListener('click', () => {
        const nameInput = document.getElementById('nodeName');
        const name = nameInput.value.trim();
        
        if (name === '') {
            alert('Escribe un nombre para el nodo');
            return;
        }
        
        // Verificar que no exista un nodo con el mismo nombre
        if (nodes.some(n => n.name === name)) {
            alert(`Ya existe un nodo llamado "${name}"`);
            return;
        }
        
        addNodeToGraph(name);
        nameInput.value = '';
    });
    
    // Boton para conectar dos nodos
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
    
    // Boton para ejecutar la inferencia
    document.getElementById('btnInfer').addEventListener('click', () => {
        runInference();
    });
    
    // Boton para limpiar toda la red
    document.getElementById('btnClear').addEventListener('click', () => {
        if (confirm('Limpiar toda la red? No se puede deshacer.')) {
            clearGraph();
        }
    });
    
    // Boton para guardar la red en archivo JSON
    document.getElementById('btnSaveNetwork').addEventListener('click', () => {
        saveNetworkToFile();
    });
    
    // Boton para cargar una red desde archivo JSON
    const fileInput = document.getElementById('fileLoadNetwork');
    document.getElementById('btnLoadNetwork').addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            loadNetworkFromFile(event.target.files[0]);
            fileInput.value = ''; // Reset para poder cargar el mismo archivo otra vez
        }
    });
    
    // Boton para mostrar los pasos intermedios de inferencia (RF10)
    document.getElementById('btnShowSteps').addEventListener('click', () => {
        showInferenceSteps();
    });
    
    // Eventos para la ventana modal de definicion de CPTs
    const modal = document.getElementById('cptModal');
    const closeButtons = document.querySelectorAll('.close-modal, #btnCancelModal');
    
    closeButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', closeCPTModal);
        }
    });
    
    // Cerrar modal al hacer clic fuera del contenido
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeCPTModal();
        }
    });
    
    // Boton para guardar la CPT del nodo actual
    const saveBtn = document.getElementById('btnSaveCPT');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentCPT);
    }
    
    console.log("Sistema listo");
});