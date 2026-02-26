import { Request, Response, NextFunction } from 'express';

export function requireAccessCode(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const SITE_ACCESS_CODE = process.env.SITE_ACCESS_CODE || '';
  const SITE_ACCESS_USER = process.env.SITE_ACCESS_USER || 'ari';
  const ACCESS_REALM = 'Ari Trading Bot';

  if (!SITE_ACCESS_CODE) return next();
  if (req.method === 'OPTIONS') return next();

  const auth = req.headers['authorization'];
  if (auth && typeof auth === 'string' && auth.startsWith('Basic ')) {
    try {
      const payload = Buffer.from(auth.split(' ')[1], 'base64').toString(
        'utf8',
      );
      const [user, pass] = payload.split(':');
      if (user === SITE_ACCESS_USER && pass === SITE_ACCESS_CODE) return next();
    } catch (e) {}
  }

  res.setHeader(
    'WWW-Authenticate',
    `Basic realm="${ACCESS_REALM}", charset="UTF-8"`,
  );
  return res.status(401).send('Access code required');
}
