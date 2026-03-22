'use strict';
require('dotenv').config();
const db = require('./src/config/database');

async function seed() {
    const products = [
        { name:'Prestige Saxony', category_slug:'carpets', price:24.99, badge:'Best Seller', badge_type:'seller', img_url:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=80', description:'A luxuriously deep-pile saxony carpet that transforms any bedroom or lounge into a sanctuary of comfort.', rooms:'["living","bedroom"]', durability:3, softness:5, is_featured:1, is_deal:0, stock_level:50 },
        { name:'Heritage Twist', category_slug:'carpets', price:18.50, original_price:24.00, badge:'Sale', badge_type:'sale', img_url:'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=700&q=80', description:'A classic tightly-twisted carpet engineered for high-traffic zones.', rooms:'["living","bedroom","hallway","stairs"]', durability:5, softness:3, is_featured:0, is_deal:1, stock_level:35 },
        { name:'Velvet Cloud Plus', category_slug:'carpets', price:34.99, badge:'Premium', badge_type:'premium', img_url:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=700&q=80', description:'Our finest velvet-cut pile carpet. Exceptional softness with a rich lustre.', rooms:'["bedroom","living"]', durability:2, softness:5, is_featured:0, is_deal:0, stock_level:20 },
        { name:'Berber Loop', category_slug:'carpets', price:14.99, img_url:'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=700&q=80', description:'A natural loop-pile berber offering superior durability at a budget-friendly price point.', rooms:'["hallway","stairs","bedroom"]', durability:5, softness:2, is_featured:0, is_deal:0, stock_level:80 },
        { name:'Distinction Twist', category_slug:'carpets', price:22.00, badge:'New In', badge_type:'new', img_url:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=80', description:'A premium twist pile with outstanding durability and a contemporary look.', rooms:'["living","hallway","stairs"]', durability:4, softness:3, is_featured:0, is_deal:0, stock_level:45 },
        { name:'Stone Clic Pro', category_slug:'vinyl', price:28.99, badge:'Best Seller', badge_type:'seller', img_url:'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=700&q=80', description:'100% waterproof rigid-core LVT with a realistic stone effect. Perfect for kitchens and bathrooms.', rooms:'["kitchen","bathroom","hallway"]', durability:5, softness:2, is_featured:1, is_deal:0, stock_level:60 },
        { name:'Nordic Oak LVT', category_slug:'vinyl', price:26.50, img_url:'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=700&q=80', description:'A warm Scandinavian oak effect luxury vinyl tile with a 0.55mm wear layer.', rooms:'["living","kitchen","hallway"]', durability:5, softness:2, is_featured:0, is_deal:0, stock_level:55 },
        { name:'Herringbone Click', category_slug:'vinyl', price:32.99, badge:'Premium', badge_type:'premium', img_url:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=700&q=80', description:'Designer herringbone pattern LVT. Makes a bold statement in any room.', rooms:'["living","hallway"]', durability:4, softness:2, is_featured:0, is_deal:0, stock_level:30 },
        { name:'Aqua Shield', category_slug:'vinyl', price:19.99, original_price:25.99, badge:'Sale', badge_type:'sale', img_url:'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=700&q=80', description:'Entry-level waterproof vinyl perfect for bathrooms and utility rooms.', rooms:'["bathroom","kitchen"]', durability:4, softness:1, is_featured:0, is_deal:1, stock_level:90 },
        { name:'Classic Oak 8mm', category_slug:'laminate', price:16.99, badge:'Best Seller', badge_type:'seller', img_url:'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=700&q=80', description:'A timeless oak-effect laminate with AC4 wear rating. Suitable for most domestic areas.', rooms:'["living","bedroom","hallway"]', durability:4, softness:2, is_featured:1, is_deal:0, stock_level:100 },
        { name:'Grey Concrete 12mm', category_slug:'laminate', price:21.99, badge:'New In', badge_type:'new', img_url:'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=700&q=80', description:'On-trend concrete-effect laminate with a thick 12mm board for a premium underfoot feel.', rooms:'["living","hallway"]', durability:4, softness:2, is_featured:0, is_deal:0, stock_level:40 },
        { name:'Farmhouse Plank', category_slug:'laminate', price:18.50, img_url:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=80', description:'Wide-plank rustic-look laminate evoking a classic farmhouse aesthetic.', rooms:'["living","bedroom"]', durability:3, softness:2, is_featured:0, is_deal:0, stock_level:60 },
        { name:'Engineered Oak Natural', category_slug:'wood', price:54.99, badge:'Premium', badge_type:'premium', img_url:'https://images.unsplash.com/photo-1541123437800-1bb1317badc2?auto=format&fit=crop&w=700&q=80', description:'Genuine engineered oak with a 4mm top layer. Can be sanded and refinished up to three times.', rooms:'["living","bedroom"]', durability:4, softness:3, is_featured:1, is_deal:0, stock_level:25 },
        { name:'Smoked Walnut', category_slug:'wood', price:64.99, img_url:'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=700&q=80', description:'Rich smoked walnut engineered wood flooring. A statement floor for discerning interiors.', rooms:'["living","bedroom"]', durability:3, softness:3, is_featured:0, is_deal:0, stock_level:15 },
        { name:'Herringbone Oak', category_slug:'wood', price:72.99, badge:'New In', badge_type:'new', img_url:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=700&q=80', description:'Classic herringbone pattern in engineered oak. Timeless elegance for period and contemporary homes.', rooms:'["living"]', durability:4, softness:3, is_featured:0, is_deal:0, stock_level:10 },
    ];

    let added = 0;
    for (const p of products) {
        try {
            await db.prepare(`
                INSERT INTO products (name,category_slug,price,original_price,badge,badge_type,
                    img_url,description,rooms,durability,softness,is_featured,is_deal,is_active,stock_level)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)
                ON CONFLICT DO NOTHING
            `).run(
                p.name, p.category_slug, p.price, p.original_price||null,
                p.badge||null, p.badge_type||null, p.img_url||null, p.description||null,
                p.rooms||'[]', p.durability||3, p.softness||3,
                p.is_featured||0, p.is_deal||0, p.stock_level||0
            );
            added++;
            console.log(`✓ ${p.name}`);
        } catch(e) {
            console.error(`✗ ${p.name}: ${e.message}`);
        }
    }
    console.log(`\nDone — ${added} products seeded`);
    process.exit(0);
}

seed();
