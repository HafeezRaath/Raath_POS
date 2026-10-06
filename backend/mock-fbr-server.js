// ============================================================
// mock-fbr-server.js — Fake FBR API for Testing
// Run: node mock-fbr-server.js
// ============================================================

const http = require('http');
const url = require('url');

const PORT = 9999;

// Generate fake 28-digit FBR reference
function generateFBRReference() {
  return Array.from({ length: 28 }, () => Math.floor(Math.random() * 10)).join('');
}

// Validate invoice payload
function validatePayload(data) {
  const required = ['bposId', 'invoiceType', 'invoiceDate', 'buyerSellerName', 'Items'];
  const missing = required.filter(field => !data[field]);
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missing.join(', ')}`
    };
  }

  if (!Array.isArray(data.Items) || data.Items.length === 0) {
    return { valid: false, error: 'Items array is required and cannot be empty' };
  }

  for (const item of data.Items) {
    if (!item.productCode || !item.productDescription) {
      return { valid: false, error: 'Each item must have productCode and productDescription' };
    }
  }

  return { valid: true };
}

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${parsedUrl.pathname}`);

  // Health Check
  if (parsedUrl.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'Mock FBR Server Running', 
      time: new Date().toISOString(),
      uptime: process.uptime()
    }));
    return;
  }

  // FBR Sandbox Endpoint
  if (parsedUrl.pathname === '/DigitalInvoicing/v1/PostInvoiceData_v1' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => { body += chunk; });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('[MockFBR] Received Invoice:');
        console.log(JSON.stringify(data, null, 2));

        // Query params for testing
        const { fail, delay, errorCode } = parsedUrl.query;

        // Simulate delay
        if (delay) {
          const ms = parseInt(delay);
          console.log(`[MockFBR] Delaying response by ${ms}ms`);
          setTimeout(() => sendResponse(res, data, fail, errorCode), ms);
          return;
        }

        sendResponse(res, data, fail, errorCode);

      } catch (err) {
        console.error('[MockFBR] Parse Error:', err.message);
        res.writeHead(400);
        res.end(JSON.stringify({
          statusCode: 400,
          message: 'Invalid JSON',
          errorMessage: err.message
        }));
      }
    });
    return;
  }

  // FBR Production Endpoint (mock)
  if (parsedUrl.pathname === '/pdi/v1/api/DigitalInvoicing/PostInvoiceData_v1' && req.method === 'POST') {
    // Same as sandbox but with different URL
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('[MockFBR] Received Invoice (Production):');
        console.log(JSON.stringify(data, null, 2));

        const reference = generateFBRReference();
        console.log('[MockFBR] Success — FBR Reference:', reference);

        res.writeHead(200);
        res.end(JSON.stringify({
          statusCode: 200,
          message: 'Invoice posted successfully',
          result: reference,
          invoiceNumber: data.invoiceType || '1',
          invoiceDate: data.invoiceDate,
          totalSalesTaxApplicable: data.totalSalesTaxApplicable || 0,
          totalRetailPrice: data.totalRetailPrice || 0
        }));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ statusCode: 400, message: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({ statusCode: 404, message: 'Not Found' }));
});

function sendResponse(res, data, fail, errorCode) {
  // Simulate random failure (10% chance)
  const shouldFail = fail === 'true' || (fail !== 'false' && Math.random() < 0.1);
  
  if (shouldFail) {
    const errorMsg = errorCode === '500' 
      ? 'Internal Server Error' 
      : 'FBR server temporarily unavailable';
    
    console.log('[MockFBR] Simulated failure:', errorMsg);
    res.writeHead(500);
    res.end(JSON.stringify({
      statusCode: 500,
      message: 'Internal Server Error (Simulated)',
      errorMessage: errorMsg
    }));
    return;
  }

  // Validate
  const validation = validatePayload(data);
  if (!validation.valid) {
    console.log('[MockFBR] Validation Failed:', validation.error);
    res.writeHead(400);
    res.end(JSON.stringify({
      statusCode: 400,
      message: 'Bad Request',
      errorMessage: validation.error
    }));
    return;
  }

  // Success response
  const reference = generateFBRReference();
  console.log('[MockFBR] Success — FBR Reference:', reference);

  res.writeHead(200);
  res.end(JSON.stringify({
    statusCode: 200,
    message: 'Invoice posted successfully',
    result: reference,
    invoiceNumber: data.invoiceType || '1',
    invoiceDate: data.invoiceDate,
    totalSalesTaxApplicable: data.totalSalesTaxApplicable || 0,
    totalRetailPrice: data.totalRetailPrice || 0
  }));
}

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║                             MOCK FBR SERVER                              ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  Endpoint: http://localhost:${PORT}/DigitalInvoicing/v1/PostInvoiceData_v1  ║
║  Health:   http://localhost:${PORT}/health                           ║
║                                                                          ║
║  Features:                                                            ║
║  • Returns fake 28-digit FBR references                                 ║
║  • Validates invoice payload                                            ║
║  • Simulates 10% random failures (for retry testing)                    ║
║  • Logs all requests to console                                         ║
║  • Query params: ?fail=true or ?delay=5000                             ║
║                                                                          ║
║  Test URLs:                                                           ║
║  • Success: http://localhost:${PORT}/DigitalInvoicing/v1/PostInvoiceData_v1  ║
║  • Fail:    http://localhost:${PORT}/DigitalInvoicing/v1/PostInvoiceData_v1?fail=true  ║
║  • Delay:   http://localhost:${PORT}/DigitalInvoicing/v1/PostInvoiceData_v1?delay=3000  ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝

Press Ctrl+C to stop
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nMock FBR Server stopped');
  process.exit(0);
});