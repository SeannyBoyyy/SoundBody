// Workout Mode - Voice-Controlled Fitness Trainer
// Implements Speech Recognition and Speech Synthesis

// Workout State
let workoutExercises = [];
let currentExerciseIndex = 0;
let isWorkoutActive = false;
let isPaused = false;
let workoutTimer = null;
let exerciseTimer = null;
let timeRemaining = 30; // Default 30 seconds per exercise
let totalWorkoutTime = 0;
let completedExercisesCount = 0;

// Speech Recognition
let recognition = null;
let isListening = false;
let speechEnabled = true;

// Speech Synthesis
let synthesis = window.speechSynthesis;
let currentUtterance = null;

// DOM Elements
const workoutModeScreen = document.getElementById('workoutMode');
const exerciseNameEl = document.getElementById('currentExerciseName');
const exerciseNumberEl = document.getElementById('exerciseNumber');
const exerciseImageEl = document.getElementById('exerciseImage');
const exerciseImage2El = document.getElementById('exerciseImage2');
const timerValueEl = document.getElementById('timerValue');
const progressBarEl = document.getElementById('progressBar');
const progressTextEl = document.getElementById('progressText');
const instructionsListEl = document.getElementById('instructionsList');
const voiceStatusEl = document.getElementById('voiceStatus');
const listeningIndicatorEl = document.getElementById('listeningIndicator');

// Buttons
const startWorkoutBtn = document.getElementById('startWorkoutBtn');
const pauseWorkoutBtn = document.getElementById('pauseWorkoutBtn');
const nextExerciseBtn = document.getElementById('nextExerciseBtn');
const repeatInstructionsBtn = document.getElementById('repeatInstructionsBtn');
const exitWorkoutBtn = document.getElementById('exitWorkout');
const workoutLink = document.getElementById('workoutLink');
const addToWorkoutBtn = document.getElementById('addToWorkoutBtn');
const voiceHelpToggle = document.getElementById('voiceHelpToggle');
const toggleSpeechBtn = document.getElementById('toggleSpeechBtn');
const startMicBtn = document.getElementById('startMicBtn');
const clearQueueBtn = document.getElementById('clearQueueBtn');

// Stats
const totalTimeEl = document.getElementById('totalTime');
const completedExercisesEl = document.getElementById('completedExercises');
const caloriesEstimateEl = document.getElementById('caloriesEstimate');

// Queue elements
const queueCountEl = document.getElementById('queueCount');
const workoutQueueList = document.getElementById('workoutQueueList');

// Helper function to show workout modals properly
function showWorkoutModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (!modalElement) {
        console.error(`Modal ${modalId} not found`);
        return null;
    }
    
    const modal = new bootstrap.Modal(modalElement);
    
    // Listen for modal show event
    modalElement.addEventListener('shown.bs.modal', function() {
        // Move modal and backdrop inside workout screen
        const modalBackdrop = document.querySelector('.modal-backdrop');
        const modalDialog = document.querySelector(`#${modalId}`);
        
        if (modalBackdrop && workoutModeScreen.style.display === 'block') {
            workoutModeScreen.appendChild(modalBackdrop);
        }
    }, { once: true });
    
    return modal;
}

// Show Microphone Permission Modal
function showMicrophonePermissionModal() {
    return new Promise((resolve) => {
        const modal = showWorkoutModal('micPermissionModal');
        if (!modal) {
            resolve(false);
            return;
        }
        
        const allowBtn = document.getElementById('allowMicBtn');
        const declineBtn = document.getElementById('declineMicBtn');
        
        const handleAllow = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Stop the tracks immediately, we just needed permission
                stream.getTracks().forEach(track => track.stop());
                modal.hide();
                resolve(true);
            } catch (error) {
                console.error('Microphone permission denied:', error);
                updateVoiceStatus('Microphone access denied', 'error');
                showErrorToast('Microphone access denied. You can still use button controls.');
                modal.hide();
                resolve(false);
            }
        };
        
        const handleDecline = () => {
            modal.hide();
            updateVoiceStatus('Voice commands disabled', 'error');
            showSuccessToast('Voice commands disabled. Using button controls.');
            resolve(false);
        };
        
        allowBtn.addEventListener('click', handleAllow, { once: true });
        declineBtn.addEventListener('click', handleDecline, { once: true });
        
        modal.show();
    });
}

