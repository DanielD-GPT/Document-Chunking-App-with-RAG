// Global state
let documents = {};
let currentDocumentId = null;
let selectedChunks = new Set();
let chatHistory = [];

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const documentsContainer = document.getElementById('documentsContainer');
const chunksContainer = document.getElementById('chunksContainer');
const chunksActions = document.getElementById('chunksActions');
const chunkStats = document.getElementById('chunkStats');
const emptyState = document.getElementById('emptyState');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop();
    setupFileInput();
    loadDocuments();
});

// Setup drag and drop
function setupDragAndDrop() {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
}

// Setup file input
function setupFileInput() {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
            fileInput.value = ''; // Reset input
        }
    });
}

// Handle file upload
async function handleFile(file) {
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('Please upload a PDF file');
        return;
    }

    // Get chunking settings
    const chunkSize = document.getElementById('chunkSize').value || 400;
    const overlapSize = document.getElementById('overlapSize').value || 25;

    // Show loading
    loadingOverlay.style.display = 'flex';
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading document...';

    try {
        const formData = new FormData();
        formData.append('pdfFile', file);
        formData.append('chunkSize', chunkSize);
        formData.append('overlapSize', overlapSize);

        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
        }, 500);

        progressText.textContent = 'Extracting text with Azure Document Intelligence...';

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const data = await response.json();
        
        progressFill.style.width = '100%';
        progressText.textContent = `Created ${data.chunkCount} chunks!`;

        // Store document data
        documents[data.fileId] = data;

        // Update UI
        addDocumentToList(data);
        selectDocument(data.fileId);

        // Hide progress after delay
        setTimeout(() => {
            progressSection.style.display = 'none';
            loadingOverlay.style.display = 'none';
        }, 1500);

    } catch (error) {
        console.error('Upload error:', error);
        alert('Error: ' + error.message);
        progressSection.style.display = 'none';
        loadingOverlay.style.display = 'none';
    }
}

// Add document to list
function addDocumentToList(doc) {
    // Check if already exists
    const existing = document.querySelector(`[data-file-id="${doc.fileId}"]`);
    if (existing) {
        existing.remove();
    }

    const docElement = document.createElement('div');
    docElement.className = 'document-item';
    docElement.dataset.fileId = doc.fileId;
    docElement.innerHTML = `
        <div class="document-info" onclick="selectDocument('${doc.fileId}')">
            <div class="filename" title="${doc.filename}">📄 ${doc.filename}</div>
            <div class="stats">${doc.chunkCount} chunks • ${doc.totalTokens.toLocaleString()} tokens</div>
        </div>
        <div class="document-actions">
            <button class="delete-btn" onclick="deleteDocument('${doc.fileId}')" title="Delete">🗑️</button>
        </div>
    `;

    documentsContainer.prepend(docElement);
}

