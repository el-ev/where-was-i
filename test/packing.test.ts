
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PackService } from '../src/services/PackService';
import { LocationService } from '../src/services/LocationService';

// Mock R2Bucket
const mockBucket = {
    put: vi.fn(),
    get: vi.fn(),
} as unknown as R2Bucket;

// Mock D1Database
const createMockStmt = (returnValue?: any) => {
    const stmt = {
        bind: vi.fn(() => stmt),
        first: vi.fn(),
        all: vi.fn(),
        run: vi.fn(),
    };
    if (returnValue) {
        stmt.first.mockResolvedValue(returnValue);
        stmt.all.mockResolvedValue(returnValue);
        stmt.run.mockResolvedValue(returnValue);
    }
    return stmt;
};

const mockDB = {
    prepare: vi.fn(() => createMockStmt()),
} as unknown as D1Database;

describe('PackService', () => {
    let packService: PackService;

    beforeEach(() => {
        vi.clearAllMocks();
        packService = new PackService(mockDB, mockBucket);
    });

    it('should not pack if not enough locations', async () => {
        // Mock DB returns count < 1000
        const prepareMock = mockDB.prepare as any;

        const lastPackStmt = createMockStmt({ end_id: 0 });
        const countStmt = createMockStmt({ count: 500 });

        prepareMock
            .mockReturnValueOnce(lastPackStmt)
            .mockReturnValueOnce(countStmt);

        await packService.packLocations();

        expect(mockBucket.put).not.toHaveBeenCalled();
    });

    it('should pack locations if enough exist', async () => {
        const locations = Array.from({ length: 1000 }, (_, i) => ({
            id: i + 1,
            latitude: 0,
            longitude: 0,
            altitude: 0,
            timestamp: 1000 + i
        }));

        const prepareMock = mockDB.prepare as any;

        // Setup separate mock statements for each call sequence
        const lastPackStmt = createMockStmt({ end_id: 0 });
        const countStmt = createMockStmt({ count: 1000 });
        const fetchStmt = createMockStmt({ results: locations });
        const insertStmt = createMockStmt({ success: true });

        prepareMock
            .mockReturnValueOnce(lastPackStmt)
            .mockReturnValueOnce(countStmt)
            .mockReturnValueOnce(fetchStmt)
            .mockReturnValueOnce(insertStmt);

        await packService.packLocations();

        expect(mockBucket.put).toHaveBeenCalledWith(
            'packs/1_1000.json',
            expect.any(String),
            expect.any(Object)
        );
        expect(prepareMock).toHaveBeenCalledTimes(4);
    });
});

describe('LocationService Hybrid Fetch', () => {
    let locationService: LocationService;

    beforeEach(() => {
        vi.clearAllMocks();
        locationService = new LocationService(mockDB, mockBucket);
    });

    it('should fetch from packs and D1', async () => {
        const packRecord = {
            object_key: 'packs/1_1000.json',
            max_time: 2000
        };
        const packedData = [{ id: 1, timestamp: 1000, latitude: 0, longitude: 0 }];
        const d1Data = [{ id: 1001, timestamp: 2001, latitude: 0, longitude: 0 }];

        // Mock Pack Query
        const prepareMock = mockDB.prepare as any;

        const packsStmt = createMockStmt({ results: [packRecord] });
        const locationsStmt = createMockStmt({ results: d1Data });

        prepareMock
            .mockReturnValueOnce(packsStmt)
            .mockReturnValueOnce(locationsStmt);

        // Mock R2 Fetch
        (mockBucket.get as any).mockResolvedValue({
            json: vi.fn().mockResolvedValue(packedData)
        });

        const results = await locationService.getLocations({});

        expect(mockBucket.get).toHaveBeenCalledWith('packs/1_1000.json');
        expect(results).toHaveLength(2); // 1 from pack, 1 from D1
        expect(results[0].id).toBe(1001); // D1 (newer)
        expect(results[1].id).toBe(1);    // Pack (older) - sorted desc
    });
});
