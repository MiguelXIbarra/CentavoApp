import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => console.log(`auth-service escuchando en :${config.port}`));
