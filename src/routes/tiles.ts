import { Hono } from 'hono';

const tiles = new Hono<{ Bindings: Env }>();

tiles.get('/:m/:z/:x/:y', async (c) => {
    const { m, z, x, y } = c.req.param();
    const apiKey = c.env.THUNDERFOREST_API_KEY;
    const AVAILABLE_MAPS = ['cycle', 'transport', 'landscape', 'outdoors', 'spinal-map', 'mobile-atlas'];
    if (!AVAILABLE_MAPS.includes(m)) {
        return new Response('Map style not supported', { status: 400 });
    }
    if (!apiKey) {
        return new Response('Thunderforest API key not configured', { status: 500 });
    }
    const url = `https://tile.thunderforest.com/${m}/${z}/${x}/${y}.png?apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        return new Response('Failed to fetch tile', { status: response.status });
    }
    const image = await response.arrayBuffer();
    return new Response(image, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=604800',
        },
    });
});

export default tiles;
