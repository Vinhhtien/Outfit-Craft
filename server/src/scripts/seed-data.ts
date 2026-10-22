import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ClothingItem } from '../models/ClothingItem.js';
import { Outfit } from '../models/Outfit.js';
import { Comment } from '../models/Comment.js';
import { Like } from '../models/Like.js';
import { WishlistItem } from '../models/WishlistItem.js';

dotenv.config();

const MONGODB_URI = env.mongoUri;

async function seed() {
  console.log('Connecting to MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  // Clear existing collections
  await Promise.all([
    User.deleteMany({}),
    ClothingItem.deleteMany({}),
    Outfit.deleteMany({}),
    Comment.deleteMany({}),
    Like.deleteMany({}),
    WishlistItem.deleteMany({}),
  ]);

  console.log('Cleared existing data.');

  // 1. Create Users
  const user1 = new User({
    email: 'demo@outfitcraft.com',
    password: 'password123',
    displayName: 'Lê Vĩnh Tiến',
    defaultCity: 'Hanoi',
    isVerified: true,
    role: 'user',
    isActive: true,
  });
  await user1.save();

  const user2 = new User({
    email: 'mai.anh@outfitcraft.com',
    password: 'password123',
    displayName: 'Mai Anh',
    defaultCity: 'Danang',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    isVerified: true,
    role: 'user',
    isActive: true,
  });
  await user2.save();

  console.log('Created Users:', user1.email, user2.email);

  // 2. Create Items for user1
  const itemsData = [
    {
      owner: user1._id,
      name: 'Áo phông trắng basic Cotton',
      category: 'top',
      originalImageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500',
      imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500',
      colors: ['#ffffff'],
      styles: ['casual', 'minimal'],
      seasons: ['spring', 'summer', 'autumn'],
      occasions: ['daily', 'school', 'travel'],
      tempRange: { min: 20, max: 38 },
      brand: 'Uniqlo',
      purchasePrice: 290000,
      wearCount: 15,
      lastWornAt: new Date(Date.now() - 86400000 * 2),
      isArchived: false,
    },
    {
      owner: user1._id,
      name: 'Quần Jean Slim-fit Indigo',
      category: 'bottom',
      originalImageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500',
      imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500',
      colors: ['#1e3a8a'],
      styles: ['casual', 'streetwear'],
      seasons: ['spring', 'autumn', 'winter'],
      occasions: ['daily', 'school', 'work'],
      tempRange: { min: 10, max: 30 },
      brand: "Levi's",
      purchasePrice: 850000,
      wearCount: 12,
      lastWornAt: new Date(Date.now() - 86400000 * 3),
      isArchived: false,
    },
    {
      owner: user1._id,
      name: 'Giày Sneaker Trắng Retro',
      category: 'shoes',
      originalImageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500',
      imageUrl: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500',
      colors: ['#ffffff', '#869bb2'],
      styles: ['casual', 'sporty'],
      seasons: ['spring', 'summer', 'autumn', 'winter'],
      occasions: ['daily', 'school', 'travel', 'sport'],
      tempRange: { min: 5, max: 40 },
      brand: 'Adidas',
      purchasePrice: 1500000,
      wearCount: 8,
      lastWornAt: new Date(Date.now() - 86400000 * 5),
      isArchived: false,
    },
    {
      owner: user1._id,
      name: 'Áo Blazer Dạ Vintage Kẻ Caro',
      category: 'outerwear',
      originalImageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500',
      imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500',
      colors: ['#78350f', '#d97706'],
      styles: ['vintage', 'formal'],
      seasons: ['autumn', 'winter'],
      occasions: ['work', 'date', 'party'],
      tempRange: { min: 12, max: 24 },
      brand: 'Zara',
      purchasePrice: 1200000,
      wearCount: 5,
      lastWornAt: new Date(Date.now() - 86400000 * 10),
      isArchived: false,
    },
    {
      owner: user1._id,
      name: 'Túi Tote Canvas Kem Vintage',
      category: 'bag',
      originalImageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500',
      imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500',
      colors: ['#faf9f5'],
      styles: ['casual', 'minimal'],
      seasons: ['spring', 'summer', 'autumn'],
      occasions: ['daily', 'school', 'travel'],
      tempRange: { min: 0, max: 45 },
      brand: 'Muji',
      purchasePrice: 180000,
      wearCount: 3,
      lastWornAt: new Date(Date.now() - 86400000 * 15),
      isArchived: false,
    },
    {
      owner: user1._id,
      name: 'Áo Sơ Mi Oxford Xanh Pastel',
      category: 'top',
      originalImageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500',
      imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500',
      colors: ['#93c5fd'],
      styles: ['formal', 'minimal'],
      seasons: ['spring', 'autumn'],
      occasions: ['work', 'school', 'date'],
      tempRange: { min: 18, max: 30 },
      brand: 'Ralph Lauren',
      purchasePrice: 650000,
      wearCount: 1,
      lastWornAt: new Date(Date.now() - 86400000 * 220), // ~7.3 thang truoc (Warning: 6-12 thang)
      isArchived: false,
    },
    {
      owner: user1._id,
      name: 'Váy Hoa Nhí Vintage Dáng Xòe',
      category: 'dress',
      originalImageUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500',
      imageUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=500',
      colors: ['#fecdd3', '#1f453e'],
      styles: ['vintage', 'casual'],
      seasons: ['spring', 'summer'],
      occasions: ['date', 'travel', 'party'],
      tempRange: { min: 22, max: 35 },
      brand: 'Vintage Craft',
      purchasePrice: 550000,
      wearCount: 2,
      lastWornAt: new Date(Date.now() - 86400000 * 420), // ~14 thang truoc (Danger: >12 thang)
      isArchived: false,
    },
    {
      owner: user1._id,
      name: 'Áo Trench Coat Dáng Dài Cổ Điển',
      category: 'outerwear',
      originalImageUrl: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=500',
      imageUrl: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=500',
      colors: ['#d97706'],
      styles: ['vintage', 'formal'],
      seasons: ['winter'],
      occasions: ['work', 'travel'],
      tempRange: { min: 8, max: 18 },
      brand: 'Burberry Style',
      purchasePrice: 1950000,
      wearCount: 0, // Never worn!
      createdAt: new Date(Date.now() - 86400000 * 270), // Them vao tu 9 thang truoc (Warning)
      isArchived: false,
    },
  ];

  const createdItems = await ClothingItem.insertMany(itemsData);
  console.log(`Created ${createdItems.length} wardrobe items for user1.`);

  // 3. Create sample public outfits for user2 (Mai Anh) so user1 can test OOTD Feed, Like, Comment, and Profile
  const outfit1 = new Outfit({
    owner: user2._id,
    name: 'Bản phối dạo phố cuối tuần Parisienne',
    thumbnailUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600',
    tags: ['Vintage', 'Dạo phố', 'Parisienne'],
    seasons: ['autumn', 'spring'],
    occasions: ['daily', 'date', 'travel'],
    isPublic: true,
    likeCount: 4,
    items: [
      {
        item: createdItems[0]._id,
        left: 200,
        top: 130,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        zIndex: 20,
      },
      {
        item: createdItems[1]._id,
        left: 200,
        top: 300,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        zIndex: 10,
      },
      {
        item: createdItems[2]._id,
        left: 200,
        top: 450,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        zIndex: 5,
      },
    ],
  });
  await outfit1.save();

  const outfit2 = new Outfit({
    owner: user2._id,
    name: 'Công sở thanh lịch với Blazer Dạ',
    thumbnailUrl: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600',
    tags: ['Công sở', 'Blazer', 'Tối giản'],
    seasons: ['autumn', 'winter'],
    occasions: ['work', 'date'],
    isPublic: true,
    likeCount: 7,
    items: [
      {
        item: createdItems[3]._id,
        left: 200,
        top: 130,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        zIndex: 40,
      },
      {
        item: createdItems[1]._id,
        left: 200,
        top: 300,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        zIndex: 10,
      },
    ],
  });
  await outfit2.save();

  // Add sample comments to outfit1
  await Comment.create([
    {
      user: user2._id,
      outfit: outfit1._id,
      content: 'Bản phối này mặc đi dạo phố mùa thu cực kỳ thoải mái và tôn dáng nha mọi người!',
    },
  ]);

  // 4. Create sample Wishlist items for user1 (including duplicate warning case)
  await WishlistItem.create([
    {
      owner: user1._id,
      name: 'Áo sơ mi linen cổ bẻ xanh pastel',
      category: 'top',
      price: 480000,
      colors: ['#93c5fd'],
      priority: 'medium',
      brand: 'Zara',
      imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500',
      productUrl: 'https://www.zara.com/vn',
      notes: 'Đắn đo vì trong tủ đã có 1 áo Oxford xanh pastel tương tự',
      isPurchased: false,
    },
    {
      owner: user1._id,
      name: 'Chân váy xếp ly Trắng Vintage',
      category: 'bottom',
      price: 350000,
      colors: ['#ffffff'],
      priority: 'high',
      brand: 'Chuu Korea',
      imageUrl: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=500',
      productUrl: 'https://shopee.vn',
      notes: 'Cần mua sớm để phối cùng áo Blazer dạ Vintage cho tiết trời mùa thu',
      isPurchased: false,
    },
    {
      owner: user1._id,
      name: 'Kính râm gọng tròn Retro phong cách 90s',
      category: 'accessory',
      price: 220000,
      colors: ['#000000'],
      priority: 'low',
      brand: 'Vintage Look',
      imageUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500',
      productUrl: 'https://lazada.vn',
      isPurchased: true,
      purchasedAt: new Date(Date.now() - 86400000 * 5),
    },
  ]);

  console.log('Created sample outfits, comments, and wishlist items.');
  console.log('SEED COMPLETED SUCCESSFULLY!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
