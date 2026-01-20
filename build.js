const https = require('https');
const { parseStringPromise } = require('xml2js');
const fs = require('fs');
const path = require('path');

const FEED_URL = 'https://pixelfed.social/users/eleanorkonik.atom';

async function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function smartTypography(text) {
  if (typeof text !== 'string') return '';

  // Em dashes: -- becomes —
  text = text.replace(/ -- /g, ' \u2014 ');
  text = text.replace(/--/g, '\u2014');

  // Smart double quotes
  // Opening quote: after space, newline, or start of string
  text = text.replace(/(^|[\s(\[{])"/g, '$1\u201c');
  // Closing quote: before space, punctuation, newline, or end
  text = text.replace(/"([\s.,;:!?\)\]}]|$)/g, '\u201d$1');
  // Any remaining straight double quotes become closing
  text = text.replace(/"/g, '\u201d');

  // Smart single quotes / apostrophes
  // Opening single quote: after space, newline, or start
  text = text.replace(/(^|[\s(\[{])'/g, '$1\u2018');
  // Apostrophes and closing quotes
  text = text.replace(/'/g, '\u2019');

  return text;
}

function extractText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node._ === 'string') return node._;
  if (typeof node === 'object') {
    if (node.$t) return node.$t;
    if (node.content) return node.content;
  }
  return '';
}

// Add links to specific terms in footnotes
function addFootnoteLinks(text) {
  // Links to add (text is already HTML-escaped and smart-quoted at this point)
  const links = [
    { term: 'Minor Mage', url: 'https://amzn.to/4bBWxD9' },
    { term: '\u201cideal city\u201d', url: 'https://acoup.blog/2019/07/12/collections-the-lonely-city-part-i-the-ideal-city/' }
  ];

  for (const link of links) {
    text = text.replace(link.term, `<a href="${link.url}" target="_blank" rel="noopener">${link.term}</a>`);
  }
  return text;
}

function formatCaption(text) {
  if (!text) return '';

  // Extract footnote definitions: [FN1] at start of line followed by text until next [FN or end
  const footnotes = {};
  const fnDefPattern = /\[FN\s*(\d+)\]\s*([^\[]+?)(?=\[FN\s*\d+\]|$)/g;
  let match;

  // Find footnote definitions (usually at the end of the text)
  const lines = text.split('\n');
  let mainText = [];
  let inFootnotes = false;

  for (const line of lines) {
    const fnMatch = line.match(/^\[FN\s*(\d+)\]\s*(.+)$/);
    if (fnMatch) {
      inFootnotes = true;
      footnotes[fnMatch[1]] = fnMatch[2].trim();
    } else if (inFootnotes && line.trim() && !line.match(/^\[FN/)) {
      // Continuation of previous footnote
      const lastKey = Object.keys(footnotes).pop();
      if (lastKey) {
        footnotes[lastKey] += ' ' + line.trim();
      }
    } else if (!inFootnotes) {
      mainText.push(line);
    }
  }

  // Apply smart typography then escape
  let formatted = escapeHtml(smartTypography(mainText.join('\n')));

  // Replace inline [FN#] references with hover tooltips
  formatted = formatted.replace(/\[FN\s*(\d+)\]/g, (match, num) => {
    let footnoteText = footnotes[num] ? escapeHtml(smartTypography(footnotes[num])) : '';
    // Add links to specific terms in footnotes
    footnoteText = addFootnoteLinks(footnoteText);
    if (footnoteText) {
      return `<span class="footnote-ref" tabindex="0"><sup>${num}</sup><span class="footnote-tooltip">${footnoteText}</span></span>`;
    }
    return `<sup class="footnote-ref">${num}</sup>`;
  });

  // Convert line breaks to <br> tags
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

// Get first sentence or first 100 chars for hover preview
function getPreview(text) {
  if (!text) return '';
  const plain = text.replace(/\[FN\s*\d+\]/g, '').trim();
  const firstSentence = plain.split(/[.!?]/)[0];
  if (firstSentence.length > 120) {
    return escapeHtml(smartTypography(firstSentence.substring(0, 117) + '...'));
  }
  return escapeHtml(smartTypography(firstSentence + (plain.length > firstSentence.length ? '...' : '')));
}

// Text replacements for RSS feed entries (applied before processing)
const TEXT_REPLACEMENTS = [
  { from: /^Dogs --/, to: '...dogs --' }
];

function applyTextReplacements(text) {
  for (const replacement of TEXT_REPLACEMENTS) {
    text = text.replace(replacement.from, replacement.to);
  }
  return text;
}

// Posts missing from RSS feed - added manually (oldest first)
const MANUAL_ENTRIES = [
  {
    imageUrl: 'https://pxscdn.com/public/m/_v2/372424658891954694/c19ce1b25-2f8843/fJKRz3VJEKXn/ibb5DAEsB7mv3x4ghcRfEdvd7H07alMNniL1Honj.png',
    title: `Behemoths live primarily among the stars, but like frogs and water, their young need soil to gestate and grow. Humankind discovered the behemoth when a seed slammed to ground and destroyed a sacred grove back on our home planet. After a war or two, our two species entered into symbiosis with one another. Humans protected the seeds, learned to commune with the juvenile, and joined the youngling in the stars. For thousands of years, we have journeyed from star to star with the behemoth spawn they have succored, and in the process, colonized unknowable planets.

My great, great, great grandmother bred dogs in the belly of such a beast. I'll never see one.`,
    postUrl: 'https://pixelfed.social/p/eleanorkonik/910743161584559284'
  },
  {
    imageUrl: 'https://pxscdn.com/public/m/_v2/372424658891954694/c19ce1b25-2f8843/BskuLA20NGMl/baIgpROKkn0iAeBKRxIHJGQVcINDGTImV2WOE2kG.png',
    title: `When a Behemoth launches itself into the stars, it takes with it a breeding population of humans, which live inside the belly of the beast, getting all their nutrients and air from inside the cavern, until it finds a mate. Then, the male Behemoth carves a nest in the soil while the female feeds on the nearby star. She plants the seed, the male fertilizes it, and each disgorges a portion of their human population to serve as caretakers for the seed, leaving them free to roam the stars once more.

Then, the humans spend long years scouting, and building, and negotiating a new hierarchy and social order. Often, there are external threats that need to be dealt with -- just the thing for forging a united population.

On the tallest mountain on the planet known as Pieran, there stands a small observation tower built of wood, and from it, one can see...`,
    postUrl: 'https://pixelfed.social/p/eleanorkonik/910738205739311234'
  }
];

async function build() {
  console.log('Fetching Atom feed...');
  const xml = await fetchFeed(FEED_URL);

  console.log('Parsing feed...');
  const result = await parseStringPromise(xml, {
    explicitArray: false,
    tagNameProcessors: [(name) => name.replace(':', '_')]
  });

  const feed = result.feed;
  let entries = feed.entry;

  if (!Array.isArray(entries)) {
    entries = entries ? [entries] : [];
  }

  console.log(`Found ${entries.length} entries from feed, plus ${MANUAL_ENTRIES.length} manual entries`);

  // Reverse to show oldest first (chronological order for reading)
  entries.reverse();

  // Build HTML for grid items and lightbox slides
  const gridItems = [];
  const lightboxSlides = [];

  // Helper to add an entry (works for both manual and feed entries)
  function addEntry(imageUrl, title, postLink, index) {
    const preview = getPreview(title);
    const formattedCaption = formatCaption(title);

    // Grid thumbnail
    gridItems.push(`
      <div class="grid-item" data-index="${index}">
        <img src="${escapeHtml(imageUrl)}" alt="" loading="lazy">
        <div class="hover-caption">${preview}</div>
      </div>`);

    // Lightbox slide
    lightboxSlides.push(`
      <div class="slide" data-index="${index}" data-post-url="${escapeHtml(postLink)}">
        <img src="${escapeHtml(imageUrl)}" alt="">
        <div class="caption-panel">
          <div class="caption-text">${formattedCaption}</div>
        </div>
      </div>`);
  }

  let currentIndex = 0;

  // Add manual entries first (these are the oldest, missing from RSS)
  for (const entry of MANUAL_ENTRIES) {
    addEntry(entry.imageUrl, entry.title, entry.postUrl, currentIndex);
    currentIndex++;
  }

  // Add feed entries
  for (const entry of entries) {
    // Image is in media_content
    const imageUrl = entry.media_content?.$?.url || '';

    // Post URL is in link
    const link = entry.link;
    const postUrl = link?.$?.href || '';

    const title = applyTextReplacements(extractText(entry.title));

    if (imageUrl) {
      addEntry(imageUrl, title, postUrl, currentIndex);
      currentIndex++;
    }
  }

  const totalEntries = currentIndex;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maven & the Border Lord by Eleanor Konik</title>
  <link rel="stylesheet" href="style.css">
  <link rel="icon" href="horse_logo.webp" type="image/webp">
</head>
<body>
  <header>
    <img src="horse_logo.webp" alt="Horse logo" class="logo">
    <h1>Maven & the Border Lord</h1>
    <p class="subtitle">by Eleanor Konik</p>
  </header>

  <main>
    <div class="grid">
      ${gridItems.join('\n')}
    </div>
  </main>

  <div id="lightbox" class="lightbox">
    <div class="lightbox-controls">
      <button class="nav-btn first" aria-label="First" title="First (Home)">&laquo;</button>
      <button class="nav-btn prev" aria-label="Previous" title="Previous (&larr;)">&lsaquo;</button>
      <span class="slide-counter"><span id="current-num">1</span> / ${totalEntries}</span>
      <button class="nav-btn next" aria-label="Next" title="Next (&rarr;)">&rsaquo;</button>
      <button class="nav-btn last" aria-label="Last" title="Last (End)">&raquo;</button>
      <a id="comment-link" class="nav-btn" href="#" target="_blank" rel="noopener" aria-label="Comment on Pixelfed" title="Comment on Pixelfed"><svg viewBox="0 0 512 512" width="18" height="18" fill="currentColor"><path d="M123.6 391.3c12.9-9.4 29.6-11.8 44.6-6.4c26.5 9.6 56.2 15.1 87.8 15.1c124.7 0 208-80.5 208-160s-83.3-160-208-160S48 160.5 48 240c0 32 12.4 62.8 35.7 89.2c8.6 9.7 12.8 22.5 11.8 35.5c-1.4 18.1-5.7 34.7-11.3 49.4c17-7.9 31.1-16.7 39.4-22.7zM21.2 431.9c1.8-2.7 3.5-5.4 5.1-8.1c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208s-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6c-15.1 6.6-32.3 12.6-50.1 16.1c-.8 .2-1.6 .3-2.4 .5c-4.4 .8-8.7 1.5-13.2 1.9c-.2 0-.5 .1-.7 .1c-5.1 .5-10.2 .8-15.3 .8c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4c4.1-4.2 7.8-8.7 11.3-13.5c1.7-2.3 3.3-4.6 4.8-6.9z"/></svg></a>
      <button class="close-btn" aria-label="Close" title="Close (Esc)">&times;</button>
    </div>
    <div class="slides-container">
      ${lightboxSlides.join('\n')}
    </div>
    <div class="lightbox-footer">
      For more information about how and why this story was written, check out <a href="https://www.eleanorkonik.com/p/toy-problems-make-economics-easier" target="_blank" rel="noopener">Manuscriptions</a> on Substack. For updates to the story itself, there's always <a href="https://pixelfed.social/users/eleanorkonik.atom" target="_blank" rel="noopener">RSS</a>.
    </div>
  </div>

  <footer>
    <p>For more information about how and why this story was written, check out <a href="https://www.eleanorkonik.com/p/toy-problems-make-economics-easier" target="_blank" rel="noopener">Manuscriptions</a> on Substack. For updates to the story itself, there's always <a href="https://pixelfed.social/users/eleanorkonik.atom" target="_blank" rel="noopener">RSS</a>.</p>
    <p class="copyright">&copy; Eleanor Konik</p>
  </footer>

  <script>
    const lightbox = document.getElementById('lightbox');
    const slides = document.querySelectorAll('.slide');
    const gridItems = document.querySelectorAll('.grid-item');
    let currentIndex = 0;

    const counter = document.getElementById('current-num');
    const commentLink = document.getElementById('comment-link');

    function showSlide(index) {
      slides.forEach(s => s.classList.remove('active'));
      slides[index].classList.add('active');
      currentIndex = index;
      counter.textContent = index + 1;
      commentLink.href = slides[index].dataset.postUrl;
    }

    function openLightbox(index) {
      showSlide(index);
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }

    function nextSlide() {
      showSlide((currentIndex + 1) % slides.length);
    }

    function prevSlide() {
      showSlide((currentIndex - 1 + slides.length) % slides.length);
    }

    function firstSlide() {
      showSlide(0);
    }

    function lastSlide() {
      showSlide(slides.length - 1);
    }

    // Grid click handlers
    gridItems.forEach(item => {
      item.addEventListener('click', () => {
        openLightbox(parseInt(item.dataset.index));
      });
    });

    // Lightbox controls
    document.querySelector('.close-btn').addEventListener('click', closeLightbox);
    document.querySelector('.nav-btn.next').addEventListener('click', nextSlide);
    document.querySelector('.nav-btn.prev').addEventListener('click', prevSlide);
    document.querySelector('.nav-btn.first').addEventListener('click', firstSlide);
    document.querySelector('.nav-btn.last').addEventListener('click', lastSlide);

    // Click outside to close
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Home') { e.preventDefault(); firstSlide(); }
      if (e.key === 'End') { e.preventDefault(); lastSlide(); }
    });

    // Touch swipe support
    let touchStartX = 0;
    lightbox.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    });
    lightbox.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? nextSlide() : prevSlide();
      }
    });
  </script>
</body>
</html>`;

  const outputPath = path.join(__dirname, 'index.html');
  fs.writeFileSync(outputPath, html);
  console.log(`Generated ${outputPath}`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
