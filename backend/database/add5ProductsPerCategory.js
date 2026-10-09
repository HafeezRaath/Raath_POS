// ============================================================
//  backend/database/add5ProductsPerCategory.js
//  Ensures every mobile shop category has at least 5 products
//  STRICTLY for tenant: tenant_muwyba5i_yix2o (Muhammad Hafeez)
// ============================================================

const { query } = require('../config/db');

async function add5ProductsPerCategory(targetTenantId = 'tenant_muwyba5i_yix2o') {
  console.log(`🚀 [AddProducts] Adding products to ensure 5+ products per category for: ${targetTenantId}...`);

  try {
    // 1. Get Brand IDs for this tenant
    const brands = await query('SELECT id, name FROM brands WHERE tenant_id = ? AND is_deleted = 0', [targetTenantId]);
    const brandMap = {};
    brands.forEach(b => { brandMap[b.name] = b.id; });

    // 2. Get Category IDs for this tenant
    const cats = await query('SELECT id, name FROM categories WHERE tenant_id = ? AND is_deleted = 0', [targetTenantId]);
    const catMap = {};
    cats.forEach(c => { catMap[c.name] = c.id; });

    // 3. Products List to ensure 5 products per category
    const additionalProducts = [
      // --- Category: Smartphones (Android) ---
      {
        name: 'Tecno Camon 30 Premier 5G (12GB/512GB)',
        brand: 'Tecno',
        category: 'Smartphones (Android)',
        type: 'single',
        unit: 'pc',
        sku: 'TEC-C30P-512',
        barcode: '6934127891234',
        purchase_price: 125000,
        sale_price: 139999,
        retail_price: 139999,
        wholesale_price: 135000,
        min_price: 132000,
        stock: 4,
        min_stock: 2,
        is_serialized: 1,
        desc: 'PolarTech Imaging, 70W Ultra Charge, 144Hz 1.5K AMOLED Display, Dimensity 8200 Ultimate',
        variants: [
          { variant_name: 'Alps Snowy Silver', name: 'Alps Snowy Silver', sku: 'C30P-SLV', barcode: '6934127891234', purchase_price: 125000, sale_price: 139999, stock: 4, imeis: ['867829104928171', '867829104928172'] }
        ]
      },

      // --- Category: iPhones & iPads ---
      {
        name: 'Apple iPhone 15 (128GB - PTA Approved)',
        brand: 'Apple',
        category: 'iPhones & iPads',
        type: 'single',
        unit: 'pc',
        sku: 'APL-IP15-128',
        barcode: '195949012345',
        purchase_price: 275000,
        sale_price: 295000,
        retail_price: 295000,
        wholesale_price: 290000,
        min_price: 288000,
        stock: 5,
        min_stock: 2,
        is_serialized: 1,
        desc: 'Dynamic Island, 48MP Main Camera, USB-C, Color-infused back glass, PTA Approved',
        variants: [
          { variant_name: 'Black (128GB)', name: 'Black (128GB)', sku: 'IP15-128-BLK', barcode: '195949012345', purchase_price: 275000, sale_price: 295000, stock: 5, imeis: ['352940192837461', '352940192837462'] }
        ]
      },
      {
        name: 'Apple iPhone 13 (128GB - Midnight - JV / Non-PTA)',
        brand: 'Apple',
        category: 'iPhones & iPads',
        type: 'single',
        unit: 'pc',
        sku: 'APL-IP13-128',
        barcode: '194252701234',
        purchase_price: 115000,
        sale_price: 128000,
        retail_price: 128000,
        wholesale_price: 124000,
        min_price: 122000,
        stock: 6,
        min_stock: 2,
        is_serialized: 1,
        desc: 'A15 Bionic chip, Dual-camera system, Ceramic Shield front, Super Retina XDR display',
        variants: [
          { variant_name: 'Midnight Black', name: 'Midnight Black', sku: 'IP13-128-MID', barcode: '194252701234', purchase_price: 115000, sale_price: 128000, stock: 6, imeis: ['359482019284751', '359482019284752'] }
        ]
      },
      {
        name: 'Apple iPad 10th Gen (64GB Wi-Fi - 10.9-inch Liquid Retina)',
        brand: 'Apple',
        category: 'iPhones & iPads',
        type: 'single',
        unit: 'pc',
        sku: 'APL-IPAD10-64',
        barcode: '194253381920',
        purchase_price: 105000,
        sale_price: 118000,
        retail_price: 118000,
        wholesale_price: 114000,
        min_price: 112000,
        stock: 3,
        min_stock: 1,
        is_serialized: 1,
        desc: 'All-screen design, A14 Bionic chip, Landscape 12MP Ultra Wide front camera, USB-C',
        variants: [
          { variant_name: 'Silver (64GB)', name: 'Silver (64GB)', sku: 'IPAD10-SLV', barcode: '194253381920', purchase_price: 105000, sale_price: 118000, stock: 3, imeis: ['DMPX78921021', 'DMPX78921022'] }
        ]
      },
      {
        name: 'Apple iPhone 14 Pro (128GB - Deep Purple - Official PTA)',
        brand: 'Apple',
        category: 'iPhones & iPads',
        type: 'single',
        unit: 'pc',
        sku: 'APL-IP14P-128',
        barcode: '194253401928',
        purchase_price: 340000,
        sale_price: 365000,
        retail_price: 365000,
        wholesale_price: 358000,
        min_price: 355000,
        stock: 3,
        min_stock: 1,
        is_serialized: 1,
        desc: 'Pro camera system, Dynamic Island, Always-On display, A16 Bionic chip, Stainless steel frame',
        variants: [
          { variant_name: 'Deep Purple (128GB)', name: 'Deep Purple (128GB)', sku: 'IP14P-PURP', barcode: '194253401928', purchase_price: 340000, sale_price: 365000, stock: 3, imeis: ['357892019283741', '357892019283742'] }
        ]
      },

      // --- Category: Fast Chargers & Cables ---
      {
        name: 'Baseus 100W 4-in-1 Fast Charging Cable (Type-C + Lightning + Micro)',
        brand: 'Baseus',
        category: 'Fast Chargers & Cables',
        type: 'single',
        unit: 'pc',
        sku: 'BAS-CAB-4IN1-100W',
        barcode: '695315620192',
        purchase_price: 850,
        sale_price: 1450,
        retail_price: 1450,
        wholesale_price: 1150,
        min_price: 1000,
        stock: 40,
        min_stock: 10,
        is_serialized: 0,
        desc: 'High density braided nylon multi-device fast sync and charge cable, durable zinc alloy plugs',
        variants: [
          { variant_name: '1.2m Black', name: '1.2m Black', sku: 'CAB-4IN1-BLK', barcode: '695315620192', purchase_price: 850, sale_price: 1450, stock: 40 }
        ]
      },
      {
        name: 'Apple 20W USB-C Power Adapter (Original Box Pack)',
        brand: 'Apple',
        category: 'Fast Chargers & Cables',
        type: 'single',
        unit: 'pc',
        sku: 'APL-ADP-20W',
        barcode: '194252157005',
        purchase_price: 4500,
        sale_price: 6200,
        retail_price: 6200,
        wholesale_price: 5600,
        min_price: 5400,
        stock: 25,
        min_stock: 5,
        is_serialized: 0,
        desc: 'Genuine Apple fast charge wall adapter for iPhone 11/12/13/14/15 series and iPads',
        variants: [
          { variant_name: 'Original 20W Plug', name: 'Original 20W Plug', sku: 'ADP-20W-WHT', barcode: '194252157005', purchase_price: 4500, sale_price: 6200, stock: 25 }
        ]
      },
      {
        name: 'Faster FC-67 67W Super Dart / Flash Charger (VOOC / Warp)',
        brand: 'Faster',
        category: 'Fast Chargers & Cables',
        type: 'single',
        unit: 'pc',
        sku: 'FAS-FC67-67W',
        barcode: '896400089201',
        purchase_price: 2100,
        sale_price: 3200,
        retail_price: 3200,
        wholesale_price: 2700,
        min_price: 2500,
        stock: 20,
        min_stock: 5,
        is_serialized: 0,
        desc: 'Ultra-fast flash charging adapter for Xiaomi 67W, Oppo SuperVOOC & Realme Dart',
        variants: [
          { variant_name: '67W + Cable Kit', name: '67W + Cable Kit', sku: 'FC67-WHT', barcode: '896400089201', purchase_price: 2100, sale_price: 3200, stock: 20 }
        ]
      },

      // --- Category: TWS Earbuds & Headsets ---
      {
        name: 'Apple AirPods Pro 2nd Gen (USB-C MagSafe Case)',
        brand: 'Apple',
        category: 'TWS Earbuds & Headsets',
        type: 'single',
        unit: 'pc',
        sku: 'APL-APP2-USBC',
        barcode: '195949052739',
        purchase_price: 52000,
        sale_price: 62500,
        retail_price: 62500,
        wholesale_price: 58000,
        min_price: 56000,
        stock: 6,
        min_stock: 2,
        is_serialized: 1,
        desc: 'H2 chip, Up to 2x more Active Noise Cancellation, Adaptive Audio, USB-C MagSafe Charging Case',
        variants: [
          { variant_name: 'Glossy White', name: 'Glossy White', sku: 'APP2-WHT', barcode: '195949052739', purchase_price: 52000, sale_price: 62500, stock: 6, imeis: ['H78X92K10291', 'H78X92K10292'] }
        ]
      },
      {
        name: 'Samsung Galaxy Buds FE (Active Noise Canceling)',
        brand: 'Samsung',
        category: 'TWS Earbuds & Headsets',
        type: 'single',
        unit: 'pc',
        sku: 'SAM-BUDS-FE',
        barcode: '880609520192',
        purchase_price: 16500,
        sale_price: 21500,
        retail_price: 21500,
        wholesale_price: 19500,
        min_price: 18500,
        stock: 8,
        min_stock: 3,
        is_serialized: 0,
        desc: 'Compact ergonomic design, Powerful Active Noise Canceling, Deep punchy bass, 30H battery',
        variants: [
          { variant_name: 'Graphite Black', name: 'Graphite Black', sku: 'BUDS-FE-BLK', barcode: '880609520192', purchase_price: 16500, sale_price: 21500, stock: 8 }
        ]
      },
      {
        name: 'Ronin R-520 Wireless Bluetooth Neckband (Long Battery)',
        brand: 'Ronin',
        category: 'TWS Earbuds & Headsets',
        type: 'single',
        unit: 'pc',
        sku: 'RON-R520-NB',
        barcode: '896400039812',
        purchase_price: 2200,
        sale_price: 3400,
        retail_price: 3400,
        wholesale_price: 2900,
        min_price: 2700,
        stock: 22,
        min_stock: 5,
        is_serialized: 0,
        desc: 'Magnetic earbuds, Ultra flexible neckband, 40 hours continuous playtime, Environmental noise reduction',
        variants: [
          { variant_name: 'Black & Red', name: 'Black & Red', sku: 'R520-BLK', barcode: '896400039812', purchase_price: 2200, sale_price: 3400, stock: 22 }
        ]
      },
      {
        name: 'Anker Soundcore P20i True Wireless Earbuds (10mm Drivers)',
        brand: 'Anker',
        category: 'TWS Earbuds & Headsets',
        type: 'single',
        unit: 'pc',
        sku: 'ANK-P20I-TWS',
        barcode: '194644140291',
        purchase_price: 4200,
        sale_price: 6200,
        retail_price: 6200,
        wholesale_price: 5400,
        min_price: 5000,
        stock: 15,
        min_stock: 4,
        is_serialized: 0,
        desc: 'Big bass with 10mm drivers, 30H playtime, IPX5 water resistant, 2 mics for clear AI calls',
        variants: [
          { variant_name: 'Midnight Blue', name: 'Midnight Blue', sku: 'P20I-BLU', barcode: '194644140291', purchase_price: 4200, sale_price: 6200, stock: 15 }
        ]
      },

      // --- Category: Screen Protectors & Glass ---
      {
        name: 'Matte Ceramic Anti-Glare Gaming Screen Protector',
        brand: 'Apple',
        category: 'Screen Protectors & Glass',
        type: 'single',
        unit: 'pc',
        sku: 'SCR-MATTE-CERAMIC',
        barcode: '784920199101',
        purchase_price: 90,
        sale_price: 300,
        retail_price: 300,
        wholesale_price: 180,
        min_price: 180,
        stock: 110,
        min_stock: 25,
        is_serialized: 0,
        desc: 'Unbreakable flexible ceramic sheet, anti-fingerprint matte surface designed for PUBG & gaming',
        variants: [
          { variant_name: 'Universal iPhone / Android', name: 'Universal iPhone / Android', sku: 'CERAMIC-MATTE', barcode: '784920199101', purchase_price: 90, sale_price: 300, stock: 110 }
        ]
      },
      {
        name: 'Privacy Spy Anti-Peep Tempered Glass (iPhone Series)',
        brand: 'Apple',
        category: 'Screen Protectors & Glass',
        type: 'single',
        unit: 'pc',
        sku: 'SCR-PRIVACY-SPY',
        barcode: '784920199102',
        purchase_price: 160,
        sale_price: 450,
        retail_price: 450,
        wholesale_price: 300,
        min_price: 250,
        stock: 85,
        min_stock: 20,
        is_serialized: 0,
        desc: '28-degree private viewing angle, protects personal data from side onlookers in public',
        variants: [
          { variant_name: 'Full Screen Black Edge', name: 'Full Screen Black Edge', sku: 'PRIVACY-IP', barcode: '784920199102', purchase_price: 160, sale_price: 450, stock: 85 }
        ]
      },
      {
        name: 'UV Liquid Glue Full Curve Tempered Glass (Samsung S23/S24 Ultra)',
        brand: 'Samsung',
        category: 'Screen Protectors & Glass',
        type: 'single',
        unit: 'pc',
        sku: 'SCR-UV-CURVED-S24',
        barcode: '784920199103',
        purchase_price: 350,
        sale_price: 950,
        retail_price: 950,
        wholesale_price: 650,
        min_price: 600,
        stock: 45,
        min_stock: 10,
        is_serialized: 0,
        desc: 'Optically clear liquid adhesive with UV curing light included, works with ultrasonic fingerprint',
        variants: [
          { variant_name: 'Curved Clear + UV Lamp Kit', name: 'Curved Clear + UV Lamp Kit', sku: 'UV-S24U-KIT', barcode: '784920199103', purchase_price: 350, sale_price: 950, stock: 45 }
        ]
      },
      {
        name: 'Camera Lens Metal Ring Protector (iPhone 14/15 Pro Max)',
        brand: 'Apple',
        category: 'Screen Protectors & Glass',
        type: 'single',
        unit: 'pc',
        sku: 'SCR-CAM-LENS-PRO',
        barcode: '784920199104',
        purchase_price: 180,
        sale_price: 500,
        retail_price: 500,
        wholesale_price: 350,
        min_price: 300,
        stock: 70,
        min_stock: 15,
        is_serialized: 0,
        desc: 'Individual aviation aluminum alloy rings with 9H sapphire glass lens protection',
        variants: [
          { variant_name: '3-Lens Kit (Titanium Gray)', name: '3-Lens Kit (Titanium Gray)', sku: 'CAM-RING-TIT', barcode: '784920199104', purchase_price: 180, sale_price: 500, stock: 70 }
        ]
      },

      // --- Category: Back Covers & Cases ---
      {
        name: 'iPhone 15 Pro Max MagSafe Clear Armor Hybrid Case',
        brand: 'Apple',
        category: 'Back Covers & Cases',
        type: 'single',
        unit: 'pc',
        sku: 'COV-IP15PM-MAGSAFE',
        barcode: '784920201001',
        purchase_price: 450,
        sale_price: 1200,
        retail_price: 1200,
        wholesale_price: 850,
        min_price: 750,
        stock: 40,
        min_stock: 10,
        is_serialized: 0,
        desc: 'Anti-yellowing crystal clear polycarbonate back with strong built-in N52 magnetic ring',
        variants: [
          { variant_name: 'Clear MagSafe', name: 'Clear MagSafe', sku: 'MAGSAFE-CLR', barcode: '784920201001', purchase_price: 450, sale_price: 1200, stock: 40 }
        ]
      },
      {
        name: 'Samsung S24 Ultra Heavy-Duty Shockproof Armor Stand Case',
        brand: 'Samsung',
        category: 'Back Covers & Cases',
        type: 'single',
        unit: 'pc',
        sku: 'COV-S24U-ARMOR',
        barcode: '784920201002',
        purchase_price: 550,
        sale_price: 1450,
        retail_price: 1450,
        wholesale_price: 1000,
        min_price: 900,
        stock: 35,
        min_stock: 8,
        is_serialized: 0,
        desc: 'Military grade drop protection with sliding camera lens cover and metal kickstand',
        variants: [
          { variant_name: 'Tactical Black', name: 'Tactical Black', sku: 'ARMOR-S24U-BLK', barcode: '784920201002', purchase_price: 550, sale_price: 1450, stock: 35 }
        ]
      },
      {
        name: 'Liquid Silicone Soft Touch Cover (Redmi Note 13 / Note 12)',
        brand: 'Xiaomi / Redmi',
        category: 'Back Covers & Cases',
        type: 'single',
        unit: 'pc',
        sku: 'COV-RN13-SILICONE',
        barcode: '784920201003',
        purchase_price: 220,
        sale_price: 650,
        retail_price: 650,
        wholesale_price: 450,
        min_price: 400,
        stock: 60,
        min_stock: 15,
        is_serialized: 0,
        desc: 'Silky baby-skin soft touch liquid silicone with microfiber inner cloth lining',
        variants: [
          { variant_name: 'Midnight Navy', name: 'Midnight Navy', sku: 'SILICONE-NVY', barcode: '784920201003', purchase_price: 220, sale_price: 650, stock: 60 }
        ]
      },
      {
        name: 'Luxury Electroplated Carbon Fiber Case (Infinix & Vivo)',
        brand: 'Infinix',
        category: 'Back Covers & Cases',
        type: 'single',
        unit: 'pc',
        sku: 'COV-INF-CARBON',
        barcode: '784920201004',
        purchase_price: 280,
        sale_price: 750,
        retail_price: 750,
        wholesale_price: 500,
        min_price: 450,
        stock: 50,
        min_stock: 10,
        is_serialized: 0,
        desc: 'Glossy electroplated golden borders with 3D carbon fiber texture back panel',
        variants: [
          { variant_name: 'Gold & Carbon Black', name: 'Gold & Carbon Black', sku: 'CARBON-GLD', barcode: '784920201004', purchase_price: 280, sale_price: 750, stock: 50 }
        ]
      },
      {
        name: 'Slim Frosted Matte Anti-Fingerprint Case (Universal Android)',
        brand: 'Vivo',
        category: 'Back Covers & Cases',
        type: 'single',
        unit: 'pc',
        sku: 'COV-MATTE-SLIM',
        barcode: '784920201005',
        purchase_price: 180,
        sale_price: 500,
        retail_price: 500,
        wholesale_price: 350,
        min_price: 300,
        stock: 75,
        min_stock: 15,
        is_serialized: 0,
        desc: 'Ultra thin 0.4mm semi-translucent frosted case, zero oil smudge and heat dissipation vents',
        variants: [
          { variant_name: 'Smoke Black', name: 'Smoke Black', sku: 'FROST-SMK', barcode: '784920201005', purchase_price: 180, sale_price: 500, stock: 75 }
        ]
      },

      // --- Category: Power Banks & Batteries ---
      {
        name: 'Anker 325 20,000mAh PowerCore External Battery Pack',
        brand: 'Anker',
        category: 'Power Banks & Batteries',
        type: 'single',
        unit: 'pc',
        sku: 'ANK-PB-325-20K',
        barcode: '194644081920',
        purchase_price: 6800,
        sale_price: 9500,
        retail_price: 9500,
        wholesale_price: 8400,
        min_price: 8000,
        stock: 10,
        min_stock: 3,
        is_serialized: 0,
        desc: 'PowerIQ technology, MultiProtect safety system, Twin USB ports for simultaneous dual charging',
        variants: [
          { variant_name: 'Matte Black (20,000mAh)', name: 'Matte Black (20,000mAh)', sku: 'PB325-BLK', barcode: '194644081920', purchase_price: 6800, sale_price: 9500, stock: 10 }
        ]
      },
      {
        name: 'Faster WPB-100 10,000mAh 22.5W Fast Charge Pocket Power Bank',
        brand: 'Faster',
        category: 'Power Banks & Batteries',
        type: 'single',
        unit: 'pc',
        sku: 'FAS-WPB100-10K',
        barcode: '896400092102',
        purchase_price: 2900,
        sale_price: 4200,
        retail_price: 4200,
        wholesale_price: 3700,
        min_price: 3500,
        stock: 16,
        min_stock: 4,
        is_serialized: 0,
        desc: 'LED digital battery percent meter, PD 20W + QC 3.0 22.5W output, compact pocket size',
        variants: [
          { variant_name: 'Compact White (10,000mAh)', name: 'Compact White (10,000mAh)', sku: 'WPB100-WHT', barcode: '896400092102', purchase_price: 2900, sale_price: 4200, stock: 16 }
        ]
      },
      {
        name: 'Ronin R-97 10,000mAh Transparent Cyberpunk Mini Power Bank',
        brand: 'Ronin',
        category: 'Power Banks & Batteries',
        type: 'single',
        unit: 'pc',
        sku: 'RON-R97-CYBER',
        barcode: '896400039101',
        purchase_price: 3400,
        sale_price: 4800,
        retail_price: 4800,
        wholesale_price: 4200,
        min_price: 4000,
        stock: 14,
        min_stock: 3,
        is_serialized: 0,
        desc: 'Futuristic see-through transparent casing, 22.5W Super Charge, integrated lanyard strap',
        variants: [
          { variant_name: 'Transparent Yellow Cyber', name: 'Transparent Yellow Cyber', sku: 'R97-CYBER-YLW', barcode: '896400039101', purchase_price: 3400, sale_price: 4800, stock: 14 }
        ]
      },
      {
        name: 'Apple MagSafe Battery Pack (Wireless Magnetic 5,000mAh)',
        brand: 'Apple',
        category: 'Power Banks & Batteries',
        type: 'single',
        unit: 'pc',
        sku: 'APL-MAGSAFE-BAT',
        barcode: '194252458921',
        purchase_price: 4200,
        sale_price: 6500,
        retail_price: 6500,
        wholesale_price: 5600,
        min_price: 5200,
        stock: 8,
        min_stock: 2,
        is_serialized: 0,
        desc: 'Snaps magnetically to back of iPhone 12/13/14/15 series for seamless cable-free wireless charging',
        variants: [
          { variant_name: 'MagSafe White (5,000mAh)', name: 'MagSafe White (5,000mAh)', sku: 'MAGSAFE-BAT-WHT', barcode: '194252458921', purchase_price: 4200, sale_price: 6500, stock: 8 }
        ]
      },

      // --- Category: Repair Spare Parts & Displays ---
      {
        name: 'Original High-Capacity Battery (iPhone 11 / 12 / 13 Series - 0 Cycle)',
        brand: 'Apple',
        category: 'Repair Spare Parts & Displays',
        type: 'single',
        unit: 'pc',
        sku: 'PART-IP-BAT-0CYC',
        barcode: '784920301001',
        purchase_price: 2400,
        sale_price: 4500,
        retail_price: 4500,
        wholesale_price: 3600,
        min_price: 3200,
        stock: 15,
        min_stock: 4,
        is_serialized: 0,
        desc: 'Brand new 0 charge cycles grade AAA+ internal lithium-ion replacement cell with flex cable',
        variants: [
          { variant_name: 'iPhone 13 Cell', name: 'iPhone 13 Cell', sku: 'BAT-IP13-CELL', barcode: '784920301001', purchase_price: 2400, sale_price: 4500, stock: 15 }
        ]
      },
      {
        name: 'Redmi Note 12 / 13 Pro Incell Display Combo Touch Screen',
        brand: 'Xiaomi / Redmi',
        category: 'Repair Spare Parts & Displays',
        type: 'single',
        unit: 'pc',
        sku: 'PART-RN13-INCELL',
        barcode: '784920301002',
        purchase_price: 3200,
        sale_price: 5200,
        retail_price: 5200,
        wholesale_price: 4400,
        min_price: 4000,
        stock: 8,
        min_stock: 2,
        is_serialized: 0,
        desc: 'High refresh rate vivid color replacement LCD panel with digitizer glass assembly',
        variants: [
          { variant_name: 'Black Frame Combo', name: 'Black Frame Combo', sku: 'DISP-RN13-BLK', barcode: '784920301002', purchase_price: 3200, sale_price: 5200, stock: 8 }
        ]
      },
      {
        name: 'Infinix Hot 30 / Smart 8 Original Charging Port Sub-Board (Flex PCB)',
        brand: 'Infinix',
        category: 'Repair Spare Parts & Displays',
        type: 'single',
        unit: 'pc',
        sku: 'PART-INF-PORT-FLEX',
        barcode: '784920301003',
        purchase_price: 450,
        sale_price: 1100,
        retail_price: 1100,
        wholesale_price: 800,
        min_price: 700,
        stock: 25,
        min_stock: 5,
        is_serialized: 0,
        desc: 'Complete bottom dock board with microphone, fast charge IC and 3.5mm audio jack',
        variants: [
          { variant_name: 'Hot 30 Board', name: 'Hot 30 Board', sku: 'PORT-HOT30', barcode: '784920301003', purchase_price: 450, sale_price: 1100, stock: 25 }
        ]
      },
      {
        name: 'Universal OCA Polarizer & Front Glass Lens (6.67-inch Curved/Flat)',
        brand: 'Samsung',
        category: 'Repair Spare Parts & Displays',
        type: 'single',
        unit: 'pc',
        sku: 'PART-OCA-GLASS-LENS',
        barcode: '784920301004',
        purchase_price: 250,
        sale_price: 750,
        retail_price: 750,
        wholesale_price: 500,
        min_price: 450,
        stock: 50,
        min_stock: 10,
        is_serialized: 0,
        desc: 'Pre-laminated Mitsubishi OCA glue outer glass lens for broken glass refurbishment without display change',
        variants: [
          { variant_name: '6.67-inch AMOLED Glass', name: '6.67-inch AMOLED Glass', sku: 'OCA-667-GLS', barcode: '784920301004', purchase_price: 250, sale_price: 750, stock: 50 }
        ]
      }
    ];

    let addedCount = 0;
    for (const prod of additionalProducts) {
      const bId = brandMap[prod.brand] || null;
      const cId = catMap[prod.category] || null;

      let [existingProd] = await query(
        'SELECT id FROM products WHERE tenant_id = ? AND name = ? AND is_deleted = 0',
        [targetTenantId, prod.name]
      );

      let prodId;
      if (!existingProd) {
        const res = await query(
          `INSERT INTO products (
            tenant_id, name, brand_id, category_id, type, unit, sku, barcode,
            purchase_price, sale_price, retail_price, wholesale_price, min_price,
            stock, min_stock, tax_type, tax_rate, is_serialized, description, status, is_deleted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inclusive', 0, ?, ?, 'active', 0)`,
          [
            targetTenantId, prod.name, bId, cId, prod.type, prod.unit, prod.sku, prod.barcode,
            prod.purchase_price, prod.sale_price, prod.retail_price, prod.wholesale_price, prod.min_price,
            prod.stock, prod.min_stock, prod.is_serialized, prod.desc
          ]
        );
        prodId = res.insertId;
        addedCount++;
      } else {
        prodId = existingProd.id;
      }

      // Seed Variants
      for (const v of prod.variants) {
        let [existingVar] = await query(
          'SELECT id FROM product_variants WHERE tenant_id = ? AND product_id = ? AND (variant_name = ? OR name = ?) AND is_deleted = 0',
          [targetTenantId, prodId, v.variant_name, v.name]
        );

        let varId;
        if (!existingVar) {
          const varRes = await query(
            `INSERT INTO product_variants (
              tenant_id, product_id, variant_name, name, sku, barcode,
              purchase_price, retail_price, sale_price, wholesale_price, minimum_retail_price,
              current_stock, stock, stock_alert_quantity, is_deleted
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5, 0)`,
            [
              targetTenantId, prodId, v.variant_name, v.name, v.sku, v.barcode,
              v.purchase_price, v.sale_price, v.sale_price, v.sale_price * 0.95, v.purchase_price,
              v.stock, v.stock
            ]
          );
          varId = varRes.insertId;
        } else {
          varId = existingVar.id;
        }

        // Seed IMEI / Serial Numbers if serialized
        if (prod.is_serialized && v.imeis && v.imeis.length > 0) {
          for (const imei of v.imeis) {
            const [serExists] = await query(
              'SELECT id FROM product_serialized_items WHERE tenant_id = ? AND serial_number = ? AND is_deleted = 0',
              [targetTenantId, imei]
            );
            if (!serExists) {
              await query(
                `INSERT INTO product_serialized_items (
                  tenant_id, product_id, product_variant_id, serial_number, serial_number_or_imei, status, is_deleted
                ) VALUES (?, ?, ?, ?, ?, 'available', 0)`,
                [targetTenantId, prodId, varId, imei, imei]
              );
            }
          }
        }
      }
    }

    console.log(`✅ [AddProducts] Added ${addedCount} new products. All categories now have 5+ products!`);
    return true;
  } catch (err) {
    console.error('❌ [AddProducts] Error:', err);
    throw err;
  }
}

if (require.main === module) {
  add5ProductsPerCategory()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { add5ProductsPerCategory };
