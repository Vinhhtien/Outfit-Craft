import mongoose from 'mongoose';
import { env } from '../src/config/env.ts';
import { User } from '../src/models/User.ts';
import { seedDemoAdmin, DEMO_ADMIN_EMAIL } from '../src/services/demoAdmin.service.ts';

try {
  if (env.nodeEnv !== 'development' || !env.seedDemoAdmin) throw new Error('Tài khoản mẫu chỉ được tạo trong development và khi SEED_DEMO_ADMIN không phải false.');
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
  await User.init();
  const result = await seedDemoAdmin();
  console.log(result.status === 'created' ? `Đã tạo admin mẫu: ${DEMO_ADMIN_EMAIL}` : 'Tài khoản mẫu đã tồn tại; giữ nguyên mật khẩu và quyền hiện có.');
  if (result.status === 'exists' && result.usable === false) throw new Error('Email mẫu đã thuộc tài khoản khác hoặc tài khoản bị khóa/chưa xác thực. Không tự ghi đè.');
} catch (error) {
  // Do not print connection errors that may include database credentials.
  console.error(error instanceof Error && /^(Tài khoản|Email mẫu)/.test(error.message) ? error.message : 'Không thể tạo admin mẫu. Kiểm tra cấu hình và kết nối MongoDB.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
