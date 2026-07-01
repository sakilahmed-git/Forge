export { default as Frontend } from './App';
import { productRoutes } from 'src/routes/product.routes';
import { orderRoutes } from 'src/routes/order.routes';
try { async function init() { // Initialize frontend } init(); } catch (error) { console.error('Error initializing frontend:', error); }