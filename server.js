const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API: Get list of images in a category from GitHub
app.get('/api/images/:category', async (req, res) => {
    const category = req.params.category;
    
    // Sanitize category
    if (!['avatar', 'banner', 'badge', 'currency', 'icon', 'others', 'slider'].includes(category)) {
        return res.status(400).json({ success: false, error: "Invalid category" });
    }

    try {
        // Fetch from the main frontend repo
        const githubApiUrl = `https://api.github.com/repos/killerxoffical/booyahmini-app/contents/images/${category}`;
        
        // Optional: If you face rate limits, you can add a Personal Access Token here
        // const headers = { 'Authorization': 'token YOUR_GITHUB_PAT' };
        
        const response = await fetch(githubApiUrl);
        
        if (!response.ok) {
            if (response.status === 404) {
                return res.json({ success: true, category: category, images: [] });
            }
            throw new Error(`GitHub API Error: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Filter out non-image files if needed
        const imageFiles = data
            .filter(item => item.type === 'file')
            .filter(file => {
                const ext = path.extname(file.name).toLowerCase();
                return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
            })
            .map(file => file.name);

        res.json({
            success: true,
            category: category,
            images: imageFiles
        });
    } catch (err) {
        console.error(`Error fetching from GitHub API:`, err);
        return res.status(500).json({ success: false, error: "Unable to fetch images from GitHub" });
    }
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