// Select document to view chunks
function selectDocument(fileId) {
    currentDocumentId = fileId;
    
    // Update active state
    document.querySelectorAll('.document-item').forEach(item => {
        item.classList.remove('active');
    });
    const selectedItem = document.querySelector(`[data-file-id="${fileId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    // Display chunks
    const doc = documents[fileId];
    if (doc) {
        displayChunks(doc);
    }
}

// Display chunks
function displayChunks(doc) {
    emptyState.style.display = 'none';
    chunksActions.style.display = 'flex';
    chunkStats.textContent = `${doc.chunkCount} chunks • ${doc.chunkSize} tokens/chunk • ${doc.overlapSize} token overlap`;

    chunksContainer.innerHTML = '';
    selectedChunks.clear();
    updateSelectedChunksCount();
    document.getElementById('selectAllChunks').checked = false;

    doc.chunks.forEach((chunk, index) => {
        const chunkCard = document.createElement('div');
        chunkCard.className = 'chunk-card';
        chunkCard.dataset.chunkId = chunk.id;
        
        const hasOverlap = index > 0;
        const overlapBadge = hasOverlap ? `<span class="overlap-indicator">↔ ${doc.overlapSize} token overlap</span>` : '';
        
        chunkCard.innerHTML = `
            <div class="chunk-header">
                <div>
                    <input type="checkbox" class="chunk-checkbox" data-chunk-id="${chunk.id}" onchange="toggleChunkSelection(${chunk.id}, this.checked)" onclick="event.stopPropagation()">
                    <span class="chunk-number" onclick="toggleChunk(this.parentElement.parentElement)">Chunk ${chunk.id}</span>
                    ${overlapBadge}
                </div>
                <div class="chunk-meta" onclick="toggleChunk(this.parentElement)">
                    <span>🔢 ${chunk.tokenCount} tokens</span>
                    <span>📍 ${chunk.startToken} - ${chunk.endToken}</span>
                    ${chunk.isLastChunk ? '<span>🏁 Last</span>' : ''}
                </div>
            </div>
            <div class="chunk-content collapsed">${escapeHtml(chunk.text)}</div>
        `;

        chunksContainer.appendChild(chunkCard);
    });
}

// Toggle chunk expansion
function toggleChunk(header) {
    const content = header.nextElementSibling;
    content.classList.toggle('collapsed');
}

// Delete document
async function deleteDocument(fileId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }

    try {
        const response = await fetch(`/documents/${fileId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Remove from UI
            const docElement = document.querySelector(`[data-file-id="${fileId}"]`);
            if (docElement) {
                docElement.remove();
            }

            // Remove from state
            delete documents[fileId];

            // Clear chunks if this was selected
            if (currentDocumentId === fileId) {
                currentDocumentId = null;
                chunksContainer.innerHTML = '';
                emptyState.style.display = 'block';
                chunksActions.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete document');
    }
}

// Export chunks
function exportChunks() {
    if (!currentDocumentId || !documents[currentDocumentId]) {
        return;
    }

    const doc = documents[currentDocumentId];
    const dataStr = JSON.stringify(doc, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.filename.replace('.pdf', '')}-chunks.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Load existing documents
async function loadDocuments() {
    try {
        const response = await fetch('/documents');
        const docs = await response.json();
        
        for (const doc of docs) {
            // Fetch full document data
            const fullDoc = await fetch(`/chunks/${doc.fileId}`).then(r => r.json());
            documents[doc.fileId] = fullDoc;
            addDocumentToList(fullDoc);
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

// Utility: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Toggle chunk selection
function toggleChunkSelection(chunkId, isSelected) {
    if (isSelected) {
        selectedChunks.add(chunkId);
    } else {
        selectedChunks.delete(chunkId);
    }
    
    // Update card styling
    const card = document.querySelector(`.chunk-card[data-chunk-id="${chunkId}"]`);
    if (card) {
        card.classList.toggle('selected', isSelected);
    }
    
    updateSelectedChunksCount();
    updateSelectAllCheckbox();
}

// Toggle select all chunks
function toggleSelectAllChunks() {
    const selectAllCheckbox = document.getElementById('selectAllChunks');
    const isChecked = selectAllCheckbox.checked;
    const checkboxes = document.querySelectorAll('.chunk-checkbox');
    
    checkboxes.forEach(checkbox => {
        const chunkId = parseInt(checkbox.dataset.chunkId);
        checkbox.checked = isChecked;
        toggleChunkSelection(chunkId, isChecked);
    });
}

// Update select all checkbox state
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllChunks');
    const checkboxes = document.querySelectorAll('.chunk-checkbox');
    const checkedCount = document.querySelectorAll('.chunk-checkbox:checked').length;
    
    if (checkedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCount === checkboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

// Update selected chunks count display
function updateSelectedChunksCount() {
    const countElement = document.getElementById('selectedCount');
    countElement.textContent = selectedChunks.size;
}

// Get selected chunks text
function getSelectedChunksText() {
    if (!currentDocumentId || !documents[currentDocumentId]) {
        return [];
    }
    
    const doc = documents[currentDocumentId];
    return doc.chunks
        .filter(chunk => selectedChunks.has(chunk.id))
        .map(chunk => ({
            id: chunk.id,
            text: chunk.text
        }));
}

// Handle chat keypress
function handleChatKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

// Send chat message
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    const selectedChunksData = getSelectedChunksText();
    
    if (selectedChunksData.length === 0) {
        alert('Please select at least one chunk to use as context for your question.');
        return;
    }
    
    // Clear input
    input.value = '';
    
    // Add user message to chat
    addChatMessage(message, 'user');
    
    // Show typing indicator
    const typingIndicator = showTypingIndicator();
    
    // Disable send button
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                chunks: selectedChunksData,
                documentId: currentDocumentId
            })
        });
        
        // Remove typing indicator
        typingIndicator.remove();
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Chat request failed');
        }
        
        const data = await response.json();
        addChatMessage(data.response, 'assistant');
        
    } catch (error) {
        typingIndicator.remove();
        console.error('Chat error:', error);
        addChatMessage('Error: ' + error.message, 'error');
    } finally {
        sendBtn.disabled = false;
    }
}

// Add message to chat
function addChatMessage(content, type) {
    const chatMessages = document.getElementById('chatMessages');
    
    // Remove welcome message if present
    const welcome = chatMessages.querySelector('.chat-welcome');
    if (welcome) {
        welcome.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-content">${escapeHtml(content)}</div>
        <div class="message-time">${time}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Store in history
    chatHistory.push({ type, content, time });
}

// Show typing indicator
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant typing';
    typingDiv.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return typingDiv;
}
