/* NyumbaLink starter. Data is saved in the browser (localStorage), so no backend is needed yet. */

// ===== Helpers =====
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const money = n => 'KES ' + Number(n).toLocaleString('en-KE');
const fmtDate = d => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
const bedLabel = n => (Number(n) === 0 ? 'Bedsitter' : n + (Number(n) === 3 ? '+ bedrooms' : Number(n) === 1 ? ' bedroom' : ' bedrooms'));

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

// ===== State (with starter data so the pages are not empty) =====
const state = {
  user: store.get('nl_user', null),
  listings: store.get('nl_listings', [
    { id: 'l1', title: 'Bright 2 bedroom in Kasarani', location: 'Kasarani, Nairobi', rent: 14000, beds: 2, amenities: ['Water', 'Parking'], contact: '0700 000 001', description: 'Quiet compound, tiled floors, close to the matatu stage.', image: '', available: true, owner: 'Demo Landlord', date: '2026-11-01' },
    { id: 'l2', title: 'Affordable bedsitter near campus', location: 'Juja, Kiambu', rent: 4500, beds: 0, amenities: ['Water', 'WiFi'], contact: 'juja@example.com', description: 'Self-contained, 5 minutes walk from the university gate.', image: '', available: true, owner: 'Demo Agent', date: '2026-11-08' },
    { id: 'l3', title: 'Family 3 bedroom maisonette', location: 'Ruaka, Kiambu', rent: 32000, beds: 3, amenities: ['Parking', 'Security', 'Garden'], contact: '0700 000 003', description: 'Gated estate with 24-hour security and a small garden.', image: '', available: false, owner: 'Demo Landlord', date: '2026-10-20' }
  ]),
  reviews: store.get('nl_reviews', []),
  posts: store.get('nl_posts', [
    { id: 'p1', type: 'Question', author: 'Amani', text: 'How is the water supply in Ruaka during the dry season?', date: '2026-11-12', comments: [{ author: 'Wanjiru', text: 'Water comes 3 days a week, so get a tank.', date: '2026-11-13' }] }
  ])
};
const save = () => {
  store.set('nl_listings', state.listings);
  store.set('nl_reviews', state.reviews);
  store.set('nl_posts', state.posts);
  store.set('nl_user', state.user);
};
const currentName = () => (state.user ? state.user.name : 'Guest');

