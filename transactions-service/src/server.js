import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => console.log(`transactions-service escuchando en :${config.port}`));
