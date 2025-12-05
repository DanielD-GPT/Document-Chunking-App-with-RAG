# Document Chunking App with RAG

A modern web application for uploading PDF documents and chunking them into configurable token-sized segments with overlap. Designed to help visualize and prototype document processing and chunking for those new to building RAG (Retrieval-Augmented Generation) solutions.

## Features

📄 **PDF File Upload**: Drag and drop or click to upload PDF documents for processing

📊 **Configurable Chunking**: Set custom chunk size (default 400 tokens) and overlap size (default 25 tokens)

🔍 **Azure Document Intelligence**: Uses Azure's AI to extract text from PDF documents

👁️ **Chunk Visualization**: View all chunks with token counts and overlap indicators

📋 **Export to JSON**: Download chunks as JSON for use in RAG pipelines and other applications

📚 **Document Management**: View, select, and delete processed documents

## Architecture

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js with Express
- **Azure Services**:
  - Azure Document Intelligence (PDF text extraction)

## Prerequisites

- Node.js 16+ and npm
- Azure subscription with:
  - Azure Document Intelligence (Form Recognizer) resource

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/DanielD-GPT/Document-Chunking-App-with-RAG.git
cd Document-Chunking-App-with-RAG
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Azure Credentials

Create a `.env` file in the root directory by copying `.env.example`:

```bash
copy .env.example .env
```

Edit `.env` and add your Azure credentials:

```env
# Azure Document Intelligence Configuration
AZURE_CONTENT_UNDERSTANDING_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_CONTENT_UNDERSTANDING_KEY=your_api_key_here

# Server Configuration
PORT=3000
```

#### How to Get Azure Credentials:

**Azure Document Intelligence:**

1. Go to [Azure Portal](https://portal.azure.com)
2. Create or navigate to your Azure Document Intelligence (Form Recognizer) resource
3. Go to "Keys and Endpoint" section
4. Copy the endpoint URL and one of the keys

### 4. Run the Application

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

The server will start on http://localhost:3000

### 5. Open in Browser

Navigate to:

```
http://localhost:3000
```

## Usage

1. **Upload PDF**: Drag and drop or click to upload a PDF document
2. **Configure Settings**: Adjust chunk size and overlap as needed (defaults: 400 tokens, 25 overlap)
3. **View Chunks**: See all generated chunks in the right pane with token counts
4. **Export Data**: Download chunks as JSON for use in your RAG pipeline
5. **Manage Documents**: Access previously processed files or delete them

## Chunking Logic

The application chunks documents based on tokens (words/whitespace-separated units):

- **Chunk Size**: Number of tokens per chunk (default: 400)
- **Overlap**: The last N tokens of each chunk are repeated at the start of the next chunk (default: 25)

**Example with chunk size 400 and overlap 25:**
- Chunk 1: Tokens 0-399 (400 tokens)
- Chunk 2: Tokens 375-774 (first 25 tokens overlap with end of chunk 1)
- Chunk 3: Tokens 750-1149 (first 25 tokens overlap with end of chunk 2)
- And so on...

## Project Structure

```
Document-Chunking-App-with-RAG/
├── public/
│   ├── index.html          # Main HTML file with two-pane layout
│   ├── styles.css          # Application styling
│   └── script.js           # Frontend JavaScript logic
├── uploads/                # Temporary storage for uploaded PDF files
├── server.js               # Express server with Azure integration
├── package.json            # Node.js dependencies
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## API Endpoints

### POST /upload

Upload and chunk a PDF document.

- **Request**: `multipart/form-data` with `pdf` field
- **Query Parameters**: `chunkSize` (default: 400), `overlapSize` (default: 25)
- **Response**:
```json
{
  "fileId": "unique-file-id",
  "filename": "document.pdf",
  "totalChunks": 15,
  "chunkSize": 400,
  "overlapSize": 25,
  "chunks": [...]
}
```

### GET /documents

List all processed documents.

- **Response**:
```json
{
  "documents": [
    {
      "fileId": "unique-file-id",
      "filename": "document.pdf",
      "totalChunks": 15,
      "uploadedAt": "2025-12-05T..."
    }
  ]
}
```

### GET /chunks/:fileId

Get chunks for a specific document.

- **Response**:
```json
{
  "fileId": "unique-file-id",
  "filename": "document.pdf",
  "chunks": [...]
}
```

### DELETE /documents/:fileId

Delete a document and its chunks.

- **Response**:
```json
{
  "message": "Document deleted successfully"
}
```

### GET /export/:fileId

Export chunks as a downloadable JSON file.

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express
- **Azure AI Services**:
  - Azure Document Intelligence - PDF text extraction
- **Other Libraries**:
  - multer - File upload handling
  - axios - HTTP client for Azure API calls
  - form-data - Multipart form data handling
  - dotenv - Environment variable management

## Security Notes

- Never commit `.env` file to version control
- Keep your Azure API keys secure
- Uploaded files are stored temporarily in the `uploads/` directory
- Consider implementing file cleanup and size limits for production use

## Troubleshooting

**Issue: Server won't start**
- Check that port 3000 is not in use
- Verify `.env` file exists and has correct values

**Issue: PDF processing fails**
- Verify Azure Document Intelligence credentials and endpoint
- Check that the PDF file is valid and not corrupted
- Ensure your Azure resource has sufficient quota

**Issue: Chunks not generating correctly**
- Verify the PDF contains extractable text (not scanned images)
- Check chunk size and overlap settings are valid numbers

## License

MIT

## Support

For issues or questions, please check the Azure documentation:

- [Azure Document Intelligence](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/)
- [Azure AI Services](https://azure.microsoft.com/en-us/products/ai-services/)

---

## ⚠️ DISCLAIMER

**This application is a prototype intended for proof of concept and demonstration purposes only.** It is specifically designed to help visualize and prototype document processing and chunking for those new to building RAG solutions. It is not designed, tested, or supported for production use. Use at your own risk. Microsoft makes no warranties, express or implied, regarding the functionality, reliability, or suitability of this code for any purpose. For production scenarios, please consult official Microsoft documentation and implement appropriate security, scalability, and compliance measures.