// Request Microphone Permission
async function requestMicrophonePermission() {
    // Check if permission was already granted
    if (navigator.permissions) {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
            if (permissionStatus.state === 'granted') {
                return true;
            } else if (permissionStatus.state === 'denied') {
                updateVoiceStatus('Microphone access denied', 'error');
                showErrorToast('Microphone access is blocked. Please enable it in your browser settings.');
                return false;
            }
        } catch (error) {
            console.log('Permissions API not fully supported:', error);
        }
    }
    
    // Show modal to request permission
    return await showMicrophonePermissionModal();
}

// Initialize Speech Recognition
async function initSpeechRecognition() {
    // Request microphone permission first
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
        return false;
    }
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
            isListening = true;
            updateVoiceStatus('Listening...', 'listening');
            listeningIndicatorEl.style.display = 'flex';
        };
        
        recognition.onend = () => {
            isListening = false;
            listeningIndicatorEl.style.display = 'none';
            if (isWorkoutActive && !isPaused) {
                // Restart recognition if workout is active
                setTimeout(() => {
                    if (isWorkoutActive && !isPaused) {
                        try {
                            recognition.start();
                        } catch (e) {
                            console.log('Recognition already started');
                        }
                    }
                }, 100);
            } else {
                updateVoiceStatus('Voice Ready', 'ready');
            }
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                updateVoiceStatus('No speech detected', 'error');
            } else if (event.error === 'not-allowed') {
                updateVoiceStatus('Microphone access denied', 'error');
                showErrorToast('Please allow microphone access for voice commands');
            } else {
                updateVoiceStatus('Voice error', 'error');
            }
        };
        
        recognition.onresult = (event) => {
            const last = event.results.length - 1;
            const command = event.results[last][0].transcript.toLowerCase().trim();
            
            console.log('Voice command:', command);
            handleVoiceCommand(command);
        };
        
        return true;
    } else {
        console.warn('Speech recognition not supported');
        updateVoiceStatus('Voice not supported', 'error');
        return false;
    }
}

// Handle Voice Commands
function handleVoiceCommand(command) {
    // Visual feedback
    showCommandFeedback(command);
    
    // Command matching
    if (command.includes('start workout') || command.includes('begin') || command.includes('go')) {
        startWorkout();
        speak('Starting workout. Let\'s get moving!');
    }
    else if (command.includes('pause') || command.includes('stop') || command.includes('wait')) {
        pauseWorkout();
        speak('Workout paused');
    }
    else if (command.includes('next') || command.includes('skip')) {
        nextExercise();
        speak('Moving to next exercise');
    }
    else if (command.includes('repeat') || command.includes('again') || command.includes('instructions')) {
        repeatInstructions();
    }
    else if (command.includes('time') || command.includes('remaining') || command.includes('left')) {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        speak(`${minutes > 0 ? minutes + ' minutes and ' : ''}${seconds} seconds remaining`);
    }
    else if (command.includes('help') || command.includes('commands')) {
        showVoiceHelp();
        speak('Available commands: Start workout, Pause, Next exercise, Repeat instructions, Time remaining, Help');
    }
    else if (command.includes('resume') || command.includes('continue')) {
        resumeWorkout();
        speak('Resuming workout');
    }
    else {
        speak('Command not recognized. Say help for available commands.');
    }
}

