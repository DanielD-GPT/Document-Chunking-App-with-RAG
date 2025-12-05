const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.pdf')) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Store document chunks in memory
let documentChunks = {};

// Simple tokenizer - splits by whitespace and punctuation
function tokenize(text) {
    // Split on whitespace and keep words/punctuation as tokens
    const tokens = text.match(/\S+/g) || [];
    return tokens;
}

// Convert tokens back to text
function detokenize(tokens) {
    return tokens.join(' ');
}

// Chunk text with overlap
function chunkText(text, chunkSize = 400, overlapSize = 25) {
    const tokens = tokenize(text);
    const chunks = [];
    
    if (tokens.length === 0) {
        return chunks;
    }
    
    let startIndex = 0;
    let chunkNumber = 1;
    
    while (startIndex < tokens.length) {
        // Get chunk tokens
        const endIndex = Math.min(startIndex + chunkSize, tokens.length);
        const chunkTokens = tokens.slice(startIndex, endIndex);
        
        // Create chunk object
        const chunk = {
            id: chunkNumber,
            text: detokenize(chunkTokens),
            tokenCount: chunkTokens.length,
            startToken: startIndex,
            endToken: endIndex - 1,
            isLastChunk: endIndex >= tokens.length
        };
        
        chunks.push(chunk);
        
        // Move start index for next chunk (with overlap)
        // The last 'overlapSize' tokens of this chunk will be the first tokens of the next
        startIndex = endIndex - overlapSize;
        
        // Prevent infinite loop if overlap >= chunk size
        if (startIndex <= chunks[chunks.length - 1].startToken && !chunk.isLastChunk) {
            startIndex = endIndex;
        }
        
        chunkNumber++;
        
        // Safety check
        if (chunk.isLastChunk) break;
    }
    
    return chunks;
}

