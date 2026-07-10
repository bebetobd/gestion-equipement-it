export default function handler(req, res) {
  res.status(200).json({ ok: true, catchall: true, url: req.url });
}
