<?php

return [
    // Database Connection: 'sqlite' or 'mysql'
    'DB_CONNECTION' => 'mysql',

    // MySQL Configuration (Ignored if DB_CONNECTION is 'sqlite')
    'DB_HOST' => 'localhost',
    'DB_PORT' => '3306',
    'DB_DATABASE' => 'u1234567_insyarah', // Change to your production database name
    'DB_USERNAME' => 'u1234567_user',  // Change to your production username
    'DB_PASSWORD' => 'your_password',  // Change to your production password

    // App URL (Optional, for email links etc)
    'APP_URL' => 'https://ruanglegalitas.com',
    
    // Debug Mode (Set to false in production)
    'DEBUG' => false,
];
