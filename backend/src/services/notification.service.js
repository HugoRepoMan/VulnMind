import webPush from 'web-push';
import { prisma } from '../database/prisma.js';

const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:security@vulnmind.local';
const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  webPush.setVapidDetails(subject, publicKey, privateKey);
}

export const getPushConfiguration = () => ({
  enabled: pushEnabled,
  publicKey: pushEnabled ? publicKey : null
});

export const sendCriticalFindingNotification = async (finding) => {
  if (!pushEnabled || finding.riskScore < 70) {
    return { sent: 0, removed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany();
  if (!subscriptions.length) return { sent: 0, removed: 0 };

  const payload = JSON.stringify({
    title: 'Hallazgo crítico en VulnMind',
    body: `${finding.assetName}: ${finding.vulnerability || `puerto ${finding.port}`} (${Math.round(finding.riskScore)}/100)`,
    url: `/?finding=${encodeURIComponent(finding.id)}`,
    findingId: finding.id,
    severity: finding.severity
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        }, payload, { TTL: 300, urgency: 'high' });
        return 'sent';
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await prisma.pushSubscription.deleteMany({
            where: { id: subscription.id }
          });
          return 'removed';
        }
        throw error;
      }
    })
  );

  return results.reduce((summary, result) => {
    if (result.status === 'fulfilled' && result.value === 'sent') summary.sent += 1;
    if (result.status === 'fulfilled' && result.value === 'removed') summary.removed += 1;
    return summary;
  }, { sent: 0, removed: 0 });
};
