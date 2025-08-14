const express = require('express');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

// Helper to find a key recursively in a JSON object
function findKey(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  if (key in obj) return obj[key];
  for (const k in obj) {
    const found = findKey(obj[k], key);
    if (found) return found;
  }
  return null;
}

// Helper to extract media URLs from a `shortcode_media` object
function extractMediaFromPostData(postData) {
  const media = [];
  if (!postData) return media;

  if (postData.__typename === 'GraphSidecar') {
    postData.edge_sidecar_to_children.edges.forEach(edge => {
      const node = edge.node;
      if (node.is_video) {
        media.push({ type: 'video', url: node.video_url });
      } else {
        media.push({ type: 'image', url: node.display_url });
      }
    });
  } else if (postData.is_video) {
    media.push({ type: 'video', url: postData.video_url });
  } else {
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
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
    const html = await response.text();

    if (html.includes("Log in to Instagram") || html.includes("login_required")) {
      throw new Error("Instagram requires login to view this post. The tool cannot access private or login-restricted content.");
    }

    let media = [];

    // Method 1: Advanced - Find JSON blob in any script tag
    try {
      const scripts = html.match(/<script type="text\/javascript">(.*?)<\/script>/g) || [];
      const dataScript = scripts.find(s => s.includes('shortcode_media'));
      if (dataScript) {
        const jsonMatch = dataScript.match(/{.*}/s);
        if (jsonMatch && jsonMatch[0]) {
          const jsonData = JSON.parse(jsonMatch[0]);
          const postData = findKey(jsonData, 'shortcode_media');
          if (postData) media = extractMediaFromPostData(postData);
        }
      }
    } catch (e) { console.log('Advanced JSON parsing failed:', e.message); }

    // Method 2: JSON-LD
    if (media.length === 0) {
      try {
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
        if (jsonLdMatch && jsonLdMatch[1]) {
          const jsonLd = JSON.parse(jsonLdMatch[1]);
          const contentUrl = (jsonLd.video && jsonLd.video.contentUrl) || (jsonLd.image && jsonLd.image.contentUrl) || jsonLd.contentUrl;
          if (contentUrl) {
            const type = (jsonLd['@type'] === 'VideoObject' || (jsonLd.video && jsonLd.video['@type'] === 'VideoObject')) ? 'video' : 'image';
            media.push({ type, url: contentUrl });
          }
        }
      } catch (e) { console.log('JSON-LD parsing failed:', e.message); }
    }

    // Method 3: `_sharedData` object
    if (media.length === 0) {
      try {
        const sharedDataMatch = html.match(/<script type="text\/javascript">window\._sharedData = (.*?);<\/script>/);
        if (sharedDataMatch && sharedDataMatch[1]) {
          const jsonData = JSON.parse(sharedDataMatch[1]);
          const postData = jsonData.entry_data.PostPage[0].graphql.shortcode_media;
          media = extractMediaFromPostData(postData);
        }
      } catch (e) { console.log('_sharedData parsing failed:', e.message); }
    }

    // Method 4: Meta tags
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
      res.status(404).json({ error: 'Could not find any media in the post. The account might be private, the link invalid, or the post format is not supported by this tool.' });
    }
  } catch (error) {
    console.error('Error fetching Instagram media:', error);
    res.status(500).json({ error: `An error occurred: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
