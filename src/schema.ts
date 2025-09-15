import { z } from 'zod';

export const locationSchema = z.object(
    {
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        alt: z.number(),
        t: z.number().int().nonnegative(),
    }
);

export type Location = {
    id: number;
    latitude: number;
    longitude: number;
    altitude: number;
    timestamp: number;
}

export const permissionsSchema = z.object(
    {
        write: z.boolean().default(false),
        read: z.boolean().default(false),
        create_token: z.boolean().default(false),
    }
);

export type Permissions = z.infer<typeof permissionsSchema>;

export const createTokenSchema = z.object({
    expires: z.boolean().default(true),
    expires_in_days: z.number().int().nonnegative().default(30),
    permissions: permissionsSchema,
});

export type TokenRecord = {
    id: number;
    token_hash: string;
    permissions: Permissions;
    expires_at: number | null;
}
