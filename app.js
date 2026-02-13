// State
let mobilenetModel = null;
let classifier = null;
let videoElement = null;
let stream = null;
let classes = {};
let currentMode = 'training';
let recognitionRunning = false;
let recognitionAnimationId = null;
let useFrontCamera = false;

// Constants
const STORAGE_KEY = 'myCarDetectorModel';
const CONFIDENCE_THRESHOLD = 0.80;

// UI Elements
const trainingTab = document.getElementById('training-tab');
const recognitionTab = document.getElementById('recognition-tab');
const trainingMode = document.getElementById('training-mode');
const recognitionMode = document.getElementById('recognition-mode');
const addClassBtn = document.getElementById('add-class-btn');
const classesContainer = document.getElementById('classes-container');
const resultOverlay = document.getElementById('result-overlay');
const recognitionStatus = document.getElementById('recognition-status');
const saveModelBtn = document.getElementById('save-model-btn');
const loadModelBtn = document.getElementById('load-model-btn');
const clearModelBtn = document.getElementById('clear-model-btn');
const flipCameraBtn = document.getElementById('flip-camera-btn');
const errorElement = document.getElementById('error');

// Initialize on page load
async function init() {
    try {
        errorElement.textContent = 'Загрузка моделей...';
        
        // Load MobileNet
        mobilenetModel = await mobilenet.load();
        console.log('MobileNet loaded');
        
        // Create KNN Classifier
        classifier = knnClassifier.create();
        console.log('KNN Classifier created');
        
        // Initialize camera
        await initCamera();
        
        errorElement.textContent = '';
        
        // Try to load saved model
        loadModelFromStorage();
        
    } catch (error) {
        console.error('Initialization error:', error);
        errorElement.textContent = `Ошибка инициализации: ${error.message}`;
    }
}

// Camera initialization
async function initCamera() {
    try {
        videoElement = document.getElementById('webcam');
        
        const constraints = {
            video: {
                facingMode: useFrontCamera ? 'user' : 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve();
            };
        });
        
    } catch (error) {
        console.error('Camera error:', error);
        throw new Error('Не удалось получить доступ к камере. Проверьте разрешения.');
    }
}

// Flip camera
async function flipCamera() {
    useFrontCamera = !useFrontCamera;
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    await initCamera();
}

// Mode switching
function switchMode(mode) {
    currentMode = mode;
    
    if (mode === 'training') {
        trainingTab.classList.add('active');
        recognitionTab.classList.remove('active');
        trainingMode.classList.add('active');
        recognitionMode.classList.remove('active');
        
        stopRecognition();
    } else {
        trainingTab.classList.remove('active');
        recognitionTab.classList.add('active');
        trainingMode.classList.remove('active');
        recognitionMode.classList.add('active');
        
        startRecognition();
    }
}

// Class management
function addClassPrompt() {
    const className = prompt('Введите название класса:', '');
    
    if (className && className.trim()) {
        const name = className.trim();
        
        if (classes[name]) {
            alert('Класс с таким названием уже существует');
            return;
        }
        
        classes[name] = {
            name: name,
            examples: 0
        };
        
        renderClasses();
    }
}

function deleteClass(className) {
    if (confirm(`Удалить класс "${className}"?`)) {
        delete classes[className];
        
        // Remove from classifier
        if (classifier) {
            const classIndices = classifier.getClassifierDataset();
            if (classIndices[className]) {
                classifier.clearClass(className);
            }
        }
        
        renderClasses();
    }
}

// Render classes
function renderClasses() {
    classesContainer.innerHTML = '';
    
    Object.keys(classes).forEach(className => {
        const classData = classes[className];
        
        const card = document.createElement('div');
        card.className = 'class-card';
        
        card.innerHTML = `
            <div class="class-header">
                <div>
                    <div class="class-name">${classData.name}</div>
                    <div class="class-examples">📸 ${classData.examples} примеров</div>
                </div>
            </div>
            <div class="class-actions">
                <button class="capture-btn" data-class="${className}">Захватить</button>
                <button class="delete-btn" data-class="${className}">🗑️</button>
            </div>
        `;
        
        classesContainer.appendChild(card);
    });
    
    // Add event listeners
    document.querySelectorAll('.capture-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => startCapture(e.target.dataset.class));
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startCapture(e.target.dataset.class);
        });
        btn.addEventListener('mouseup', stopCapture);
        btn.addEventListener('touchend', stopCapture);
        btn.addEventListener('mouseleave', stopCapture);
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteClass(btn.dataset.class));
    });
}

// Capture logic
let captureInterval = null;

