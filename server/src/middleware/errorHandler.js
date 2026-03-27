const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((item) => item.message);
    return res.status(400).json({
      message: 'Validation failed',
      details,
    });
  }

  return res.status(500).json({
    message: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;
