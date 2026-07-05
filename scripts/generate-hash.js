'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');

const password = process.env.ADMIN_DEFAULT_PASSWORD;

if (!password) {
    console.error('ADMIN_DEFAULT_PASSWORD not set in .env');
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);

console.log('\nYour new hash:');
console.log(hash);
console.log('\nCopy the line above and paste it into Railway.\n');