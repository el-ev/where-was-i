import { Permissions, TokenRecord } from '../schema';
import { generateToken } from '../utils/token';
import { sha256 } from 'hono/utils/crypto';

export class TokenService {
    constructor(private db: D1Database) { }

    async createToken(data: {
        permissions: Permissions,
        expires_at: number | null,
        comment: string | null,
        available_start_time: number | null,
        available_end_time: number | null
    }): Promise<string> {
        const newToken = generateToken();
        const tokenHash = await sha256(newToken);

        await this.db.prepare(
            'INSERT INTO tokens (token_hash, permissions, expires_at, comment, available_start_time, available_end_time) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
            tokenHash,
            JSON.stringify(data.permissions),
            data.expires_at,
            data.comment,
            data.available_start_time,
            data.available_end_time
        ).run();

        return newToken;
    }

    async listTokens(): Promise<(TokenRecord & { permissions: Permissions })[]> {
        const { results } = await this.db.prepare(
            'SELECT id, permissions, expires_at, comment, available_start_time, available_end_time FROM tokens'
        ).all<TokenRecord>();

        return results.map(t => ({
            ...t,
            permissions: JSON.parse(t.permissions as unknown as string)
        }));
    }

    async getTokenRecord(tokenHash: string): Promise<TokenRecord | null> {
        return await this.db.prepare(
            'SELECT * FROM tokens WHERE token_hash = ?'
        ).bind(tokenHash).first<TokenRecord>();
    }
}
