// API Configuration
const API_EXERCISE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// Global variables
let allExercises = [];
let filteredExercises = [];
let deferredPrompt;

// DOM Elements
const exercisesGrid = document.getElementById('exercisesGrid');
const loadingSpinner = document.getElementById('loadingSpinner');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const muscleFilter = document.getElementById('muscleFilter');
const exerciseCount = document.getElementById('exerciseCount');
const installButton = document.getElementById('installButton');
const resultsCount = document.getElementById('resultsCount');
const clearSearchBtn = document.getElementById('clearSearch');
const resetFiltersBtn = document.getElementById('resetFilters');
const sortButton = document.getElementById('sortButton');
const backToTopBtn = document.getElementById('backToTop');
const savedCountBadge = document.getElementById('savedCount');

// State management
let currentSort = 'asc';
let savedExercises = JSON.parse(localStorage.getItem('savedExercises')) || [];

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}

// PWA Install Prompt
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installButton.style.display = 'block';
});

installButton.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
        installButton.style.display = 'none';
    }
});

// Load exercises on page load
document.addEventListener('DOMContentLoaded', () => {
    loadExercises();
    setupEventListeners();
    updateSavedCount();
    setupBackToTop();
});

// Fetch exercises from API
async function loadExercises() {
    try {
        showLoadingState();
        exercisesGrid.innerHTML = '';

        const response = await fetch(API_EXERCISE);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        allExercises = await response.json();
        filteredExercises = [...allExercises];

        // Populate filters
        populateFilters();

        // Display exercises
        displayExercises(filteredExercises);

        // Update count
        exerciseCount.textContent = allExercises.length.toLocaleString();
        updateResultsCount(filteredExercises.length);

        hideLoadingState();
        showSuccessToast('Exercises loaded successfully!');
        
        // Announce to screen readers
        announceToScreenReader(`${allExercises.length} exercises loaded successfully`);
    } catch (error) {
        console.error('Error loading exercises:', error);
        hideLoadingState();
        showErrorState(error.message);
        showErrorToast('Failed to load exercises. Please try again.');
    }
}

// Show loading state
function showLoadingState() {
    loadingSpinner.style.display = 'block';
    loadingSpinner.setAttribute('aria-busy', 'true');
}

// Hide loading state
function hideLoadingState() {
    loadingSpinner.style.display = 'none';
    loadingSpinner.setAttribute('aria-busy', 'false');
}

// Show error state
function showErrorState(errorMessage) {
    exercisesGrid.innerHTML = `
        <div class="col-12">
            <div class="alert alert-danger" role="alert">
                <h4 class="alert-heading">
                    <i class="bi bi-exclamation-triangle"></i> Unable to Load Exercises
                </h4>
                <p class="mb-3">We encountered an error while loading the exercise database.</p>
                <p class="mb-3"><strong>Error:</strong> ${errorMessage}</p>
                <hr>
                <p class="mb-0">
                    <button class="btn btn-danger" onclick="location.reload()">
                        <i class="bi bi-arrow-clockwise"></i> Retry
                    </button>
                    <small class="ms-3 text-muted">Check your internet connection and try again</small>
                </p>
            </div>
        </div>
    `;
}

// Update results count display
function updateResultsCount(count) {
    if (count === allExercises.length) {
        resultsCount.textContent = `Showing all ${count.toLocaleString()} exercises`;
    } else {
        resultsCount.textContent = `Found ${count.toLocaleString()} of ${allExercises.length.toLocaleString()} exercises`;
    }
    resultsCount.setAttribute('aria-live', 'polite');
}

// Populate filter dropdowns
function populateFilters() {
    const categories = [...new Set(allExercises.map(ex => ex.category).filter(Boolean))].sort();
    const primaryMuscles = [...new Set(allExercises.flatMap(ex => ex.primaryMuscles || []))].sort();

    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
        categoryFilter.appendChild(option);
    });

    muscleFilter.innerHTML = '<option value="">All Muscles</option>';
    primaryMuscles.forEach(muscle => {
        const option = document.createElement('option');
        option.value = muscle;
        option.textContent = muscle.charAt(0).toUpperCase() + muscle.slice(1);
        muscleFilter.appendChild(option);
    });
}

