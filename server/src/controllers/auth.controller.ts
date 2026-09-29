import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { JwtPayload } from '../types/index.js';
// ===== NEW: Forgot / Reset / Change Password =====
import { hashResetToken } from '../models/User.js';
import { sendEmail } from '../utils/sendEmail.js';
// ===== END NEW =====

export const registerSchema = z.object({
  email: z.string().email('Email khong hop le'),
  password: z.string().min(6, 'Mat khau toi thieu 6 ky tu'),
  displayName: z.string().min(2, 'Ten hien thi toi thieu 2 ky tu').max(50),
  defaultCity: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email khong hop le'),
  password: z.string().min(1, 'Vui long nhap mat khau'),
});

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export const register = asyncHandler(async (req, res) => {
  const { email, password, displayName, defaultCity } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict('Email nay da duoc dang ky');
  }

  const user = await User.create({ email, password, displayName, defaultCity });
  const token = signToken({ sub: user._id.toString(), email: user.email });

  res.status(201).json({
    success: true,
    data: {
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        defaultCity: user.defaultCity,
      },
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // password co select:false nen phai select tuong minh.
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Email hoac mat khau khong dung');
  }

  const token = signToken({ sub: user._id.toString(), email: user.email });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        defaultCity: user.defaultCity,
      },
    },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.sub);
  if (!user) throw ApiError.notFound('Khong tim thay nguoi dung');
  res.json({ success: true, data: user });
});

// ===== NEW: Forgot / Reset / Change Password =====
// Luu y: client tu dang xuat khi nhan 401 (xem client/src/lib/api.ts), nen cac loi
// "sai mat khau cu" / "token reset khong hop le" tra 400/410, KHONG tra 401.

/** Dung lai dung password policy cua Register. */
const newPasswordField = registerSchema.shape.password;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email khong hop le'),
});

export const resetPasswordSchema = z.object({
  newPassword: newPasswordField,
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Vui long nhap mat khau cu'),
  newPassword: newPasswordField,
});

const FORGOT_PASSWORD_MESSAGE =
  'Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi.';

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body as z.infer<typeof forgotPasswordSchema>;

  const user = await User.findOne({ email });

  // Khong tiet lo email co ton tai hay khong (chong User Enumeration).
  if (user) {
    const token = user.createPasswordResetToken();
    // Chi ghi 2 field reset, khong dung toi password/validator khac.
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${env.frontendUrl}/reset-password/${token}`;
    try {
      await sendEmail({
        to: user.email,
        subject: 'OutfitCraft - Đặt lại mật khẩu',
        title: 'Đặt lại mật khẩu',
        paragraphs: [
          `Xin chào ${user.displayName},`,
          'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản OutfitCraft của bạn. Nhấn vào nút bên dưới để tạo mật khẩu mới.',
          'Link chỉ có hiệu lực trong 15 phút và chỉ sử dụng được một lần.',
        ],
        action: { label: 'Đặt lại mật khẩu', url: resetUrl },
        note: 'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu hiện tại của bạn vẫn giữ nguyên.',
      });
    } catch (err) {
      // Huy token vua tao de khong ton tai link "mo coi"; khong tra chi tiet SMTP ra client.
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      console.error('[forgotPassword] Gui email that bai:', err);
      throw new ApiError(500, 'Khong the gui email luc nay, vui long thu lai sau');
    }
  }

  res.json({ success: true, message: FORGOT_PASSWORD_MESSAGE });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body as z.infer<typeof resetPasswordSchema>;
  const hashedToken = hashResetToken(String(req.params.token ?? ''));

  // "Claim" token nguyen tu: xoa token ngay trong cung 1 lenh -> 2 request song song
  // voi cung token thi chi 1 request thanh cong (token chi dung 1 lan).
  const user = await User.findOneAndUpdate(
    { resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: new Date() } },
    { $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 } }
  );

  if (!user) {
    // Phan biet "het han" voi "khong hop le / da dung" de client hien thi ro rang.
    const expired = await User.findOneAndUpdate(
      { resetPasswordToken: hashedToken },
      { $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 } }
    );
    if (expired) {
      throw new ApiError(410, 'Link dat lai mat khau da het han, vui long yeu cau link moi');
    }
    throw ApiError.badRequest('Link dat lai mat khau khong hop le hoac da duoc su dung');
  }

  // pre('save') cua User se hash bang bcrypt nhu Register.
  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Dat lai mat khau thanh cong, vui long dang nhap lai' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

  const user = await User.findById(req.user!.sub).select('+password');
  if (!user) throw ApiError.notFound('Khong tim thay nguoi dung');

  if (!(await user.comparePassword(oldPassword))) {
    throw ApiError.badRequest('Mat khau cu khong dung');
  }
  if (newPassword === oldPassword) {
    throw ApiError.badRequest('Mat khau moi phai khac mat khau cu');
  }

  user.password = newPassword;
  await user.save();

  res.json({ success: true, message: 'Doi mat khau thanh cong' });
});
// ===== END NEW =====
