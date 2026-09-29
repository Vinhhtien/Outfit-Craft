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
// ===== NEW: Register OTP =====
import { REGISTRATION_OTP_MAX_ATTEMPTS } from '../models/User.js';
// ===== END NEW =====
// ===== NEW: Update Profile =====
import { uploadBuffer, destroyImage } from '../services/upload.service.js';
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

// ===== NEW: Register OTP =====
// Dang ky 2 buoc: POST /register tao tai khoan isVerified:false + gui OTP qua email,
// POST /verify-registration xac thuc OTP roi moi tra JWT (tu dong dang nhap).
export const register = asyncHandler(async (req, res) => {
  const { email, password, displayName, defaultCity } = req.body as z.infer<typeof registerSchema>;

  // Tai khoan dang cho xac thuc -> cho dang ky lai: ghi de thong tin va gui ma moi
  // (cung la co che "Gui lai ma OTP"). Query { isVerified: false } khong khop tai khoan cu
  // chua co field nay, nen tai khoan cu / da xac thuc van bi chan 409 nhu truoc.
  let user = await User.findOne({ email, isVerified: false });
  if (!user) {
    if (await User.exists({ email })) {
      throw ApiError.conflict('Email nay da duoc dang ky');
    }
    user = new User({ email, isVerified: false });
  }

  user.password = password; // pre('save') se hash bang bcrypt
  user.displayName = displayName;
  if (defaultCity !== undefined) user.defaultCity = defaultCity;
  const otp = user.createRegistrationOtp();
  await user.save();

  try {
    await sendEmail({
      to: user.email,
      subject: 'OutfitCraft - Mã xác nhận đăng ký',
      title: 'Xác thực email',
      paragraphs: [
        `Xin chào ${user.displayName},`,
        `Mã xác nhận đăng ký tài khoản OutfitCraft của bạn là: ${otp}`,
        'Mã có hiệu lực trong 10 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.',
      ],
      note: 'Nếu bạn không đăng ký tài khoản OutfitCraft, hãy bỏ qua email này.',
    });
  } catch (err) {
    // Tai khoan van o trang thai cho xac thuc -> user bam dang ky lai la duoc gui ma moi.
    console.error('[register] Gui email OTP that bai:', err);
    throw new ApiError(500, 'Khong the gui email xac nhan luc nay, vui long thu lai sau');
  }

  res.status(201).json({
    success: true,
    message: 'Ma OTP da duoc gui den email cua ban',
    data: { email: user.email },
  });
});

export const verifyRegistrationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email khong hop le'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Ma OTP gom 6 chu so'),
});

