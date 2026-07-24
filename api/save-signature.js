// api/save-signature.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'public', 'signatures.json');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ success: false });

    try {
        const entry = req.body;
        let signatures = [];

        if (fs.existsSync(filePath)) {
            signatures = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        signatures.unshift(entry); // newest first

        fs.writeFileSync(filePath, JSON.stringify(signatures, null, 2));

        res.status(200).json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false });
    }
};
