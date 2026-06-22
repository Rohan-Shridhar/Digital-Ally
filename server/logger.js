/**
 * Structured JSON logger middleware
 * Logs request details to stdout when response finishes
 */

function createLogger() {
  return (req, res, next) => {
    // Capture start time
    const startTime = Date.now();

    // Capture original end and finish handlers
    const originalEnd = res.end;
    const originalWrite = res.write;

    // Track if we've already logged (to avoid double logging)
    let logged = false;

    // Function to log the request
    const logRequest = () => {
      if (logged) return;
      logged = true;

      const durationMs = Date.now() - startTime;
      const clientId = req.get('X-Client-ID') || null;
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const endpoint = req.path;
      const promptLength = req.body?.prompt?.length || 0;
      const statusCode = res.statusCode;

      const logEntry = {
        timestamp: new Date().toISOString(),
        ip,
        clientId,
        endpoint,
        promptLength,
        statusCode,
        durationMs,
      };

      // Write structured JSON to stdout
      console.log(JSON.stringify(logEntry));
    };

    // Hook into response finish event
    res.on('finish', logRequest);

    // Also hook into close event in case finish doesn't fire
    res.on('close', logRequest);

    next();
  };
}

module.exports = { createLogger };