// Azure Document Intelligence API integration
async function analyzeDocument(filePath, originalFilename, retryCount = 0) {
    const maxRetries = 3;
    const baseDelay = 1000;
    
    try {
        console.log('Analyzing document:', originalFilename);
        
        const formData = new FormData();
        const fileStream = fs.createReadStream(filePath);
        formData.append('file', fileStream, originalFilename);

        const analyzeResponse = await axios.post(
            `${process.env.AZURE_CONTENT_UNDERSTANDING_ENDPOINT}formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`,
            formData,
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': process.env.AZURE_CONTENT_UNDERSTANDING_KEY,
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 90000
            }
        );

        const operationLocation = analyzeResponse.headers['operation-location'];
        if (!operationLocation) {
            throw new Error('No operation location received from Azure');
        }

        // Poll for results
        let resultResponse;
        let attempts = 0;
        const maxAttempts = 30;
        
        do {
            await new Promise(resolve => setTimeout(resolve, 2000));
            resultResponse = await axios.get(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': process.env.AZURE_CONTENT_UNDERSTANDING_KEY
                }
            });
            attempts++;
        } while (resultResponse.data.status === 'running' && attempts < maxAttempts);

        if (resultResponse.data.status === 'succeeded') {
            const pages = resultResponse.data.analyzeResult?.pages || [];
            let extractedText = '';
            
            for (const page of pages) {
                if (page.lines) {
                    for (const line of page.lines) {
                        extractedText += line.content + '\n';
                    }
                }
            }
            
            console.log('Extracted text length:', extractedText.length);
            return extractedText.trim();
        } else {
            throw new Error(`Document analysis failed with status: ${resultResponse.data.status}`);
        }
    } catch (error) {
        console.error('Azure API Error:', error.response?.data || error.message);
        
        if (error.response?.status === 429 && retryCount < maxRetries) {
            const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;
            console.log(`Rate limited. Retrying in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return analyzeDocument(filePath, originalFilename, retryCount + 1);
        }
        
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload and chunk document
app.post('/upload', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        const fileId = req.file.filename;
        
        // Get chunking parameters from request or use defaults
        const chunkSize = parseInt(req.body.chunkSize) || parseInt(process.env.DEFAULT_CHUNK_SIZE) || 400;
        const overlapSize = parseInt(req.body.overlapSize) || parseInt(process.env.DEFAULT_OVERLAP_SIZE) || 25;

        console.log(`Processing ${req.file.originalname} with chunk size: ${chunkSize}, overlap: ${overlapSize}`);

        // Extract text using Azure Document Intelligence
        const extractedText = await analyzeDocument(filePath, req.file.originalname);
        
        // Chunk the text
        const chunks = chunkText(extractedText, chunkSize, overlapSize);
        
        // Store chunks
        documentChunks[fileId] = {
            filename: req.file.originalname,
            fileId: fileId,
            originalText: extractedText,
            totalTokens: tokenize(extractedText).length,
            chunkSize: chunkSize,
            overlapSize: overlapSize,
            chunks: chunks,
            uploadTime: new Date().toISOString()
        };

        console.log(`Created ${chunks.length} chunks for ${req.file.originalname}`);

        res.json({
            success: true,
            fileId: fileId,
            filename: req.file.originalname,
            totalTokens: tokenize(extractedText).length,
            chunkCount: chunks.length,
            chunkSize: chunkSize,
            overlapSize: overlapSize,
            chunks: chunks
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
});

// Get chunks for a document
app.get('/chunks/:fileId', (req, res) => {
    const { fileId } = req.params;
    const document = documentChunks[fileId];
    
    if (!document) {
        return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(document);
});

// Get all documents
app.get('/documents', (req, res) => {
    const documents = Object.values(documentChunks).map(doc => ({
        fileId: doc.fileId,
        filename: doc.filename,
        totalTokens: doc.totalTokens,
        chunkCount: doc.chunks.length,
        uploadTime: doc.uploadTime
    }));
    res.json(documents);
});

// Delete a document
app.delete('/documents/:fileId', (req, res) => {
    const { fileId } = req.params;
    
    if (!documentChunks[fileId]) {
        return res.status(404).json({ error: 'Document not found' });
    }
    
    // Delete the file
    const filePath = path.join(__dirname, 'uploads', fileId);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    
    delete documentChunks[fileId];
    res.json({ success: true, message: 'Document deleted' });
});

// Export chunks as JSON
app.get('/export/:fileId', (req, res) => {
    const { fileId } = req.params;
    const document = documentChunks[fileId];
    
    if (!document) {
        return res.status(404).json({ error: 'Document not found' });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}-chunks.json"`);
    res.json(document);
});

// RAG Chat endpoint
app.post('/chat', async (req, res) => {
    try {
        const { message, chunks, documentId } = req.body;
        
        if (!message || !chunks || chunks.length === 0) {
            return res.status(400).json({ error: 'Message and selected chunks are required' });
        }
        
        // Build context from selected chunks
        const context = chunks.map(chunk => 
            `[Chunk ${chunk.id}]: ${chunk.text}`
        ).join('\n\n');
        
        // Build the prompt for the LLM
        const systemPrompt = `You are a helpful assistant that answers questions based on the provided document chunks. 
Only use the information from the provided chunks to answer questions. 
If the answer cannot be found in the chunks, say so clearly.
Be concise and accurate in your responses.`;

        const userPrompt = `Context from document chunks:
${context}

---

User Question: ${message}

Please answer based on the context provided above.`;

        // Call Azure OpenAI
        const response = await axios.post(
            `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview`,
            {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7,
                max_tokens: 1000
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': process.env.AZURE_OPENAI_KEY
                }
            }
        );
        
        const assistantMessage = response.data.choices[0].message.content;
        
        res.json({
            success: true,
            response: assistantMessage,
            chunksUsed: chunks.length
        });
        
    } catch (error) {
        console.error('Chat error:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            return res.status(401).json({ error: 'Azure OpenAI authentication failed. Check your API key.' });
        }
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Azure OpenAI deployment not found. Check your endpoint and deployment name.' });
        }
        
        res.status(500).json({ error: 'Failed to get response from AI: ' + (error.response?.data?.error?.message || error.message) });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large (max 50MB)' });
        }
    }
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`Document Chunker running on http://localhost:${PORT}`);
});