// ===== Navigation / simple router (Moraa) =====
function route() {
  const pages = ['home', 'listings', 'community', 'profile'];
  const id = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  pages.forEach(p => { $('#' + p).hidden = p !== id; });
  $$('nav a').forEach(a => {
    if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

// ===== Ratings =====
const RATING_KEYS = [['water', 'Water availability'], ['security', 'Security'], ['condition', 'Property condition'], ['affordability', 'Affordability']];
function avgRating(listingId) {
  const rs = state.reviews.filter(r => r.listingId === listingId && !r.reported);
  if (!rs.length) return null;
  const total = rs.reduce((sum, r) => sum + RATING_KEYS.reduce((s, [k]) => s + Number(r.ratings[k]), 0) / RATING_KEYS.length, 0);
  return (total / rs.length).toFixed(1);
}

// ===== Search, filters and listing cards (Carlos, Stacy) =====
function renderListings() {
  const q = $('#f-q').value.trim().toLowerCase();
  const maxRent = Number($('#f-rent').value) || Infinity;
  const beds = $('#f-beds').value;
  const sort = $('#f-sort').value;

  let list = state.listings.filter(l =>
    (l.title + ' ' + l.location).toLowerCase().includes(q) &&
    Number(l.rent) <= maxRent &&
    (beds === '' || (beds === '3' ? Number(l.beds) >= 3 : Number(l.beds) === Number(beds)))
  );
  if (sort === 'low') list.sort((a, b) => a.rent - b.rent);
  else if (sort === 'high') list.sort((a, b) => b.rent - a.rent);
  else list.sort((a, b) => new Date(b.date) - new Date(a.date));

  $('#no-results').hidden = list.length > 0;
  $('#listing-grid').innerHTML = list.map(l => {
    const avg = avgRating(l.id);
    const mine = state.user && state.user.name === l.owner;
    return `
    <article class="card listing">
      ${l.image ? `<img src="${l.image}" alt="${esc(l.title)}">` : '<div class="photo-fallback">No photo yet</div>'}
      <span class="badge ${l.available ? '' : 'taken'}">${l.available ? 'Available' : 'Taken'}</span>
      <h3>${esc(l.title)}</h3>
      <p class="price">${money(l.rent)} / month</p>
      <p class="meta">${esc(l.location)} · ${bedLabel(l.beds)}${avg ? ` · <span class="stars">★ ${avg}</span>` : ''}</p>
      <div class="chips">${l.amenities.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>
      <div class="row">
        <button class="btn btn-small" data-action="details" data-id="${l.id}">View details</button>
        ${mine ? `<button class="btn btn-small btn-soft" data-action="toggle" data-id="${l.id}">Mark as ${l.available ? 'taken' : 'available'}</button>` : ''}
      </div>
    </article>`;
  }).join('');
}

// Shrink uploaded photos so they fit in localStorage
function resizeImage(file, maxWidth = 640) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve('');
      img.src = reader.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

async function addListing(form) {
  const f = new FormData(form);
  const file = f.get('image');
  const image = file && file.size ? await resizeImage(file) : '';
  state.listings.unshift({
    id: uid(), title: f.get('title').trim(), location: f.get('location').trim(), rent: Number(f.get('rent')),
    beds: Number(f.get('beds')), amenities: f.get('amenities').split(',').map(a => a.trim()).filter(Boolean),
    contact: f.get('contact').trim(), description: f.get('description').trim(), image,
    available: true, owner: currentName(), date: new Date().toISOString().slice(0, 10)
  });
  save(); form.reset(); form.closest('details').open = false; renderListings();
}

// ===== Property details + reviews (Antony, Stephen) =====
function openDetail(id) {
  const l = state.listings.find(x => x.id === id);
  if (!l) return;
  const rs = state.reviews.filter(r => r.listingId === id);
  const avg = avgRating(id);
  const yes = rs.filter(r => r.recommend === 'yes' && !r.reported).length;
  $('#detail-body').innerHTML = `
    ${l.image ? `<img src="${l.image}" alt="${esc(l.title)}" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px">` : ''}
    <h2>${esc(l.title)}</h2>
    <p class="price">${money(l.rent)} / month · ${l.available ? 'Available' : 'Taken'}</p>
    <p class="meta">${esc(l.location)} · ${bedLabel(l.beds)}</p>
    <p>${esc(l.description)}</p>
    <div class="chips">${l.amenities.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>
    <p><strong>Contact:</strong> ${state.user ? esc(l.contact) : 'Sign in on My profile to see contact details.'}</p>
    <h3>Reviews ${avg ? `<span class="stars">★ ${avg}</span> <small class="meta">(${yes} of ${rs.filter(r => !r.reported).length} recommend)</small>` : ''}</h3>
    ${rs.length ? rs.map(r => `
      <div class="review">
        <p><strong>${esc(r.author)}</strong> · <small>${fmtDate(r.date)}</small> · ${r.recommend === 'yes' ? 'Recommends' : 'Does not recommend'}</p>
        ${r.reported ? '<p class="meta">This review was reported and is hidden.</p>' : `
          <p class="meta">${RATING_KEYS.map(([k, label]) => `${label}: ${r.ratings[k]}/5`).join(' · ')}</p>
          <p>${esc(r.comment)}</p>
          <button class="btn btn-small btn-soft" data-action="report" data-id="${r.id}" data-listing="${l.id}">Report review</button>`}
      </div>`).join('') : '<p class="meta">No reviews yet. Be the first to share your experience.</p>'}
    <h3>Add your review</h3>
    <form id="review-form" class="stack-form" data-listing="${l.id}" style="padding:16px;margin:0">
      <div class="ratings">
        ${RATING_KEYS.map(([k, label]) => `<label>${label}<select name="${k}"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>`).join('')}
      </div>
      <label>Would you recommend it?<select name="recommend"><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label>Tell us why<textarea name="comment" rows="3" required></textarea></label>
      <button class="btn" type="submit">Submit review</button>
    </form>`;
  $('#detail').showModal();
}

function addReview(form) {
  const f = new FormData(form);
  state.reviews.push({
    id: uid(), listingId: form.dataset.listing, author: currentName(), date: new Date().toISOString(),
    ratings: Object.fromEntries(RATING_KEYS.map(([k]) => [k, f.get(k)])),
    recommend: f.get('recommend'), comment: f.get('comment').trim(), reported: false
  });
  save(); renderListings(); openDetail(form.dataset.listing);
}

// ===== Community feed (Belinda) =====
function renderFeed() {
  $('#feed').innerHTML = [...state.posts].reverse().map(p => `
    <article class="post">
      <header><span class="who">${esc(p.author)}</span><span class="chip">${esc(p.type)}</span><small class="meta">${fmtDate(p.date)}</small></header>
      <p>${esc(p.text)}</p>
      <div class="comments">
        ${p.comments.map(c => `<div class="comment"><strong>${esc(c.author)}</strong> <small>${fmtDate(c.date)}</small><br>${esc(c.text)}</div>`).join('') || '<p class="meta">No replies yet.</p>'}
        <form class="comment-form" data-post="${p.id}">
          <input name="text" required placeholder="Write a reply" aria-label="Write a reply">
          <button class="btn btn-small" type="submit">Reply</button>
        </form>
      </div>
    </article>`).join('');
}

// ===== Profile (Kevin) =====
function renderProfile() {
  const box = $('#profile-body');
  if (!state.user) {
    box.innerHTML = `
      <form id="signin-form" class="stack-form">
        <p>Create a basic profile to post houses, review properties and see contact details.</p>
        <label>Your name<input name="name" required maxlength="40"></label>
        <label>Account type
          <select name="type"><option>House hunter</option><option>Landlord / agent</option><option>Community member</option></select>
        </label>
        <button class="btn" type="submit">Create profile</button>
      </form>`;
    return;
  }
  const n = state.user.name;
  const mine = state.listings.filter(l => l.owner === n);
  box.innerHTML = `
    <div class="card" style="max-width:620px">
      <h3>${esc(n)}</h3>
      <p class="meta">${esc(state.user.type)}</p>
      <p><strong>${mine.length}</strong> listings · <strong>${state.reviews.filter(r => r.author === n).length}</strong> reviews · <strong>${state.posts.filter(p => p.author === n).length}</strong> posts</p>
      ${mine.length ? `<ul>${mine.map(l => `<li>${esc(l.title)} (${l.available ? 'Available' : 'Taken'})</li>`).join('')}</ul>` : '<p class="meta">You have not posted a house yet.</p>'}
      <button class="btn btn-soft btn-small" data-action="signout" style="align-self:flex-start">Sign out</button>
    </div>`;
}

// ===== Events =====
document.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  if (form.id === 'listing-form') await addListing(form);
  else if (form.id === 'review-form') addReview(form);
  else if (form.id === 'post-form') {
    const f = new FormData(form);
    state.posts.push({ id: uid(), type: f.get('type'), author: currentName(), text: f.get('text').trim(), date: new Date().toISOString(), comments: [] });
    save(); form.reset(); renderFeed();
  } else if (form.classList.contains('comment-form')) {
    const post = state.posts.find(p => p.id === form.dataset.post);
    post.comments.push({ author: currentName(), text: new FormData(form).get('text').trim(), date: new Date().toISOString() });
    save(); renderFeed();
  } else if (form.id === 'signin-form') {
    const f = new FormData(form);
    state.user = { name: f.get('name').trim(), type: f.get('type') };
    save(); renderProfile(); renderListings();
  }
});

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'details') openDetail(id);
  else if (action === 'close-detail') $('#detail').close();
  else if (action === 'toggle') { const l = state.listings.find(x => x.id === id); l.available = !l.available; save(); renderListings(); }
  else if (action === 'report') { state.reviews.find(r => r.id === id).reported = true; save(); renderListings(); openDetail(btn.dataset.listing); }
  else if (action === 'signout') { state.user = null; save(); renderProfile(); renderListings(); }
});

['f-q', 'f-rent', 'f-beds', 'f-sort'].forEach(id => $('#' + id).addEventListener('input', renderListings));
$('#filters').addEventListener('submit', e => e.preventDefault());
window.addEventListener('hashchange', route);

// ===== Start =====
renderListings(); renderFeed(); renderProfile(); route();
