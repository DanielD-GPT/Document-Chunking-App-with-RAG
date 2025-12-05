# Document Chunker App

A web application that allows you to upload PDF documents and chunk them into configurable token-sized segments with overlap.

## Features

- **Drag & Drop Upload**: Easy PDF upload via drag and drop or file browser
- **Configurable Chunking**: Set custom chunk size (default 400 tokens) and overlap size (default 25 tokens)
- **Azure Document Intelligence**: Uses Azure's AI to extract text from PDF documents
- **Chunk Visualization**: View all chunks with token counts and overlap indicators
- **Export to JSON**: Download chunks as JSON for use in other applications
- **Document Management**: View, select, and delete processed documents

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Azure credentials** in `.env`:
   ```
   AZURE_CONTENT_UNDERSTANDING_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/
   AZURE_CONTENT_UNDERSTANDING_KEY=your_api_key_here
   ```

3. **Start the application**:
   ```bash
   npm start
   ```

4. Open http://localhost:3000 in your browser

## Chunking Logic

The application chunks documents based on tokens (words/whitespace-separated units):

- **Chunk Size**: Number of tokens per chunk (default: 400)
- **Overlap**: The last N tokens of each chunk are repeated at the start of the next chunk (default: 25)

Example with chunk size 400 and overlap 25:
- Chunk 1: Tokens 0-399 (400 tokens)
- Chunk 2: Tokens 375-774 (first 25 tokens overlap with end of chunk 1)
- Chunk 3: Tokens 750-1149 (first 25 tokens overlap with end of chunk 2)
- And so on...

## API Endpoints

- `POST /upload` - Upload and chunk a PDF document
- `GET /documents` - List all processed documents
- `GET /chunks/:fileId` - Get chunks for a specific document
- `DELETE /documents/:fileId` - Delete a document
- `GET /export/:fileId` - Export chunks as JSON file

## Technology Stack

- **Backend**: Node.js with Express
- **Document Processing**: Azure Document Intelligence (Form Recognizer)
- **Frontend**: Vanilla HTML/CSS/JavaScript