// Display exercises in grid
function displayExercises(exercises) {
    exercisesGrid.innerHTML = '';

    if (exercises.length === 0) {
        exercisesGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-info text-center" role="alert">
                    <div class="mb-3">
                        <i class="bi bi-search" style="font-size: 3rem;" aria-hidden="true"></i>
                    </div>
                    <h4 class="alert-heading">No exercises found</h4>
                    <p class="mb-0">Try adjusting your search terms or filters to find what you're looking for.</p>
                </div>
            </div>
        `;
        announceToScreenReader('No exercises found matching your criteria');
        return;
    }

    exercises.slice(0, 50).forEach((exercise, index) => {
        const card = createExerciseCard(exercise, index);
        exercisesGrid.appendChild(card);
    });

    if (exercises.length > 50) {
        const loadMoreDiv = document.createElement('div');
        loadMoreDiv.className = 'col-12 text-center my-4';
        loadMoreDiv.innerHTML = `
            <button class="btn btn-primary btn-lg" onclick="loadMoreExercises()" 
                    aria-label="Load ${exercises.length - 50} more exercises">
                <i class="bi bi-arrow-down-circle" aria-hidden="true"></i> 
                Load More (${exercises.length - 50} remaining)
            </button>
        `;
        exercisesGrid.appendChild(loadMoreDiv);
    }

    updateResultsCount(exercises.length);
    announceToScreenReader(`Displaying ${Math.min(50, exercises.length)} of ${exercises.length} exercises`);
}

// Create exercise card
function createExerciseCard(exercise, index) {
    const col = document.createElement('div');
    col.className = 'col-md-6 col-lg-4 col-xl-3 mb-4';

    const imagePath = exercise.images && exercise.images.length > 0 
        ? IMAGE_BASE_URL + exercise.images[0] 
        : 'https://via.placeholder.com/300x200?text=No+Image';

    const isSaved = savedExercises.includes(exercise.id || exercise.name);
    const savedIcon = isSaved 
        ? '<span class="saved-indicator" aria-label="Saved exercise"><i class="bi bi-bookmark-fill"></i></span>' 
        : '';

    const card = document.createElement('div');
    card.className = 'card h-100 exercise-card';
    card.tabIndex = 0;
    card.role = 'button';
    card.setAttribute('aria-label', `View details for ${exercise.name}, ${exercise.category || 'exercise'}${isSaved ? ' (Saved)' : ''}`);
    
    card.innerHTML = `
        <div class="position-relative">
            <img src="${imagePath}" 
                 class="card-img-top" 
                 alt="${exercise.name}" 
                 loading="lazy"
                 onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            ${savedIcon}
        </div>
        <div class="card-body">
            <h3 class="card-title h6">${exercise.name}</h3>
            <p class="card-text mb-2">
                <small class="text-muted">
                    <i class="bi bi-tag" aria-hidden="true"></i> ${exercise.category || 'N/A'}
                </small>
            </p>
            <div class="d-flex gap-2 flex-wrap">
                ${exercise.level ? `<span class="badge bg-primary">${capitalizeFirst(exercise.level)}</span>` : ''}
                ${exercise.primaryMuscles && exercise.primaryMuscles.length > 0 
                    ? `<span class="badge bg-info">${capitalizeFirst(exercise.primaryMuscles[0])}</span>` 
                    : ''}
            </div>
        </div>
    `;

    // Add click and keyboard event handlers
    card.addEventListener('click', () => showExerciseDetails(exercise));
    card.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showExerciseDetails(exercise);
        }
    });

    col.appendChild(card);
    return col;
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Show exercise details in modal
function showExerciseDetails(exercise) {
    const modal = new bootstrap.Modal(document.getElementById('exerciseModal'));
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const saveBtn = document.getElementById('saveExerciseBtn');
    const unsaveBtn = document.getElementById('unsaveExerciseBtn');

    modalTitle.textContent = exercise.name;

    const images = exercise.images && exercise.images.length > 0
        ? exercise.images.map((img, idx) => `
            <img src="${IMAGE_BASE_URL + img}" 
                 class="img-fluid mb-2 rounded" 
                 alt="${exercise.name} - Step ${idx + 1}" 
                 loading="lazy"
                 onerror="this.style.display='none'">
          `).join('')
        : '<div class="alert alert-secondary"><i class="bi bi-image"></i> No images available for this exercise</div>';

    modalBody.innerHTML = `
        <div class="row g-4">
            <div class="col-md-6">
                <div class="exercise-images">
                    ${images}
                </div>
            </div>
            <div class="col-md-6">
                <section class="mb-4">
                    <h6><i class="bi bi-info-circle"></i> Exercise Details</h6>
                    <div class="detail-grid">
                        <p><strong>Category:</strong> <span class="text-muted">${capitalizeFirst(exercise.category) || 'N/A'}</span></p>
                        <p><strong>Level:</strong> <span class="badge bg-${getLevelColor(exercise.level)}">${capitalizeFirst(exercise.level) || 'N/A'}</span></p>
                        <p><strong>Force:</strong> <span class="text-muted">${capitalizeFirst(exercise.force) || 'N/A'}</span></p>
                        <p><strong>Mechanic:</strong> <span class="text-muted">${capitalizeFirst(exercise.mechanic) || 'N/A'}</span></p>
                        <p><strong>Equipment:</strong> <span class="text-muted">${capitalizeFirst(exercise.equipment) || 'None'}</span></p>
                    </div>
                </section>
                
                ${exercise.primaryMuscles && exercise.primaryMuscles.length > 0 ? `
                    <section class="mb-4">
                        <h6><i class="bi bi-bullseye"></i> Primary Muscles</h6>
                        <p>${exercise.primaryMuscles.map(m => `<span class="badge bg-primary me-1 mb-1">${capitalizeFirst(m)}</span>`).join('')}</p>
                    </section>
                ` : ''}
                
                ${exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 ? `
                    <section class="mb-4">
                        <h6><i class="bi bi-circle"></i> Secondary Muscles</h6>
                        <p>${exercise.secondaryMuscles.map(m => `<span class="badge bg-secondary me-1 mb-1">${capitalizeFirst(m)}</span>`).join('')}</p>
                    </section>
                ` : ''}
            </div>
        </div>
        
        ${exercise.instructions && exercise.instructions.length > 0 ? `
            <div class="row mt-4">
                <div class="col-12">
                    <section>
                        <h6><i class="bi bi-list-ol"></i> Step-by-Step Instructions</h6>
                        <ol class="instructions-list">
                            ${exercise.instructions.map(inst => `<li>${inst}</li>`).join('')}
                        </ol>
                    </section>
                </div>
            </div>
        ` : ''}
    `;

    // Update save/unsave button
    const isSaved = savedExercises.includes(exercise.id || exercise.name);
    if (isSaved) {
        saveBtn.classList.add('d-none');
        unsaveBtn.classList.remove('d-none');
        unsaveBtn.onclick = () => unsaveExercise(exercise);
    } else {
        unsaveBtn.classList.add('d-none');
        saveBtn.classList.remove('d-none');
        saveBtn.onclick = () => saveExercise(exercise);
    }

    modal.show();
    announceToScreenReader(`Viewing details for ${exercise.name}`);
}

// Get level color for badge
function getLevelColor(level) {
    const colors = {
        'beginner': 'success',
        'intermediate': 'warning',
        'advanced': 'danger',
        'expert': 'danger'
    };
    return colors[level?.toLowerCase()] || 'secondary';
}

// Save exercise to favorites
function saveExercise(exercise) {
    const exerciseId = exercise.id || exercise.name;
    if (!savedExercises.includes(exerciseId)) {
        savedExercises.push(exerciseId);
        localStorage.setItem('savedExercises', JSON.stringify(savedExercises));
        updateSavedCount();
        showSuccessToast(`${exercise.name} saved to favorites!`);
        
        // Update button state
        const saveBtn = document.getElementById('saveExerciseBtn');
        const unsaveBtn = document.getElementById('unsaveExerciseBtn');
        saveBtn.classList.add('d-none');
        unsaveBtn.classList.remove('d-none');
        unsaveBtn.onclick = () => unsaveExercise(exercise);
        
        // Refresh the grid to show bookmark icon
        displayExercises(filteredExercises);
    }
}

// Unsave exercise from favorites
function unsaveExercise(exercise) {
    const exerciseId = exercise.id || exercise.name;
    savedExercises = savedExercises.filter(id => id !== exerciseId);
    localStorage.setItem('savedExercises', JSON.stringify(savedExercises));
    updateSavedCount();
    showSuccessToast(`${exercise.name} removed from favorites`);
    
    // Update button state
    const saveBtn = document.getElementById('saveExerciseBtn');
    const unsaveBtn = document.getElementById('unsaveExerciseBtn');
    unsaveBtn.classList.add('d-none');
    saveBtn.classList.remove('d-none');
    saveBtn.onclick = () => saveExercise(exercise);
    
    // Refresh the grid to remove bookmark icon
    displayExercises(filteredExercises);
}

// Update saved count badge
function updateSavedCount() {
    savedCountBadge.textContent = savedExercises.length;
    savedCountBadge.setAttribute('aria-label', `${savedExercises.length} saved exercises`);
}

// Setup event listeners
function setupEventListeners() {
    // Search and filter events
    searchInput.addEventListener('input', debounce(filterExercises, 300));
    categoryFilter.addEventListener('change', filterExercises);
    muscleFilter.addEventListener('change', filterExercises);
    
    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        filterExercises();
        searchInput.focus();
    });
    
    // Reset filters button
    resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Sort button
    sortButton.addEventListener('click', toggleSort);
    
    // Saved exercises link
    const savedLink = document.getElementById('savedLink');
    if (savedLink) {
        savedLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSavedExercises();
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Reset all filters
function resetFilters() {
    searchInput.value = '';
    categoryFilter.value = '';
    muscleFilter.value = '';
    filterExercises();
    showSuccessToast('Filters reset successfully');
    searchInput.focus();
}

// Toggle sort order
function toggleSort() {
    currentSort = currentSort === 'asc' ? 'desc' : 'asc';
    sortButton.innerHTML = currentSort === 'asc' 
        ? '<i class="bi bi-sort-alpha-down"></i> Sort A-Z'
        : '<i class="bi bi-sort-alpha-up"></i> Sort Z-A';
    
    filteredExercises.sort((a, b) => {
        return currentSort === 'asc' 
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
    });
    
    displayExercises(filteredExercises);
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
    }
    
    // Escape to clear search
    if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        filterExercises();
    }
}

// Filter exercises
function filterExercises() {
    const searchTerm = searchInput.value.toLowerCase();
    const categoryValue = categoryFilter.value.toLowerCase();
    const muscleValue = muscleFilter.value.toLowerCase();

    filteredExercises = allExercises.filter(exercise => {
        const matchesSearch = exercise.name.toLowerCase().includes(searchTerm);
        const matchesCategory = !categoryValue || exercise.category?.toLowerCase() === categoryValue;
        const matchesMuscle = !muscleValue || 
            exercise.primaryMuscles?.some(m => m.toLowerCase() === muscleValue) ||
            exercise.secondaryMuscles?.some(m => m.toLowerCase() === muscleValue);

        return matchesSearch && matchesCategory && matchesMuscle;
    });

    displayExercises(filteredExercises);
}

// Load more exercises
function loadMoreExercises() {
    displayExercises(filteredExercises);
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Show saved exercises
function showSavedExercises() {
    if (savedExercises.length === 0) {
        exercisesGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-info text-center" role="alert">
                    <div class="mb-3">
                        <i class="bi bi-bookmark" style="font-size: 3rem;" aria-hidden="true"></i>
                    </div>
                    <h4 class="alert-heading">No Saved Exercises</h4>
                    <p class="mb-3">You haven't saved any exercises yet.</p>
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="bi bi-arrow-left"></i> Browse Exercises
                    </button>
                </div>
            </div>
        `;
        updateResultsCount(0);
        announceToScreenReader('No saved exercises found');
        
        // Scroll to exercises section
        document.getElementById('main-content').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    // Filter exercises to show only saved ones
    const savedExercisesList = allExercises.filter(exercise => {
        const exerciseId = exercise.id || exercise.name;
        return savedExercises.includes(exerciseId);
    });

    if (savedExercisesList.length === 0) {
        // Saved IDs exist but exercises not found (data might have changed)
        exercisesGrid.innerHTML = `
            <div class="col-12">
                <div class="alert alert-warning text-center" role="alert">
                    <div class="mb-3">
                        <i class="bi bi-exclamation-triangle" style="font-size: 3rem;" aria-hidden="true"></i>
                    </div>
                    <h4 class="alert-heading">Saved Exercises Not Found</h4>
                    <p class="mb-3">Your saved exercises could not be loaded. They may have been removed from the database.</p>
                    <button class="btn btn-warning me-2" onclick="localStorage.removeItem('savedExercises'); location.reload()">
                        <i class="bi bi-trash"></i> Clear Saved List
                    </button>
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="bi bi-arrow-left"></i> Browse All Exercises
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Display saved exercises
    displayExercises(savedExercisesList);
    updateResultsCount(savedExercisesList.length);
    showSuccessToast(`Showing ${savedExercisesList.length} saved exercise${savedExercisesList.length !== 1 ? 's' : ''}`);
    announceToScreenReader(`Showing ${savedExercisesList.length} saved exercises`);
    
    // Scroll to exercises section
    document.getElementById('main-content').scrollIntoView({ behavior: 'smooth' });
    
    // Add a "Show All" button at the top
    const showAllBtn = document.createElement('div');
    showAllBtn.className = 'col-12 mb-3';
    showAllBtn.innerHTML = `
        <div class="alert alert-success d-flex align-items-center justify-content-between" role="alert">
            <div>
                <i class="bi bi-bookmark-check-fill me-2"></i>
                <strong>Viewing Saved Exercises</strong> (${savedExercisesList.length} total)
            </div>
            <button class="btn btn-sm btn-success" onclick="location.reload()">
                <i class="bi bi-grid-3x3"></i> Show All Exercises
            </button>
        </div>
    `;
    exercisesGrid.insertBefore(showAllBtn, exercisesGrid.firstChild);
}

// Toast notification functions
function showSuccessToast(message) {
    const toast = document.getElementById('successToast');
    const messageElement = document.getElementById('successMessage');
    messageElement.textContent = message;
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();
}

function showErrorToast(message) {
    const toast = document.getElementById('errorToast');
    const messageElement = document.getElementById('errorMessage');
    messageElement.textContent = message;
    const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
    bsToast.show();
}

// Announce to screen readers
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'visually-hidden';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
}

// Back to top functionality
function setupBackToTop() {
    if (!backToTopBtn) return;

    // Show/hide button based on scroll position
    const toggleBackToTop = () => {
        if (window.scrollY > 300) {
            backToTopBtn.style.display = 'flex';
            backToTopBtn.setAttribute('aria-hidden', 'false');
        } else {
            backToTopBtn.style.display = 'none';
            backToTopBtn.setAttribute('aria-hidden', 'true');
        }
    };

    // Initial check
    toggleBackToTop();

    // Listen to scroll events
    window.addEventListener('scroll', toggleBackToTop, { passive: true });

    // Smooth scroll to top
    backToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        announceToScreenReader('Scrolled to top of page');
    });
}
