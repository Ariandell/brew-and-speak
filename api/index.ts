import { createProductionApp } from '../v3/server/createProductionApp.js';

export const config = {
    api: {
        bodyParser: false,
    },
};

const app = createProductionApp();

export default app;
