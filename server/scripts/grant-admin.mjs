import mongoose from 'mongoose';
import { env } from '../src/config/env.ts';
import { User } from '../src/models/User.ts';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Cách dùng: npm run admin:grant -- email-da-dang-ky@example.com');
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(env.mongoUri);
    const account = await User.findOne({ email });
    if (!account) throw new Error('Chưa có tài khoản với email này. Hãy đăng ký và xác thực email trước.');
    // Legacy accounts without isVerified are allowed by the existing login flow.
    if (await User.exists({ _id: account._id, isVerified: false })) throw new Error('Tài khoản chưa xác thực email.');
    if (!account.isActive) throw new Error('Tài khoản đang bị khóa.');
    account.role = 'admin';
    await account.save();
    console.log(`Đã cấp quyền admin cho ${account.email}. Đăng nhập lại rồi truy cập /admin.`);
  } catch (error) { console.error(error instanceof Error ? error.message : 'Không thể cấp quyền admin.'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
