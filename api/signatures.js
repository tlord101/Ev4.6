// api/signatures.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'signatures.json');

module.exports = async (req, res) => {
    try {
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return res.status(200).json(data);
        }
        return res.status(200).json([]);
    } catch (error) {
        console.error(error);
        return res.status(200).json([]);
    }
};
