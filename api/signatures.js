// api/signatures.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'signatures.json');

module.exports = async (req, res) => {
    try {
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return res.json(data);
        }
        return res.json([]);
    } catch (e) {
        return res.json([]);
    }
};
