const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'signatures.json');

module.exports = async (req, res) => {
    try {
        if (!fs.existsSync(filePath)) {
            return res.json([]);
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(data);
    } catch (e) {
        res.json([]);
    }
};
