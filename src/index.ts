import { Hono } from 'hono';
import init from './routes/init';
import locations from './routes/locations';
import tokens from './routes/tokens';
import tiles from './routes/tiles';
import { requestLoggingMiddleware } from './middleware/logging';

const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', requestLoggingMiddleware());

app.route('/init', init);
app.route('/locations', locations);
app.route('/tokens', tokens);
app.route('/tiles', tiles);

export default app satisfies ExportedHandler<Env>;
