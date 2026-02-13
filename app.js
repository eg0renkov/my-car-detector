const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/L00hgPrz-/';
const THRESHOLD = 0.80;

// You can configure which class represents your car
// Set to null to auto-detect (uses first class from model metadata)
const MY_CAR_CLASS = null;

let model, webcam, isRunning = false, animationId = null;
let carClassName = null;

const videoElement = document.getElementById('webcam');
const resultElement = document.getElementById('result');
const confidenceElement = document.getElementById('confidence-text');
const toggleBtn = document.getElementById('toggle-btn');
const errorElement = document.getElementById('error');

async function init() {
    try {
        errorElement.textContent = '';
        
        // Load the model
        model = await tmImage.load(MODEL_URL + 'model.json', MODEL_URL + 'metadata.json');
        
        // Get car class name from metadata
        if (MY_CAR_CLASS) {
            carClassName = MY_CAR_CLASS;
        } else {
            // Use first class as the car class
            carClassName = model.getClassLabels()[0];
        }
        
        console.log('Model loaded. Car class:', carClassName);
        
        // Initialize webcam
        const flip = true; // flip for front camera
        webcam = new tmImage.Webcam(400, 400, flip);
        await webcam.setup();
        
        // Pipe webcam to video element
        videoElement.srcObject = webcam.canvas.captureStream();
        
        console.log('Webcam initialized');
        
    } catch (error) {
        console.error('Initialization error:', error);
        errorElement.textContent = `Ошибка инициализации: ${error.message}`;
    }
}

async function predict() {
    try {
        // Update webcam frame
        await webcam.update();
        
        // Run prediction
        const predictions = await model.predict(webcam.canvas);
        
        // Find prediction for car class
        const carPrediction = predictions.find(p => p.className === carClassName);
        
        if (carPrediction) {
            const confidence = carPrediction.probability;
            const confidencePercent = Math.round(confidence * 100);
            
            // Update confidence display
            confidenceElement.textContent = `Уверенность: ${confidencePercent}%`;
            
            // Update result overlay
            if (confidence >= THRESHOLD) {
                resultElement.textContent = '✅ Это твоя тачка!';
                resultElement.className = 'result match';
            } else {
                resultElement.textContent = '❌ Не она';
                resultElement.className = 'result no-match';
            }
        }
        
        // Continue loop
        if (isRunning) {
            animationId = requestAnimationFrame(predict);
        }
        
    } catch (error) {
        console.error('Prediction error:', error);
        errorElement.textContent = `Ошибка распознавания: ${error.message}`;
        stop();
    }
}

function start() {
    if (!webcam || !model) {
        errorElement.textContent = 'Модель не загружена. Попробуйте обновить страницу.';
        return;
    }
    
    isRunning = true;
    toggleBtn.textContent = 'Остановить';
    toggleBtn.classList.add('active');
    webcam.play();
    predict();
}

function stop() {
    isRunning = false;
    toggleBtn.textContent = 'Запустить';
    toggleBtn.classList.remove('active');
    
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    if (webcam) {
        webcam.pause();
    }
    
    // Clear result overlay
    resultElement.className = 'result';
    resultElement.textContent = '';
    confidenceElement.textContent = '';
}

toggleBtn.addEventListener('click', () => {
    if (isRunning) {
        stop();
    } else {
        start();
    }
});

// Initialize on page load
init();
