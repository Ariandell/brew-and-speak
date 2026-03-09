import app from '../server/index.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default function handler(req: VercelRequest, res: VercelResponse) {
    return app(req, res);
}