// Speech Synthesis
function speak(text, options = {}) {
    // Check if speech is enabled
    if (!speechEnabled) {
        console.log('Speech disabled:', text);
        return;
    }
    
    // Cancel any ongoing speech
    if (synthesis.speaking) {
        synthesis.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;
    utterance.lang = 'en-US';
    
    // Add motivation and energy to voice
    if (options.motivation) {
        utterance.rate = 1.1;
        utterance.pitch = 1.1;
    }
    
    currentUtterance = utterance;
    synthesis.speak(utterance);
}

// Toggle Speech Features
function toggleSpeech() {
    speechEnabled = !speechEnabled;
    
    const speechBtnText = document.getElementById('speechBtnText');
    const icon = toggleSpeechBtn.querySelector('i');
    
    if (speechEnabled) {
        speechBtnText.textContent = 'Speech On';
        icon.className = 'bi bi-volume-up-fill';
        toggleSpeechBtn.classList.remove('btn-danger');
        toggleSpeechBtn.classList.add('btn-success');
        
        // Update voice status indicator
        voiceStatus.classList.remove('voice-status-off');
        voiceStatus.classList.add('voice-status-ready');
        voiceStatus.innerHTML = '<i class="bi bi-mic-fill"></i><span>Voice Ready</span>';
        
        showSuccessToast('Speech features enabled');
        speak('Speech features enabled');
        
        // Don't show mic button - voice control is automatic during workout
        // User doesn't need manual mic control
        startMicBtn.style.display = 'none';
    } else {
        speechBtnText.textContent = 'Speech Off';
        icon.className = 'bi bi-volume-mute-fill';
        toggleSpeechBtn.classList.remove('btn-success');
        toggleSpeechBtn.classList.add('btn-danger');
        
        // Update voice status indicator
        voiceStatus.classList.remove('voice-status-ready', 'voice-status-listening');
        voiceStatus.classList.add('voice-status-off');
        voiceStatus.innerHTML = '<i class="bi bi-mic-mute-fill"></i><span>Voice Off</span>';
        
        // Stop any ongoing speech
        if (synthesis.speaking) {
            synthesis.cancel();
        }
        
        // Stop recognition
        if (recognition && isListening) {
            recognition.stop();
        }
        
        startMicBtn.style.display = 'none';
        updateVoiceStatus('Speech disabled', 'error');
        showSuccessToast('Speech features disabled');
    }
}

// Manually Start Speech Recognition
function startSpeechRecognition() {
    if (!speechEnabled) {
        showErrorToast('Please enable speech features first');
        return;
    }
    
    if (!recognition) {
        showErrorToast('Speech recognition not available');
        return;
    }
    
    if (isListening) {
        // Stop recognition
        recognition.stop();
        startMicBtn.innerHTML = '<i class="bi bi-mic"></i> Start Mic';
        startMicBtn.classList.remove('btn-danger');
        startMicBtn.classList.add('btn-primary');
    } else {
        // Start recognition
        try {
            recognition.start();
            startMicBtn.innerHTML = '<i class="bi bi-mic-fill"></i> Stop Mic';
            startMicBtn.classList.remove('btn-primary');
            startMicBtn.classList.add('btn-danger');
            speak('Voice recognition activated');
        } catch (e) {
            console.error('Failed to start recognition:', e);
            showErrorToast('Failed to start voice recognition');
        }
    }
}

// Update Voice Status
function updateVoiceStatus(text, status) {
    voiceStatusEl.querySelector('span').textContent = text;
    voiceStatusEl.className = 'voice-status voice-status-' + status;
}

// Show Command Feedback
function showCommandFeedback(command) {
    const feedback = document.createElement('div');
    feedback.className = 'command-feedback';
    feedback.innerHTML = `<i class="bi bi-mic-fill"></i> "${command}"`;
    document.querySelector('.workout-container').appendChild(feedback);
    
    setTimeout(() => {
        feedback.classList.add('fade-out');
        setTimeout(() => feedback.remove(), 500);
    }, 2000);
}

// Start Workout Mode
async function enterWorkoutMode() {
    workoutModeScreen.style.display = 'block';
    workoutModeScreen.setAttribute('aria-hidden', 'false');
    
    // Store scroll position and prevent body scroll
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    
    // Initialize speech recognition with permission request
    const initialized = await initSpeechRecognition();
    if (initialized) {
        updateVoiceStatus('Voice Ready', 'ready');
        // Speak welcome message only if speech is available
        speak('Welcome to your workout session. Add exercises and say start workout when ready.', { motivation: true });
    } else {
        updateVoiceStatus('Voice not available', 'error');
        showErrorToast('Voice commands are not available. You can still use button controls.');
    }
    
    // Load workout exercises
    loadWorkoutExercises();
}

// Exit Workout Mode
function exitWorkoutMode() {
    // Stop workout if active
    if (isWorkoutActive) {
        stopWorkout();
    }
    
    // Stop speech recognition
    if (recognition && isListening) {
        recognition.stop();
    }
    
    // Stop any speaking
    if (synthesis.speaking) {
        synthesis.cancel();
    }
    
    workoutModeScreen.style.display = 'none';
    workoutModeScreen.setAttribute('aria-hidden', 'true');
    
    // Restore body scroll
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    
    // Restore scroll position
    if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    
    // Reset state
    resetWorkoutState();
}

// Load Workout Exercises
function loadWorkoutExercises() {
    const stored = localStorage.getItem('workoutQueue');
    if (stored) {
        workoutExercises = JSON.parse(stored);
        displayWorkoutQueue();
        updateQueueCount();
        
        // Display the first exercise images even if workout hasn't started
        if (workoutExercises.length > 0) {
            displayCurrentExercise();
        }
    } else {
        // Show empty state
        displayEmptyQueue();
    }
}

// Display Workout Queue
function displayWorkoutQueue() {
    if (workoutExercises.length === 0) {
        displayEmptyQueue();
        return;
    }
    
    workoutQueueList.innerHTML = workoutExercises.map((exercise, index) => {
        const imagePath = exercise.images && exercise.images.length > 0 
            ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${exercise.images[0]}`
            : '';
        
        return `
        <div class="queue-item" data-index="${index}">
            <div class="queue-item-number">${index + 1}</div>
            ${imagePath ? `
            <div class="queue-item-image">
                <img src="${imagePath}" alt="${exercise.name}" class="img-fluid rounded">
            </div>
            ` : ''}
            <div class="queue-item-content">
                <h4>${exercise.name}</h4>
                <p class="queue-item-category">
                    <i class="bi bi-tag"></i> ${exercise.category || 'Exercise'}
                    ${exercise.primaryMuscles ? ` • <i class="bi bi-bullseye"></i> ${exercise.primaryMuscles.join(', ')}` : ''}
                </p>
            </div>
            <button class="btn btn-sm btn-outline-danger remove-from-queue" data-index="${index}" title="Remove from queue">
                <i class="bi bi-trash"></i>
            </button>
        </div>
        `;
    }).join('');
    
    // Add remove listeners
    document.querySelectorAll('.remove-from-queue').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            removeFromQueue(index);
        });
    });
    
    updateQueueCount();
}

// Display Empty Queue
function displayEmptyQueue() {
    workoutQueueList.innerHTML = `
        <div class="empty-queue-message">
            <i class="bi bi-inbox"></i>
            <p>No exercises added yet</p>
            <small>Browse exercises and click "Add to Workout"</small>
        </div>
    `;
    updateQueueCount();
}

// Update Queue Count Badge
function updateQueueCount() {
    queueCountEl.textContent = workoutExercises.length;
    
    if (workoutExercises.length === 0) {
        queueCountEl.classList.remove('bg-warning', 'text-dark');
        queueCountEl.classList.add('bg-secondary', 'text-white');
    } else {
        queueCountEl.classList.remove('bg-secondary', 'text-white');
        queueCountEl.classList.add('bg-warning', 'text-dark');
    }
}

// Remove Exercise from Queue
function removeFromQueue(index) {
    const exercise = workoutExercises[index];
    workoutExercises.splice(index, 1);
    localStorage.setItem('workoutQueue', JSON.stringify(workoutExercises));
    
    displayWorkoutQueue();
    showSuccessToast(`${exercise.name} removed from workout`);
    speak(`Removed ${exercise.name} from workout`);
    
    // Reset current index if needed
    if (currentExerciseIndex >= workoutExercises.length) {
        currentExerciseIndex = Math.max(0, workoutExercises.length - 1);
    }
}

// Clear Workout Queue
function clearWorkoutQueue() {
    if (workoutExercises.length === 0) {
        showErrorToast('Workout queue is already empty');
        return;
    }
    
    if (confirm('Are you sure you want to clear all exercises from your workout?')) {
        workoutExercises = [];
        localStorage.setItem('workoutQueue', JSON.stringify(workoutExercises));
        displayEmptyQueue();
        showSuccessToast('Workout queue cleared');
        speak('All exercises removed from workout');
    }
}

// Display Current Exercise Being Performed
function displayCurrentExercise() {
    if (workoutExercises.length === 0) {
        loadWorkoutExercises();
        return;
    }
    
    exerciseNumberEl.textContent = `Exercise ${currentExerciseIndex + 1} of ${workoutExercises.length}`;
    
    const currentExercise = workoutExercises[currentExerciseIndex];
    exerciseNameEl.textContent = currentExercise.name;
    
    // Show images (Step 1 and Step 2)
    if (currentExercise.images && currentExercise.images.length > 0) {
        const imageBasePath = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
        
        // Show first image (Step 1)
        exerciseImageEl.src = imageBasePath + currentExercise.images[0];
        exerciseImageEl.style.display = 'block';
        
        // Show second image (Step 2) if available
        if (currentExercise.images.length > 1) {
            exerciseImage2El.src = imageBasePath + currentExercise.images[1];
            exerciseImage2El.style.display = 'block';
        } else {
            // If only one image, show it in both steps
            exerciseImage2El.src = imageBasePath + currentExercise.images[0];
            exerciseImage2El.style.display = 'block';
        }
        
        // Hide all placeholders
        const placeholders = document.querySelectorAll('.exercise-placeholder');
        placeholders.forEach(placeholder => {
            placeholder.style.display = 'none';
        });
    } else {
        // No images available
        exerciseImageEl.style.display = 'none';
        exerciseImage2El.style.display = 'none';
        const placeholders = document.querySelectorAll('.exercise-placeholder');
        placeholders.forEach(placeholder => {
            placeholder.style.display = 'flex';
        });
    }
    
    // Show instructions
    if (currentExercise.instructions && currentExercise.instructions.length > 0) {
        instructionsListEl.innerHTML = currentExercise.instructions
            .map(inst => `<li>${inst}</li>`)
            .join('');
    }
    
    updateProgress();
}

// Start Workout
function startWorkout() {
    if (workoutExercises.length === 0) {
        speak('Please add exercises to your workout first');
        showErrorToast('Add exercises to start workout');
        return;
    }
    
    isWorkoutActive = true;
    isPaused = false;
    currentExerciseIndex = 0;
    totalWorkoutTime = 0;
    completedExercisesCount = 0;
    
    // Clear any existing timers before starting
    if (workoutTimer) {
        clearInterval(workoutTimer);
        workoutTimer = null;
    }
    if (exerciseTimer) {
        clearInterval(exerciseTimer);
        exerciseTimer = null;
    }
    
    // Start speech recognition
    if (recognition && !isListening) {
        try {
            recognition.start();
        } catch (e) {
            console.log('Recognition already started');
        }
    }
    
    // Update UI
    startWorkoutBtn.style.display = 'none';
    pauseWorkoutBtn.style.display = 'inline-block';
    nextExerciseBtn.style.display = 'inline-block';
    
    // Start first exercise
    startExercise();
    
    // Start total time tracker
    workoutTimer = setInterval(() => {
        totalWorkoutTime++;
        updateStats();
    }, 1000);
}

// Start Exercise
function startExercise() {
    const exercise = workoutExercises[currentExerciseIndex];
    timeRemaining = 30; // 30 seconds per exercise
    
    // Clear any existing timer before starting a new one
    if (exerciseTimer) {
        clearInterval(exerciseTimer);
        exerciseTimer = null;
    }
    
    displayCurrentExercise();
    
    // Speak exercise name and first instruction
    speak(`Exercise ${currentExerciseIndex + 1}: ${exercise.name}. ${exercise.instructions ? exercise.instructions[0] : 'Begin exercise'}`, { motivation: true });
    
    // Start exercise timer
    exerciseTimer = setInterval(() => {
        if (!isPaused) {
            timeRemaining--;
            updateTimerDisplay();
            
            if (timeRemaining === 10) {
                speak('10 seconds remaining. Keep going!');
            } else if (timeRemaining === 0) {
                completeExercise();
            }
        }
    }, 1000);
}

// Complete Exercise
function completeExercise() {
    if (exerciseTimer) {
        clearInterval(exerciseTimer);
        exerciseTimer = null;
    }
    completedExercisesCount++;
    
    speak('Exercise complete! Great work!', { motivation: true });
    
    // Move to next exercise
    setTimeout(() => {
        if (currentExerciseIndex < workoutExercises.length - 1) {
            currentExerciseIndex++;
            startExercise();
        } else {
            completeWorkout();
        }
    }, 2000);
}

// Pause Workout
function pauseWorkout() {
    if (!isWorkoutActive) return;
    
    isPaused = true;
    pauseWorkoutBtn.innerHTML = '<i class="bi bi-play-fill"></i> Resume';
    speak('Workout paused. Say resume when ready.');
    
    showSuccessToast('Workout paused');
}

// Resume Workout
function resumeWorkout() {
    if (!isWorkoutActive || !isPaused) return;
    
    isPaused = false;
    pauseWorkoutBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
    speak('Resuming workout. Let\'s continue!', { motivation: true });
    
    showSuccessToast('Workout resumed');
}

// Next Exercise
function nextExercise() {
    if (!isWorkoutActive) return;
    
    clearInterval(exerciseTimer);
    completedExercisesCount++;
    
    if (currentExerciseIndex < workoutExercises.length - 1) {
        currentExerciseIndex++;
        startExercise();
    } else {
        completeWorkout();
    }
}

// Repeat Instructions
function repeatInstructions() {
    const exercise = workoutExercises[currentExerciseIndex];
    if (exercise && exercise.instructions && exercise.instructions.length > 0) {
        speak(exercise.instructions.join('. '));
    } else {
        speak('No instructions available for this exercise');
    }
}

// Complete Workout
function completeWorkout() {
    isWorkoutActive = false;
    clearInterval(exerciseTimer);
    clearInterval(workoutTimer);
    
    // Stop speech recognition
    if (recognition && isListening) {
        recognition.stop();
    }
    
    speak('Workout complete! Excellent job! You crushed it!', { motivation: true });
    
    // Show completion modal
    showWorkoutCompleteModal();
}

// Stop Workout
function stopWorkout() {
    isWorkoutActive = false;
    isPaused = false;
    clearInterval(exerciseTimer);
    clearInterval(workoutTimer);
    
    if (recognition && isListening) {
        recognition.stop();
    }
    
    resetWorkoutState();
}

// Reset Workout State
function resetWorkoutState() {
    currentExerciseIndex = 0;
    totalWorkoutTime = 0;
    completedExercisesCount = 0;
    timeRemaining = 30;
    
    startWorkoutBtn.style.display = 'inline-block';
    pauseWorkoutBtn.style.display = 'none';
    nextExerciseBtn.style.display = 'none';
    
    updateStats();
    updateProgress();
}

// Update Timer Display
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerValueEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Update Progress
function updateProgress() {
    const progress = workoutExercises.length > 0 
        ? ((currentExerciseIndex + (isPaused ? 0 : 1)) / workoutExercises.length) * 100 
        : 0;
    
    progressBarEl.style.width = progress + '%';
    progressTextEl.textContent = Math.round(progress) + '% Complete';
}

// Update Stats
function updateStats() {
    const minutes = Math.floor(totalWorkoutTime / 60);
    const seconds = totalWorkoutTime % 60;
    totalTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    completedExercisesEl.textContent = completedExercisesCount;
    
    // Rough calorie estimate (5 calories per minute of exercise)
    const calories = Math.round((totalWorkoutTime / 60) * 5);
    caloriesEstimateEl.textContent = calories;
}

// Show Workout Complete Modal
function showWorkoutCompleteModal() {
    const modal = showWorkoutModal('workoutCompleteModal');
    if (!modal) return;
    
    const minutes = Math.floor(totalWorkoutTime / 60);
    const seconds = totalWorkoutTime % 60;
    document.getElementById('finalTotalTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('finalExerciseCount').textContent = completedExercisesCount;
    document.getElementById('finalCalories').textContent = Math.round((totalWorkoutTime / 60) * 5);
    
    modal.show();
}

// Show Voice Help
function showVoiceHelp() {
    // Show the voice commands modal
    const modal = showWorkoutModal('voiceCommandsModal');
    if (modal) {
        modal.show();
    }
}

// Add Exercise to Workout
function addExerciseToWorkout(exercise) {
    // Get existing workout queue
    const stored = localStorage.getItem('workoutQueue');
    let queue = stored ? JSON.parse(stored) : [];
    
    // Check if already added
    const exists = queue.some(ex => (ex.id || ex.name) === (exercise.id || exercise.name));
    
    if (!exists) {
        queue.push(exercise);
        localStorage.setItem('workoutQueue', JSON.stringify(queue));
        
        showSuccessToast(`${exercise.name} added to workout!`);
        speak(`${exercise.name} added to your workout`);
        
        // Update workout display if in workout mode
        if (workoutModeScreen.style.display === 'block') {
            loadWorkoutExercises();
        }
    } else {
        showErrorToast('Exercise already in workout');
        speak('This exercise is already in your workout');
    }
}

// Event Listeners
if (workoutLink) {
    workoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await enterWorkoutMode();
    });
}

if (exitWorkoutBtn) {
    exitWorkoutBtn.addEventListener('click', exitWorkoutMode);
}

// Back to Home Link
const backToHomeLink = document.getElementById('backToHomeLink');
if (backToHomeLink) {
    backToHomeLink.addEventListener('click', (e) => {
        e.preventDefault();
        exitWorkoutMode();
    });
}

// Workout Nav Brand
const workoutNavBrand = document.getElementById('workoutNavBrand');
if (workoutNavBrand) {
    workoutNavBrand.addEventListener('click', (e) => {
        e.preventDefault();
        exitWorkoutMode();
    });
}

if (startWorkoutBtn) {
    startWorkoutBtn.addEventListener('click', startWorkout);
}

if (pauseWorkoutBtn) {
    pauseWorkoutBtn.addEventListener('click', () => {
        if (isPaused) {
            resumeWorkout();
        } else {
            pauseWorkout();
        }
    });
}

if (nextExerciseBtn) {
    nextExerciseBtn.addEventListener('click', nextExercise);
}

if (repeatInstructionsBtn) {
    repeatInstructionsBtn.addEventListener('click', repeatInstructions);
}

if (voiceHelpToggle) {
    voiceHelpToggle.addEventListener('click', showVoiceHelp);
}

if (addToWorkoutBtn) {
    addToWorkoutBtn.addEventListener('click', () => {
        // Get current exercise from modal
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) {
            const exerciseName = modalTitle.textContent;
            const exercise = allExercises.find(ex => ex.name === exerciseName);
            if (exercise) {
                addExerciseToWorkout(exercise);
            }
        }
    });
}

// Start New Workout Button
const startNewWorkoutBtn = document.getElementById('startNewWorkout');
if (startNewWorkoutBtn) {
    startNewWorkoutBtn.addEventListener('click', () => {
        const modal = bootstrap.Modal.getInstance(document.getElementById('workoutCompleteModal'));
        modal.hide();
        resetWorkoutState();
        currentExerciseIndex = 0;
        enterWorkoutMode();
    });
}

// Toggle Speech Button
if (toggleSpeechBtn) {
    toggleSpeechBtn.addEventListener('click', toggleSpeech);
}

// Start Mic Button
if (startMicBtn) {
    startMicBtn.addEventListener('click', startSpeechRecognition);
}

// Clear Queue Button
if (clearQueueBtn) {
    clearQueueBtn.addEventListener('click', clearWorkoutQueue);
}

// Keyboard shortcuts for workout mode
document.addEventListener('keydown', (e) => {
    if (workoutModeScreen.style.display === 'block') {
        if (e.code === 'Space' && !isWorkoutActive) {
            e.preventDefault();
            startWorkout();
        } else if (e.code === 'KeyP' && isWorkoutActive) {
            e.preventDefault();
            if (isPaused) {
                resumeWorkout();
            } else {
                pauseWorkout();
            }
        } else if (e.code === 'KeyN' && isWorkoutActive) {
            e.preventDefault();
            nextExercise();
        } else if (e.code === 'KeyR') {
            e.preventDefault();
            repeatInstructions();
        } else if (e.code === 'Escape') {
            e.preventDefault();
            if (confirm('Exit workout mode?')) {
                exitWorkoutMode();
            }
        }
    }
});

console.log('Workout mode initialized');
