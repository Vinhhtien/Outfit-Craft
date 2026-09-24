import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { JwtPayload } from '../types/index.js';

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
