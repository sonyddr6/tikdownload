const express = require('express');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());

// The new endpoint to handle all media types
app.post('/getMedia', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Use a realistic User-Agent to mimic a browser
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch the URL: ${response.statusText}`);
    }
    const html = await response.text();

    let media = [];

    // Method 1: Try to find the embedded JSON data from `window._sharedData`
    try {
      const scriptRegex = /<script type="text\/javascript">window\._sharedData = (.*?);<\/script>/;
      const match = html.match(scriptRegex);
      if (match && match[1]) {
        const jsonData = JSON.parse(match[1]);
        const postData = jsonData.entry_data.PostPage[0].graphql.shortcode_media;

        if (postData.__typename === 'GraphSidecar') { // Carousel post
          postData.edge_sidecar_to_children.edges.forEach(edge => {
            const node = edge.node;
            if (node.is_video) {
              media.push({ type: 'video', url: node.video_url });
            } else {
              media.push({ type: 'image', url: node.display_url });
            }
          });
        } else if (postData.is_video) { // Single video post
          media.push({ type: 'video', url: postData.video_url });
        } else { // Single image post
          media.push({ type: 'image', url: postData.display_url });
        }
      }
    } catch (e) {
      console.log('Could not parse embedded JSON from _sharedData. Will fall back to meta tags. Error:', e.message);
    }


    // Method 2: Fallback to meta tags if JSON parsing fails or finds nothing
    if (media.length === 0) {
      const ogVideoMatch = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/);
      if (ogVideoMatch && ogVideoMatch[1]) {
        media.push({ type: 'video', url: ogVideoMatch[1] });
      } else {
        const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
        if (ogImageMatch && ogImageMatch[1]) {
          media.push({ type: 'image', url: ogImageMatch[1] });
        }
      }
    }

    if (media.length > 0) {
      res.json({ media }); // Send back an array of media objects
    } else {
      res.status(404).json({ error: 'Could not find any media in the post. The account might be private or the link is invalid.' });
    }

  } catch (error) {
    console.error('Error fetching Instagram media:', error);
    res.status(500).json({ error: `An error occurred: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
