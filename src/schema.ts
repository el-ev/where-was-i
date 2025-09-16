import { z } from 'zod';

export const locationSchema = z.object(
    {
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        alt: z.number(),
        t: z.number().int().nonnegative(),
    }
);

export type LocationRecord = {
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

const parseDate = (arg: unknown): Date | undefined => {
    if (typeof arg === 'string' || arg instanceof Date) {
        const d = new Date(arg);
        if (!isNaN(d.getTime())) return d;
    }
    return undefined;
};

const parseNonNegativeNumber = (arg: unknown): number | undefined => {
    const n = Number(arg);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const parseLimit = (arg: unknown): number | undefined => {
    const parsed = Number(arg);
    if (!Number.isFinite(parsed)) return undefined;
    const n = Math.max(1, Math.floor(parsed));
    return Math.min(n, 1000);
};

const parseBbox = (arg: unknown): [number, number, number, number] | undefined => {
    if (typeof arg === 'string') {
        const parts = arg.split(',').map(Number);
        if (parts.length === 4 && parts.every(num => Number.isFinite(num))) {
            return parts as [number, number, number, number];
        }
    } else if (Array.isArray(arg) && arg.length === 4 && arg.every(num => typeof num === 'number')) {
        return arg as [number, number, number, number];
    }
    return undefined;
};

export const locationQuerySchema = z
    .object({
        startId: z.preprocess(parseNonNegativeNumber, z.number().int().min(0).optional()),
        startTime: z.preprocess(parseDate, z.date().optional()),
        endTime: z.preprocess(parseDate, z.date().optional()),
        clusterMaxDist: z.preprocess(parseNonNegativeNumber, z.number().min(0).optional()),
        limit: z.preprocess(parseLimit, z.number().int().min(0).optional()),
        bbox: z.preprocess(parseBbox, z.tuple([z.number(), z.number(), z.number(), z.number()]).optional()),
    })
    .superRefine((val, ctx) => {
        if (val.startTime && val.endTime && val.startTime.getTime() > val.endTime.getTime()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'startTime must be before or equal to endTime',
                path: ['startTime'],
            });
        }

        if (val.bbox) {
            const [west, south, east, north] = val.bbox;
            if (south < -90 || north > 90) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'bbox latitudes must be between -90 and 90',
                    path: ['bbox'],
                });
            }
            if (west < -180 || east > 180) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'bbox longitudes must be between -180 and 180',
                    path: ['bbox'],
                });
            }
            if (south > north) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'bbox south latitude must be <= north latitude',
                    path: ['bbox'],
                });
            }
            if (west > east) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'bbox west longitude must be <= east longitude',
                    path: ['bbox'],
                });
            }
        }
    });

export type LocationQueryParams = z.infer<typeof locationQuerySchema>;
