import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export const compareFaces = async (face1Path, face2Path) => {
    try {
        const formData = new FormData();
        formData.append('file1', fs.createReadStream(face1Path));
        formData.append('file2', fs.createReadStream(face2Path));

        const response = await axios.post(`${PYTHON_SERVICE_URL}/compare`, formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        return response.data;
    } catch (error) {
        console.error(`Error comparison faces:`, error.message);
        return { verified: false, similarity: 0, error: error.message };
    }
};
