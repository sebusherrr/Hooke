import 'dotenv/config';
import { createApp } from './app';

const port = Number(process.env.PORT) || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`Abingdon Library API listening on :${port} (${process.env.NODE_ENV || 'development'})`);
});
