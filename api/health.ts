export default function handler(req: any, res: any) {
  res.status(200).json({ ok: true, route: '/api/health', method: req.method })
}