export const verifyRegistration = asyncHandler(async (req, res) => {
  const { email, otp } = req.body as z.infer<typeof verifyRegistrationSchema>;

  // Tru 1 luot thu TRUOC khi so ma, trong 1 lenh nguyen tu -> ban song song hang loat request
  // cung khong vuot qua REGISTRATION_OTP_MAX_ATTEMPTS lan doan.
  const pending = await User.findOneAndUpdate(
    {
      email,
      isVerified: false,
      registrationOtpExpire: { $gt: new Date() },
      registrationOtpAttempts: { $lt: REGISTRATION_OTP_MAX_ATTEMPTS },
    },
    { $inc: { registrationOtpAttempts: 1 } },
    { new: true }
  ).select('+registrationOtp');

  if (!pending) {
    const current = await User.findOne({ email, isVerified: false }).select(
      '+registrationOtp +registrationOtpExpire +registrationOtpAttempts'
    );
    if (current?.registrationOtp && current.registrationOtpExpire && current.registrationOtpExpire <= new Date()) {
      throw new ApiError(410, 'Ma OTP da het han, vui long gui lai ma moi');
    }
    if (current?.registrationOtp) {
      throw new ApiError(429, 'Ban da nhap sai qua nhieu lan, vui long gui lai ma moi');
    }
    // Khong ton tai / da xac thuc roi: khong tiet lo chi tiet.
    throw ApiError.badRequest('Ma OTP khong hop le, vui long dang ky lai');
  }

  const hashedOtp = hashResetToken(otp);
  if (pending.registrationOtp !== hashedOtp) {
    throw ApiError.badRequest('Ma OTP khong dung');
  }

  // "Claim" OTP: kich hoat + xoa OTP trong cung 1 lenh -> ma chi dung duoc 1 lan.
  const user = await User.findOneAndUpdate(
    { _id: pending._id, isVerified: false, registrationOtp: hashedOtp },
    {
      $set: { isVerified: true },
      $unset: { registrationOtp: 1, registrationOtpExpire: 1, registrationOtpAttempts: 1 },
    },
    { new: true }
  );
  if (!user) {
    throw ApiError.badRequest('Ma OTP khong hop le, vui long gui lai ma moi');
  }

  // Tra ve giong het login de client tu dong dang nhap.
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
// ===== END NEW =====

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // password co select:false nen phai select tuong minh.
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Email hoac mat khau khong dung');
  }

  // ===== NEW: Register OTP =====
  // Query DB truc tiep: { isVerified: false } chi khop tai khoan dang cho xac thuc OTP,
  // tai khoan cu (khong co field nay) van dang nhap binh thuong. Tra 403, khong tra 401
  // (401 lam client tu dang xuat - xem client/src/lib/api.ts).
  if (await User.exists({ _id: user._id, isVerified: false })) {
    throw ApiError.forbidden('Tai khoan chua xac thuc email, vui long dang ky lai de nhan ma OTP');
  }
  // ===== END NEW =====

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

// ===== NEW: Update Profile =====
// Endpoint rieng voi change-password (Separation of Concerns): route nay KHONG dong toi password.
// Chay sau upload.single('avatar') nen req.body la cac text field cua multipart/form-data.
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Ten hien thi khong duoc de trong')
    .max(50, 'Ten hien thi toi da 50 ky tu')
    .optional(),
  defaultCity: z
    .string()
    .trim()
    .min(1, 'Thanh pho khong duoc de trong')
    .max(100, 'Ten thanh pho toi da 100 ky tu')
    .optional(),
});

export const updateProfile = asyncHandler(async (req, res) => {
  // Chong Mass Assignment: validate() da bo moi field ngoai 2 field tren
  // (email/password/role... gui kem se bi bo qua); avatar chi lay tu req.file.
  const { displayName, defaultCity } = req.body as z.infer<typeof updateProfileSchema>;

  const user = await User.findById(req.user!.sub).select('+avatarPublicId');
  if (!user) throw ApiError.notFound('Khong tim thay nguoi dung');

  if (displayName !== undefined) user.displayName = displayName;
  if (defaultCity !== undefined) user.defaultCity = defaultCity;

  // Khong co file -> giu nguyen avatar cu.
  const oldPublicId = user.avatarPublicId;
  let uploadedPublicId: string | undefined;
  if (req.file) {
    const uploaded = await uploadBuffer(req.file.buffer, `outfitcraft/${user._id}/avatar`);
    uploadedPublicId = uploaded.publicId;
    user.avatarUrl = uploaded.url;
    user.avatarPublicId = uploaded.publicId;
  }

  try {
    await user.save();
  } catch (err) {
    // Luu DB that bai -> xoa anh vua upload de khong de rac tren Cloudinary.
    await destroyImage(uploadedPublicId);
    throw err;
  }

  // Chi xoa avatar cu sau khi avatar moi da duoc luu thanh cong.
  if (uploadedPublicId && oldPublicId && oldPublicId !== uploadedPublicId) {
    await destroyImage(oldPublicId);
  }

  res.json({
    success: true,
    message: 'Cap nhat ho so thanh cong',
    data: {
      id: user._id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      defaultCity: user.defaultCity,
    },
  });
});
// ===== END NEW =====
