// /formyson/ 的品牌常量与首次迁移种子。线上产品、文章以 D1 为唯一数据源。
export const BASE = '/formyson';
export const BRAND = 'LOOMWORKS';

export const productCategories = ['T-Shirts', 'Hoodies', 'Denim', 'Outerwear', 'Knitwear', 'Activewear'];

export type Product = {
  slug: string;
  name: string;
  category: string;
  summary: string;
  specs: [string, string][];
};

export const products: Product[] = [
  { slug: 'heavyweight-crew-tee', name: 'Heavyweight Crew Tee', category: 'T-Shirts', summary: '240 GSM combed cotton, boxy fit, garment dyed.', specs: [['Fabric', '100% combed cotton'], ['Weight', '240 GSM'], ['Sizes', 'XS - 3XL'], ['MOQ', '300 pcs / style']] },
  { slug: 'essential-pocket-tee', name: 'Essential Pocket Tee', category: 'T-Shirts', summary: 'Everyday ring-spun jersey with a clean patch pocket.', specs: [['Fabric', '100% ring-spun cotton'], ['Weight', '180 GSM'], ['Sizes', 'XS - 2XL'], ['MOQ', '300 pcs / style']] },
  { slug: 'fleece-pullover-hoodie', name: 'Fleece Pullover Hoodie', category: 'Hoodies', summary: 'Brushed-back fleece with double-lined hood.', specs: [['Fabric', '80% cotton / 20% poly'], ['Weight', '400 GSM'], ['Sizes', 'XS - 3XL'], ['MOQ', '200 pcs / style']] },
  { slug: 'zip-through-hoodie', name: 'Zip-Through Hoodie', category: 'Hoodies', summary: 'Metal zip, ribbed cuffs, loopback terry.', specs: [['Fabric', '100% cotton French terry'], ['Weight', '360 GSM'], ['Sizes', 'XS - 2XL'], ['MOQ', '200 pcs / style']] },
  { slug: 'straight-selvedge-jean', name: 'Straight Selvedge Jean', category: 'Denim', summary: '13.5 oz raw selvedge, cut and sewn in-house.', specs: [['Fabric', '100% cotton selvedge'], ['Weight', '13.5 oz'], ['Waist', '28 - 40'], ['MOQ', '150 pcs / style']] },
  { slug: 'chore-coat', name: 'Canvas Chore Coat', category: 'Outerwear', summary: 'Washed duck canvas with corozo buttons.', specs: [['Fabric', '100% cotton duck'], ['Weight', '12 oz'], ['Sizes', 'S - 2XL'], ['MOQ', '150 pcs / style']] },
  { slug: 'merino-crewneck', name: 'Merino Crewneck', category: 'Knitwear', summary: '12-gauge extra-fine merino, fully fashioned.', specs: [['Yarn', '100% extra-fine merino'], ['Gauge', '12 GG'], ['Sizes', 'XS - 2XL'], ['MOQ', '200 pcs / style']] },
  { slug: 'performance-short', name: 'Performance Short', category: 'Activewear', summary: 'Four-way stretch, bonded hems, zip pocket.', specs: [['Fabric', '88% nylon / 12% spandex'], ['Weight', '150 GSM'], ['Sizes', 'XS - 2XL'], ['MOQ', '300 pcs / style']] },
];

export type Article = {
  slug: string;
  title: string;
  category: string;
  date: string;
  author: string;
  excerpt: string;
};

export const articleCategories = ['Industry News', 'Craftsmanship', 'Case Studies'];

export const articles: Article[] = [
  { slug: 'why-domestic-manufacturing', title: 'Why More Brands Are Bringing Production Back to the U.S.', category: 'Industry News', date: 'Sep 12, 2026', author: 'LOOMWORKS Editorial', excerpt: 'Shorter lead times, smaller minimums and full visibility on the line are changing how emerging labels plan their seasons.' },
  { slug: 'reading-a-fabric-spec', title: 'How to Read a Fabric Spec Sheet Like a Pattern Maker', category: 'Craftsmanship', date: 'Aug 28, 2026', author: 'Design Team', excerpt: 'GSM, gauge, shrinkage and hand feel: a practical guide to the numbers that decide how a garment wears.' },
  { slug: 'case-study-capsule-launch', title: 'From Sketch to Shelf in 9 Weeks: A Capsule Launch', category: 'Case Studies', date: 'Aug 03, 2026', author: 'Production Team', excerpt: 'How a Los Angeles streetwear label took a 6-piece capsule from first sketch to retail with one partner.' },
  { slug: 'garment-dye-explained', title: 'Garment Dye vs. Piece Dye: What Changes on the Rack', category: 'Craftsmanship', date: 'Jul 16, 2026', author: 'Design Team', excerpt: 'The dye stage shapes color depth, shrinkage and cost. Here is how we decide for each program.' },
];
