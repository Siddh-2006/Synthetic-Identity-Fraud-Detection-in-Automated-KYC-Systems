import axios from 'axios';

const FASTAPI_URL = 'http://127.0.0.1:8000';

const checkConnection = async () => {
  try {
    console.log(`Checking connection to ${FASTAPI_URL}...`);
    const response = await axios.get(`${FASTAPI_URL}/`);
    console.log('Connection successful!');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    console.error('Connection failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Possible causes: FastAPI is not running or listening on port 8000.');
    }
  }
};

checkConnection();
