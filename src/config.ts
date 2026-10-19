export const categories = [
    { id: 'outdoors', name: 'Get outside', short: 'Outdoors', icon: 'mountain', description: 'Trails, rivers, powder days, and a little fresh air.', metaDescription: 'Explore hiking, biking, skiing, river trips, and outdoor activities around Victor and Driggs, Idaho. Find places and source links for your next day out.' },
    { id: 'food-drink', name: 'Eat & drink', short: 'Food & drink', icon: 'coffee', description: 'Your first coffee, your next favorite table.', metaDescription: 'Find restaurants, coffee shops, breweries, and places to eat in Victor, Driggs, and Teton Valley, Idaho. Browse local listings and links to plan a stop.' },
    { id: 'arts-culture', name: 'Arts & events', short: 'Arts & culture', icon: 'sun', description: 'Music, makers, and the people who bring the valley together.', metaDescription: 'Discover galleries, museums, music venues, and community arts around Victor and Driggs, Idaho. Explore local culture with source-linked listings.' },
    { id: 'shopping', name: 'Shop local', short: 'Shopping', icon: 'bag', description: 'Independent shops and mountain-town essentials.', metaDescription: 'Browse shops in Victor and Driggs, Idaho, from outdoor gear and gifts to books and everyday essentials. Find local stores and links for your visit.' },
    { id: 'wellness', name: 'Feel good', short: 'Wellness', icon: 'flower', description: 'Make a little room to move, recover, and recharge.', metaDescription: 'Find gyms, yoga studios, spas, and health and wellness services in Victor and Driggs, Idaho. Browse local listings and follow links to providers.' },
    { id: 'stays', name: 'Stay awhile', short: 'Places to stay', icon: 'home', description: 'Find your base for exploring the valley.', metaDescription: 'Explore hotels, lodges, cabins, and places to stay in Victor, Driggs, and Teton Valley, Idaho. Find a base for your visit with links to lodging providers.' },
    { id: 'services', name: 'Local life', short: 'Local services', icon: 'pin', description: 'The practical side of life in Victor and Driggs.', metaDescription: 'Find local services, community organizations, banking, and real estate resources in Victor, Driggs, and Teton Valley, Idaho. Browse the local directory.' },
] as const;
export const seasons = ['spring', 'summer', 'fall', 'winter'] as const;
export const towns = ['Victor', 'Driggs', 'Teton Valley', 'Nearby'] as const;
export const siteName = 'Teton County';
export const isDevelopment = process.env.PUBLIC_SITE_ENV === 'development';
export const siteUrl = (process.env.SITE_URL || 'https://tetoncounty.us').replace(/\/$/, '');
export const reviewedDate = '2026-10-18';
