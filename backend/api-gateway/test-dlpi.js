const express = require('express');
require('dotenv').config();
const dlpiRoutes = require('./src/routes/dlpi');
const { issueDemoToken } = require('./src/middleware/auth');
const app = express();
app.use(express.json());
app.use('/api/dlpi', dlpiRoutes);

const token = issueDemoToken('patwari', 'Vijay Singh', { jurisdictionCode: 'GBN-DAD', tehsilCode: 'DAD' });
const request = require('supertest');
request(app)
  .post('/api/dlpi')
  .set('Authorization', 'Bearer ' + token)
  .send({ dlpiId: 'DLPI-UP-DAD-12345' })
  .end((err, res) => {
    console.log('Status:', res.status);
    console.log('Body:', res.body);
    process.exit(0);
  });
