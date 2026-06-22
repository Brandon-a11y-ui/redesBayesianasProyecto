// =========================================================================
// main.js : Coordinador de Eventos e Interfaz de Usuario (Entrega Final)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("Inicializando componentes de la interfaz...");
    
    initGraph();
    
    const modelTypeSelect = document.getElementById('globalModelType');
    const algorithmSelect = document.getElementById('selectAlgorithm');
    const panelBayes = document.getElementById('panelBayesControls');
    const panelHMM = document.getElementById('panelHMMControls');
    const bayesQuery = document.getElementById('bayesQuerySection');
    const bayesSteps = document.getElementById('bayesStepsSection');
    const bayesFileActions = document.getElementById('bayesFileActions');
    const btnExportResults = document.getElementById('btnExportResults');

    function syncInterfaceControls() {
        const selectedModel = modelTypeSelect.value;
        algorithmSelect.innerHTML = ''; 

        if (selectedModel === 'bayes') {
            panelBayes.style.display = 'block';
            bayesQuery.style.display = 'block';
            bayesSteps.style.display = 'block';
            if (bayesFileActions) bayesFileActions.style.display = 'block';
            panelHMM.style.display = 'none';

            const optDCC = document.createElement('option');
            optDCC.value = 'dcc';
            optDCC.textContent = 'Eliminación de Variables / DCC';
            algorithmSelect.appendChild(optDCC);
            
            updateSelectors();
        } else if (selectedModel === 'hmm') {
            panelBayes.style.display = 'none';
            bayesQuery.style.display = 'none';
            bayesSteps.style.display = 'none';
            if (bayesFileActions) bayesFileActions.style.display = 'none';
            panelHMM.style.display = 'block';

            const hmmanAlgos = [
                { val: 'viterbi', text: 'Algoritmo de Viterbi (Secuencia Óptima)' },
                { val: 'forward', text: 'Algoritmo Forward (Filtrado)' },
                { val: 'backward', text: 'Algoritmo Backward (Suavizado)' }
            ];
            hmmanAlgos.forEach(algo => {
                const opt = document.createElement('option');
                opt.value = algo.val;
                opt.textContent = algo.text;
                algorithmSelect.appendChild(opt);
            });
        }
    }

    modelTypeSelect.addEventListener('change', syncInterfaceControls);
    syncInterfaceControls();

    // Ingesta automática por texto plano nativa
    document.getElementById('btnProcessText').addEventListener('click', () => {
        const rawText = document.getElementById('txtIngestion').value;
        if (!rawText.trim()) {
            alert("Por favor, introduce configuraciones en el cuadro de texto plano.");
            return;
        }

        const selectedModel = modelTypeSelect.value;
        const lines = rawText.split('\n');

        if (selectedModel === 'bayes') {
            clearGraph();
            lines.forEach(line => {
                const cleanLine = line.trim();
                if (!cleanLine) return;

                if (cleanLine.toLowerCase().startsWith('nodos:')) {
                    const content = cleanLine.substring(6);
                    const tokens = content.split(',');
                    tokens.forEach(token => {
                        const name = token.trim();
                        if (name && !nodes.some(n => n.name === name)) {
                            addNodeToGraph(name);
                        }
                    });
                }

                if (cleanLine.toLowerCase().startsWith('conexiones:')) {
                    const content = cleanLine.substring(11);
                    const tokens = content.split(',');
                    tokens.forEach(token => {
                        const edgeStr = token.trim();
                        const nodesParts = edgeStr.split('->');
                        if (nodesParts.length === 2) {
                            const parentNode = nodes.find(n => n.name === nodesParts[0].trim());
                            const childNode = nodes.find(n => n.name === nodesParts[1].trim());
                            if (parentNode && childNode) {
                                addEdgeToGraph(parentNode.id, childNode.id);
                            }
                        }
                    });
                }
            });
            alert("⚡ Red Bayesiana generada automáticamente en el lienzo.");
            updateSelectors();

        } else if (selectedModel === 'hmm') {
            let states = [];
            let observations = [];

            lines.forEach(line => {
                const cleanLine = line.trim();
                if (!cleanLine) return;

                if (cleanLine.toLowerCase().startsWith('estados:')) {
                    states = cleanLine.substring(8).split(',');
                }
                if (cleanLine.toLowerCase().startsWith('observaciones:')) {
                    observations = cleanLine.substring(14).split(',');
                }
            });

            if (states.length > 0 && observations.length > 0) {
                renderHMMTopology(states, observations);
                alert("⚡ Grafo HMM generado automáticamente en una estructura bicapa.");
            } else {
                alert("Para modelar un HMM, el texto plano debe contener las líneas 'estados:' y 'observaciones:'.");
            }
        }
    });

    // Gestión de descargas y ejecuciones
    function triggerDownload(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    document.getElementById('btnSavePNG').addEventListener('click', () => {
        if (!cy) return;
        const pngData = cy.png({ bg: '#ffffff', full: true });
        triggerDownload(pngData, 'modelo_grafo.png');
    });

    document.getElementById('btnSaveJPG').addEventListener('click', () => {
        if (!cy) return;
        const jpgData = cy.jpg({ bg: '#ffffff', full: true });
        triggerDownload(jpgData, 'modelo_grafo.jpg');
    });

    if (btnExportResults) {
        btnExportResults.addEventListener('click', () => {
            const resultsContent = document.getElementById('resultPanel').innerText;
            const textBlob = new Blob([resultsContent], { type: 'text/plain;charset=utf-8' });
            const blobUrl = URL.createObjectURL(textBlob);
            triggerDownload(blobUrl, 'solucion_reporte.txt');
        });
    }

    document.getElementById('btnExecute').addEventListener('click', () => {
        const activeModel = modelTypeSelect.value;
        if (activeModel === 'bayes') {
            runInference(); 
        } else {
            if (typeof runHMMInference === 'function') {
                runHMMInference(); 
            } else {
                document.getElementById('resultPanel').innerHTML = "<p style='color:orange;'>Falta implementar la lógica matemática de HMM en inference.js</p>";
            }
        }
        if (btnExportResults) btnExportResults.style.display = 'block';
    });

    document.getElementById('btnAddNode').addEventListener('click', () => {
        const nameInput = document.getElementById('nodeName');
        const name = nameInput.value.trim();
        if (!name) return;
        if (nodes.some(n => n.name === name)) { alert("Ese nodo ya existe."); return; }
        addNodeToGraph(name);
        nameInput.value = '';
    });

    document.getElementById('btnAddEdge').addEventListener('click', () => {
        const pId = document.getElementById('selectParent').value;
        const cId = document.getElementById('selectChild').value;
        if (!pId || !cId || pId === cId) return;
        addEdgeToGraph(pId, cId);
    });

    document.getElementById('btnClear').addEventListener('click', () => {
        if (confirm("¿Deseas limpiar el espacio de trabajo actual?")) {
            clearGraph();
            document.getElementById('resultPanel').innerHTML = '<p>Esperando consulta o secuencia...</p>';
            document.getElementById('txtIngestion').value = '';
            const hmmObsInput = document.getElementById('hmmObservations');
            if (hmmObsInput) hmmObsInput.value = '';
            if (btnExportResults) btnExportResults.style.display = 'none';
        }
    });

    const showStepsBtn = document.getElementById('btnShowSteps');
    if (showStepsBtn) showStepsBtn.addEventListener('click', showInferenceSteps);

    const fileLoader = document.getElementById('fileLoadNetwork');
    const saveNetworkBtn = document.getElementById('btnSaveNetwork');
    if (saveNetworkBtn) saveNetworkBtn.addEventListener('click', () => saveNetworkToFile());
    
    document.getElementById('btnLoadNetwork').addEventListener('click', () => fileLoader.click());
    fileLoader.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadNetworkFromFile(e.target.files[0]);
            e.target.value = '';
        }
    });

    document.querySelectorAll('.close-modal, #btnCancelModal').forEach(el => {
        el.addEventListener('click', closeCPTModal);
    });
    const saveCPTBtn = document.getElementById('btnSaveCPT');
    if (saveCPTBtn) saveCPTBtn.addEventListener('click', saveCurrentCPT);

    const hmmModal = document.getElementById('hmmModal');
    const openHMMBtn = document.getElementById('btnOpenHMMMatrices');
    if (openHMMBtn) {
        openHMMBtn.addEventListener('click', () => {
            if (nodes.length === 0) {
                alert("Primero debes declarar los estados usando el cuadro de texto plano.");
                return;
            }
            if (typeof buildHMMModalTables === 'function') {
                buildHMMModalTables();
                hmmModal.style.display = 'block';
            }
        });
    }

    document.querySelectorAll('#closeHMMModal, #btnCancelHMMModal').forEach(el => {
        el.addEventListener('click', () => hmmModal.style.display = 'none');
    });
    
    document.getElementById('btnSaveHMM').addEventListener('click', () => {
        if (typeof saveHMMParameters === 'function') {
            saveHMMParameters();
            hmmModal.style.display = 'none';
        }
    });
});