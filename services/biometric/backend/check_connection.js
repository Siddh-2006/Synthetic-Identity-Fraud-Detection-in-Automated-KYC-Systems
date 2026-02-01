import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8080';

async function check() {
    console.log(`Checking connection to Python Service at: ${PYTHON_SERVICE_URL}`);
    try {
        const resp = await axios.get(`${PYTHON_SERVICE_URL}/health`);
        console.log('SUCCESS: Connection established!');
        console.log('Response:', resp.data);
    } catch (err) {
        console.error('FAILURE: Could not reach Python service.');
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', err.response.data);
        }
    }
}

check();
