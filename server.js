require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔒 Lockr server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔐 Security features: ${process.env.NODE_ENV === 'production' ? 'ENABLED' : 'DEV MODE'}`);
}); 