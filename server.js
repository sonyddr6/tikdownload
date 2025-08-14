const express = require('express');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

// --- Helper Functions ---

// Helper for __a=1 JSON API data
function extractMediaFromApiJson(data) {
  const media = [];
  if (!data || !data.items || data.items.length === 0) return media;
  const post = data.items[0];

  if (post.carousel_media) { // Carousel
    post.carousel_media.forEach(item => {
      if (item.video_versions && item.video_versions.length > 0) {
        media.push({ type: 'video', url: item.video_versions[0].url });
      } else if (item.image_versions2 && item.image_versions2.candidates.length > 0) {
        media.push({ type: 'image', url: item.image_versions2.candidates[0].url });
      }
    });
  } else if (post.video_versions && post.video_versions.length > 0) { // Video
    media.push({ type: 'video', url: post.video_versions[0].url });
  } else if (post.image_versions2 && post.image_versions2.candidates.length > 0) { // Image
    media.push({ type: 'image', url: post.image_versions2.candidates[0].url });
  }
  return media;
}

// Helper for embedded HTML JSON data
function extractMediaFromHtmlJson(postData) {
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

// Helper to find a key recursively
function findKey(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  if (key in obj) return obj[key];
  for (const k in obj) {
    const found = findKey(obj[k], key);
    if (found) return found;
  }
  return null;
}


// --- Main Endpoint ---

app.post('/getMedia', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  let media = [];
  const cleanUrl = url.split('?')[0];

  // --- Scraping Waterfall ---

  // Method 1: Try the `__a=1` JSON endpoint (most reliable if not blocked)
  try {
    const apiUrl = `${cleanUrl}?__a=1&__d=dis`;
    const response = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
    if (response.ok) {
      const data = await response.json();
      media = extractMediaFromApiJson(data);
    }
  } catch (e) { console.log('__a=1 API endpoint method failed:', e.message); }

  // Method 2: Fallback to HTML scraping if the API method fails
  if (media.length === 0) {
    console.log('Falling back to HTML scraping methods...');
    try {
      const response = await fetch(cleanUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
      if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
      const html = await response.text();

      if (html.includes("Log in to Instagram")) throw new Error("Instagram requires login to view this post.");

      // Method 2a: Advanced HTML JSON blob search
      try {
        const scripts = html.match(/<script type="text\/javascript">(.*?)<\/script>/g) || [];
        const dataScript = scripts.find(s => s.includes('shortcode_media'));
        if (dataScript) {
          const jsonMatch = dataScript.match(/{.*}/s);
          if (jsonMatch && jsonMatch[0]) {
            const jsonData = JSON.parse(jsonMatch[0]);
            const postData = findKey(jsonData, 'shortcode_media');
            if (postData) media = extractMediaFromHtmlJson(postData);
          }
        }
      } catch (e) { console.log('Advanced HTML JSON parsing failed:', e.message); }

      // Method 2b: JSON-LD
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

      // Method 2c: `_sharedData` object
      if (media.length === 0) {
        try {
          const sharedDataMatch = html.match(/<script type="text\/javascript">window\._sharedData = (.*?);<\/script>/);
          if (sharedDataMatch && sharedDataMatch[1]) {
            const jsonData = JSON.parse(sharedDataMatch[1]);
            const postData = jsonData.entry_data.PostPage[0].graphql.shortcode_media;
            media = extractMediaFromHtmlJson(postData);
          }
        } catch (e) { console.log('_sharedData parsing failed:', e.message); }
      }

      // Method 2d: Meta tags
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
    } catch (error) {
      console.error('HTML scraping failed:', error);
      return res.status(500).json({ error: `An error occurred: ${error.message}` });
    }
  }

  if (media.length > 0) {
    res.json({ media });
  } else {
    res.status(404).json({ error: 'Could not find any media. The post may be private, invalid, or the format is not supported.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
