import { Hono } from 'hono';
import init from './routes/init';
import locations from './routes/locations';
import tokens from './routes/tokens';
import tiles from './routes/tiles';
import { requestLoggingMiddleware } from './middleware/logging';
import { PackService } from './services/PackService';

const app = new Hono<{ Bindings: Env }>();

app.use('*', requestLoggingMiddleware());

app.route('/init', init);
app.route('/locations', locations);
app.route('/tokens', tokens);
app.route('/tiles', tiles);

export default {
    fetch: app.fetch,
    scheduled: async (event, env, ctx) => {
        const db = env.DB;
        const bucket = env.PACKS_BUCKET;
        const packService = new PackService(db, bucket);
        await packService.packLocations();
    }
} satisfies ExportedHandler<Env>;
