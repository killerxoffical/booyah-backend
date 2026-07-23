const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API: Get list of images in a category
app.get('/api/images/:category', (req, res) => {
    const category = req.params.category;
    
    // Sanitize category to prevent directory traversal
    if (!['avatar', 'banner', 'badge', 'currency', 'icon', 'others', 'slider'].includes(category)) {
        return res.status(400).json({ success: false, error: "Invalid category" });
    }

    const directoryPath = path.join(__dirname, 'images', category);

    fs.readdir(directoryPath, (err, files) => {
        if (err) {
            console.error(`Unable to scan directory: ${directoryPath}`, err);
            return res.status(500).json({ success: false, error: "Unable to scan directory" });
        }
        
        // Filter out non-image files if needed
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
        });

        res.json({
            success: true,
            category: category,
            images: imageFiles
        });
    });
});

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '')));

// Fallback to index.html for SPA if needed
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Booyah Server is running on port ${PORT}`);
    console.log(`Local Access: http://localhost:${PORT}`);
});
