import { Hono } from 'hono';
import init from './routes/init';
import locations from './routes/locations';
import tokens from './routes/tokens';

const app = new Hono<{ Bindings: Env }>();

app.route('/init', init);
app.route('/locations', locations);
app.route('/tokens', tokens);

export default app satisfies ExportedHandler<Env>;
