import { createProductionApp } from './createProductionApp.js';

const port = Number(process.env.PORT ?? 3000);
const app = createProductionApp();

app.listen(port, () => {
  console.log(`English with Coffee API listening on port ${port}`);
});
