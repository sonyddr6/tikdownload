const express = require('express');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());

app.post('/getImageUrl', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${response.statusText}`);
    }
    const html = await response.text();

    // More robust regex to find the og:image content
    const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);

    if (match && match[1]) {
      const imageUrl = match[1];
      res.json({ imageUrl });
    } else {
      res.status(404).json({ error: 'Could not find the image URL (og:image tag not found).' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while trying to fetch the image URL.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
