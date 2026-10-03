// arcane-experiences.js
// The portal's experiences: titles, copy, routes and accent colours. Shared by
// the dashboard hub (arcane-hub.js) and the banner every page gets from
// portal-shell.js, so a section reads the same wherever it appears.

/* ── The experiences (copy and routes from the existing portal) ── */
export const EXP = {
  'courses':        { title: 'The Vault',     cat: 'The Archives',  desc: '46+ protocols across four realms. Start with Escaping Hell.', href: 'courses.html', accent: '#F2C94C', cta: 'Enter the Vault', chip: { text: '3,330+ modules' }, members: true },
  'war-room':       { title: 'War Room',      cat: 'Every week',    desc: 'The live call with Leo, recordings and briefings.', href: 'war-room.html', accent: '#F0553F', cta: 'Enter the War Room', members: true },
  'trading-floor':  { title: 'Trading Floor', cat: 'Markets',       desc: 'Live charts, your watchlist and the lessons side by side.', href: 'trading-floor.html', accent: '#4ADE80', cta: 'Enter the Floor', chip: { text: 'Live markets', live: true }, members: true },
  'watchtower':     { title: 'Watchtower',    cat: 'Intelligence',  desc: 'The whole world on one screen: flashpoints, briefs, forecasts.', href: '/watchtower/', accent: '#22D3EE', cta: 'Open the Watchtower', chip: { text: 'Live intel', live: true }, members: true },
  'stock-picks':    { title: 'Stock Picks',   cat: 'Markets',       desc: 'Curated long-term positions with the thesis behind each.', href: 'stock-picks.html', accent: '#34D399', cta: 'View the picks', members: true },
  'live-calls':     { title: 'Live Calls',    cat: 'Community',     desc: 'Weekly group sessions, Q&A and 1:1 time with Leo.', href: 'live-calls.html', accent: '#67E8F9', cta: 'Join Live Calls', members: true },
  'arcane-insights':{ title: 'Daily Insight', cat: 'Every morning', desc: 'Whatever Leo’s learning today. Keep the streak alive.', href: 'arcane-insights.html', accent: '#F2C94C' },
  'free-signals':   { title: 'Signals',       cat: 'Markets',       desc: 'Starter access via Vantage.', href: 'free-signals.html', accent: '#9B7BF7' },
  'bullion':        { title: 'Bullion',       cat: 'Markets',       desc: 'Physical gold and silver.', href: 'bullion.html', accent: '#F2C94C' },
  'live-streams':   { title: 'Live Streams',  cat: 'Open to everyone', desc: 'Friday 7pm UK, open to everyone.', href: 'live-streams.html', accent: '#F87171' },
  'referrals':      { title: 'Referrals',     cat: 'Members',       desc: 'Your link, referred members and rewards.', href: 'referrals.html', accent: '#9B7BF7' },
  'arcane-store':   { title: 'The Store',     cat: 'Members',       desc: 'Caps, keyrings, notebooks and more.', href: 'arcane-store.html', accent: '#F2C94C' },
  'settings':       { title: 'Settings',      cat: 'Account',       desc: 'Your profile, card name and account.', href: 'settings.html', accent: '#9B7BF7' },
  'retreat':        { title: '2028 Retreat',  cat: 'Coming soon',   desc: 'Details to be announced.', href: 'retreat.html', accent: '#60A5FA' },
};
export const FEATURED  = ['courses', 'war-room', 'trading-floor', 'watchtower', 'stock-picks', 'live-calls'];
export const SECONDARY = ['arcane-insights', 'free-signals', 'bullion', 'live-streams'];
export const MEMBER    = ['referrals', 'arcane-store', 'settings', 'retreat'];
export const ADMIN = [
  ['admin-panel.html', 'Admin Panel', 'Trades, alerts & signals'],
  ['arcane-crm.html', 'Member CRM', 'Members & subscriptions'],
  ['arcane-consulting-crm.html', 'Consulting CRM', 'Leads, pipeline & payments'],
  ['affiliate-admin.html', 'Affiliates', 'Referrals & commissions'],
  ['stock-picks-admin.html', 'Stock Picks', 'Manage investment picks'],
  ['arcane-insight-admin.html', 'Arcane Insights', 'Posts & intel updates'],
  ['store-admin.html', 'Store Admin', 'Products & orders'],
  ['bullion-admin.html', 'Bullion Admin', 'Products & enquiries'],
];
