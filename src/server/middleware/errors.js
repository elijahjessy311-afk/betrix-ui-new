export default function errors(err, req, res, _next) {
  // basic express error handler
  console.error('Unhandled error', err && err.stack ? err.stack : err);
  try {
    res.status(500).send('internal error');
  } catch (e) {
    void e;
  }
}
