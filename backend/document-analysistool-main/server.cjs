const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Config multer to store uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// Middlewares
app.use(cors({
  origin: 'http://localhost:5173', // Allow connections from Vite Dev Server
  credentials: true
}));
app.use(express.json());

// Main Document Analysis Proxy Endpoint
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const modelId = req.query.modelId || 'prebuilt-layout';

    if (!file) {
      return res.status(400).json({ error: { message: 'No document file uploaded.' } });
    }

    const endpoint = process.env.AZURE_DOC_INTEL_ENDPOINT;
    const apiKey = process.env.AZURE_DOC_INTEL_KEY;

    if (!endpoint || !apiKey) {
      return res.status(500).json({ 
        error: { message: 'Azure Document Intelligence credentials are not configured on the backend server.' } 
      });
    }

    // Clean endpoint string
    let baseEndpoint = endpoint.trim();
    if (!baseEndpoint.startsWith('http://') && !baseEndpoint.startsWith('https://')) {
      baseEndpoint = 'https://' + baseEndpoint;
    }
    if (baseEndpoint.endsWith('/')) {
      baseEndpoint = baseEndpoint.slice(0, -1);
    }

    console.log(`[Azure API] Submitting document ${file.originalname} using model: ${modelId}...`);

    // 1. Submit file to Azure Document Intelligence
    const submitUrl = `${baseEndpoint}/documentintelligence/documentModels/${modelId}:analyze?api-version=2024-11-30`;
    
    const submitResponse = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey.trim(),
        'Content-Type': 'application/octet-stream'
      },
      body: file.buffer
    });

    if (!submitResponse.ok) {
      let errorMsg = 'Failed to submit document to Azure';
      try {
        const errJson = await submitResponse.json();
        if (errJson.error && errJson.error.message) {
          errorMsg = errJson.error.message;
        }
      } catch (e) {
        errorMsg = `${submitResponse.status} ${submitResponse.statusText}`;
      }
      console.error(`[Azure API Error] Submission failed: ${errorMsg}`);
      return res.status(submitResponse.status).json({ error: { message: errorMsg } });
    }

    // Retrieve polling location
    const operationLocation = submitResponse.headers.get('operation-location') || submitResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      console.error('[Azure API Error] Operation-Location header is missing in response.');
      return res.status(500).json({ error: { message: 'Operation-Location header missing from Azure response.' } });
    }

    console.log(`[Azure API] Submission succeeded. Polling operation at: ${operationLocation}`);

    // 2. Poll Azure for results
    const maxRetries = 60; // 60 attempts * 2 seconds = 120s timeout
    let retries = 0;

    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 seconds

      console.log(`[Azure API] Polling status (attempt ${retries + 1}/${maxRetries})...`);
      const pollResponse = await fetch(operationLocation, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey.trim()
        }
      });

      if (!pollResponse.ok) {
        let errorMsg = 'Failed to poll analysis status from Azure';
        try {
          const errJson = await pollResponse.json();
          if (errJson.error && errJson.error.message) {
            errorMsg = errJson.error.message;
          }
        } catch (e) {
          errorMsg = `${pollResponse.status} ${pollResponse.statusText}`;
        }
        console.error(`[Azure API Error] Polling failed: ${errorMsg}`);
        return res.status(pollResponse.status).json({ error: { message: errorMsg } });
      }

      const pollData = await pollResponse.json();
      const status = pollData.status;

      if (status === 'succeeded') {
        console.log('[Azure API] Document analysis completed successfully!');
        return res.json({ analyzeResult: pollData.analyzeResult });
      } else if (status === 'failed') {
        const errorDetail = pollData.error?.message || 'Unknown processing error';
        console.error(`[Azure API Error] Document analysis failed: ${errorDetail}`);
        return res.status(500).json({ error: { message: `Azure analysis failed: ${errorDetail}` } });
      }

      retries++;
    }

    console.error('[Azure API Timeout] Analysis operation timed out.');
    return res.status(504).json({ error: { message: 'Document analysis operation timed out.' } });

  } catch (error) {
    console.error(`[Server Error] ${error.message}`);
    return res.status(500).json({ error: { message: error.message || 'Internal server error' } });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`==================================================`);
  console.log(`🚀 Secure Document Analysis Backend Server is running!`);
  console.log(`🔗 Local Access: http://localhost:${port}`);
  console.log(`==================================================`);
});
