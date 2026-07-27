import { z } from 'zod';
import { prisma } from '../database/prisma.js';
import { getPushConfiguration } from '../services/notification.service.js';

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(256)
  })
});

const removeSchema = z.object({
  endpoint: z.string().url().max(2048)
});

export const getNotificationConfiguration = async (req, res, next) => {
  try {
    const configuration = getPushConfiguration();
    const subscriptions = await prisma.pushSubscription.count({
      where: { userId: req.user.id }
    });

    res.json({
      success: true,
      data: { ...configuration, subscribed: subscriptions > 0 }
    });
  } catch (error) {
    next(error);
  }
};

export const subscribeToNotifications = async (req, res, next) => {
  try {
    const configuration = getPushConfiguration();
    if (!configuration.enabled) {
      const error = new Error('Push notifications are not configured on the server');
      error.statusCode = 503;
      throw error;
    }

    const subscription = subscriptionSchema.parse(req.body);
    const saved = await prisma.$transaction(async (tx) => {
      const record = await tx.pushSubscription.upsert({
        where: { endpoint: subscription.endpoint },
        update: {
          userId: req.user.id,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: req.get('user-agent')?.slice(0, 500)
        },
        create: {
          userId: req.user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: req.get('user-agent')?.slice(0, 500)
        }
      });
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'PUSH_SUBSCRIPTION_ENABLED',
          entityType: 'PushSubscription',
          entityId: record.id
        }
      });
      return record;
    });

    res.status(201).json({
      success: true,
      data: { id: saved.id, subscribed: true }
    });
  } catch (error) {
    next(error);
  }
};

export const unsubscribeFromNotifications = async (req, res, next) => {
  try {
    const { endpoint } = removeSchema.parse(req.body);
    const existing = await prisma.pushSubscription.findFirst({
      where: { endpoint, userId: req.user.id }
    });

    if (existing) {
      await prisma.$transaction([
        prisma.pushSubscription.delete({ where: { id: existing.id } }),
        prisma.auditLog.create({
          data: {
            userId: req.user.id,
            action: 'PUSH_SUBSCRIPTION_DISABLED',
            entityType: 'PushSubscription',
            entityId: existing.id
          }
        })
      ]);
    }

    res.json({ success: true, data: { subscribed: false } });
  } catch (error) {
    next(error);
  }
};
