const fs = require('fs');
const path = require('path');
const axios = require('axios');
const otpjs = require('otp.js');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

axios.defaults.baseURL = 'https://console.kinvey.com/_api/v4/';
axios.defaults.headers.post['Content-Type'] = 'application/json';

function login(retries=3) {
  return axios({
    method: 'POST',
    url: '/session',
    data: {
      email: process.env.ACCOUNT_EMAIL,
      password: process.env.ACCOUNT_PASSWORD,
      twoFactorToken: otpjs.googleAuthenticator.gen(process.env.ACCOUNT_SECRET)
    },
  }).then(({ data }) => {
    axios.defaults.headers.common['Authorization'] = `Kinvey ${data.token}`;
    return data;
  }).catch((err) => {
    console.error(err.response.data);
    return login(--retries);
  })
}

module.exports = {
  login
};
