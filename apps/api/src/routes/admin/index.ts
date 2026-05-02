import { Hono } from 'hono';
import type { AppEnv } from '@/types/env';
import { adminAuthRoutes } from './auth.js';
import { adminVoicesRoutes } from './voices.js';
import { adminInfoRoutes } from './info.js';

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.route('/auth', adminAuthRoutes);
adminRoutes.route('/voices', adminVoicesRoutes);
adminRoutes.route('/info', adminInfoRoutes);
