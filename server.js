const express = require('express');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());

// Helper function to extract media from the common post data structure
function extractMediaFromPostData(postData) {
  const media = [];
  if (!postData) return media;

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
  return media;
}


app.post('/getMedia', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
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

    // First, check if Instagram is demanding a login
    if (html.includes("Log in to Instagram") || html.includes("login_required")) {
      throw new Error("Instagram requires a login to view this post. The tool cannot access private or login-restricted content.");
    }

    let media = [];

    // Method 1: Try to parse JSON-LD data (more modern)
    try {
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
      if (jsonLdMatch && jsonLdMatch[1]) {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.video && jsonLd.video.contentUrl) {
          media.push({ type: 'video', url: jsonLd.video.contentUrl });
        } else if (jsonLd.image && jsonLd.image.contentUrl) {
          media.push({ type: 'image', url: jsonLd.image.contentUrl });
        } else if (jsonLd.contentUrl) {
            // Sometimes it's at the top level
            const type = jsonLd['@type'] === 'VideoObject' ? 'video' : 'image';
            media.push({ type, url: jsonLd.contentUrl });
        }
      }
    } catch (e) {
      console.log('JSON-LD parsing failed. Trying other methods. Error:', e.message);
    }

    // Method 2: Try finding the `_sharedData` object (older method)
    if (media.length === 0) {
      try {
        const sharedDataMatch = html.match(/<script type="text\/javascript">window\._sharedData = (.*?);<\/script>/);
        if (sharedDataMatch && sharedDataMatch[1]) {
          const jsonData = JSON.parse(sharedDataMatch[1]);
          const postData = jsonData.entry_data.PostPage[0].graphql.shortcode_media;
          media = extractMediaFromPostData(postData);
        }
      } catch (e) {
        console.log('_sharedData parsing failed. Trying meta tags. Error:', e.message);
      }
    }

    // Method 3: Fallback to basic meta tags
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
      res.json({ media });
    } else {
      res.status(404).json({ error: 'Could not find any media in the post. The account might be private, the link invalid, or the post format is not supported.' });
    }

  } catch (error) {
    console.error('Error fetching Instagram media:', error);
    res.status(500).json({ error: `An error occurred: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