async function startCapture(className) {
    if (!mobilenetModel || !classifier) {
        errorElement.textContent = 'Модели не загружены';
        return;
    }
    
    const btn = document.querySelector(`.capture-btn[data-class="${className}"]`);
    if (btn) {
        btn.classList.add('capturing');
        btn.textContent = 'Захват...';
    }
    
    captureInterval = setInterval(async () => {
        try {
            const img = tf.browser.fromPixels(videoElement);
            const activation = mobilenetModel.infer(img, true);
            classifier.addExample(activation, className);
            img.dispose();
            
            classes[className].examples++;
            
            // Update UI
            const examplesEl = document.querySelector(`.capture-btn[data-class="${className}"]`)
                ?.parentElement?.parentElement?.querySelector('.class-examples');
            if (examplesEl) {
                examplesEl.textContent = `📸 ${classes[className].examples} примеров`;
            }
            
        } catch (error) {
            console.error('Capture error:', error);
            stopCapture();
        }
    }, 100); // Capture ~10 frames per second
}

function stopCapture() {
    if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
    }
    
    document.querySelectorAll('.capture-btn').forEach(btn => {
        btn.classList.remove('capturing');
        const className = btn.dataset.class;
        btn.textContent = 'Захватить';
    });
}

// Recognition
async function startRecognition() {
    const numClasses = classifier.getNumClasses();
    
    if (numClasses === 0) {
        resultOverlay.textContent = 'Сначала обучи модель!';
        resultOverlay.className = 'result-overlay no-model';
        recognitionStatus.textContent = 'Нет обученных классов';
        return;
    }
    
    recognitionRunning = true;
    recognitionStatus.textContent = 'Распознавание активно...';
    predict();
}

function stopRecognition() {
    recognitionRunning = false;
    
    if (recognitionAnimationId) {
        cancelAnimationFrame(recognitionAnimationId);
        recognitionAnimationId = null;
    }
    
    resultOverlay.className = 'result-overlay';
    resultOverlay.textContent = '';
}

async function predict() {
    if (!recognitionRunning || !mobilenetModel || !classifier) {
        return;
    }
    
    try {
        const numClasses = classifier.getNumClasses();
        
        if (numClasses > 0) {
            const img = tf.browser.fromPixels(videoElement);
            const activation = mobilenetModel.infer(img, true);
            const result = await classifier.predictClass(activation);
            
            img.dispose();
            activation.dispose();
            
            // Display result
            const predictedClass = result.label;
            const confidence = result.confidences[predictedClass];
            const confidencePercent = Math.round(confidence * 100);
            
            resultOverlay.textContent = `${predictedClass} (${confidencePercent}%)`;
            
            if (confidence >= CONFIDENCE_THRESHOLD) {
                resultOverlay.className = 'result-overlay high-confidence';
            } else {
                resultOverlay.className = 'result-overlay low-confidence';
            }
            
            recognitionStatus.textContent = `Последнее: ${predictedClass} (${confidencePercent}%)`;
        }
        
    } catch (error) {
        console.error('Prediction error:', error);
    }
    
    recognitionAnimationId = requestAnimationFrame(predict);
}

// Save/Load model
function saveModelToStorage() {
    try {
        const numClasses = classifier.getNumClasses();
        
        if (numClasses === 0) {
            alert('Нечего сохранять - модель не обучена');
            return;
        }
        
        const dataset = classifier.getClassifierDataset();
        const datasetObj = {};
        
        Object.keys(dataset).forEach((className) => {
            const data = dataset[className].dataSync();
            datasetObj[className] = Array.from(data);
        });
        
        const modelData = {
            classes: classes,
            dataset: datasetObj
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(modelData));
        alert('✅ Модель сохранена!');
        
    } catch (error) {
        console.error('Save error:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}

function loadModelFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        
        if (!saved) {
            console.log('No saved model found');
            return;
        }
        
        const modelData = JSON.parse(saved);
        classes = modelData.classes || {};
        
        // Restore classifier dataset
        Object.keys(modelData.dataset).forEach((className) => {
            const data = modelData.dataset[className];
            const tensor = tf.tensor(data, [data.length / 1024, 1024]);
            classifier.addExample(tensor, className);
            tensor.dispose();
        });
        
        renderClasses();
        console.log('Model loaded from storage');
        errorElement.textContent = '✅ Модель загружена из памяти';
        setTimeout(() => { errorElement.textContent = ''; }, 3000);
        
    } catch (error) {
        console.error('Load error:', error);
        errorElement.textContent = 'Ошибка загрузки модели: ' + error.message;
    }
}

function clearModel() {
    if (confirm('Удалить все классы и сохранённую модель?')) {
        // Clear classifier
        if (classifier) {
            classifier.clearAllClasses();
        }
        
        // Clear classes
        classes = {};
        renderClasses();
        
        // Clear storage
        localStorage.removeItem(STORAGE_KEY);
        
        alert('✅ Всё очищено');
    }
}

// Event listeners
trainingTab.addEventListener('click', () => switchMode('training'));
recognitionTab.addEventListener('click', () => switchMode('recognition'));
addClassBtn.addEventListener('click', addClassPrompt);
saveModelBtn.addEventListener('click', saveModelToStorage);
loadModelBtn.addEventListener('click', loadModelFromStorage);
clearModelBtn.addEventListener('click', clearModel);
flipCameraBtn.addEventListener('click', flipCamera);

// Initialize
init();
