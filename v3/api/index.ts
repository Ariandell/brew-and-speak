import { createProductionApp } from '../server/createProductionApp.js';

export default createProductionApp();

export const config = { api: { bodyParser: false } };
