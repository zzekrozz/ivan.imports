function pushConfiguration(env = process.env) {
  return {
    publicKey: String(env.CONTROL_VAPID_PUBLIC_KEY || "").trim(),
    privateKey: String(env.CONTROL_VAPID_PRIVATE_KEY || "").trim(),
    subject: String(env.CONTROL_VAPID_SUBJECT || "mailto:soporte@ivanimports.es").trim(),
  };
}

export function controlPushPublicConfig(env = process.env) {
  const config = pushConfiguration(env);
  return {
    available: Boolean(config.publicKey && config.privateKey && config.subject),
    public_key: config.publicKey || null,
  };
}

export function createControlPushSender(env = process.env) {
  const config = pushConfiguration(env);
  return async function sendControlPush(subscription, payload) {
    if (!config.publicKey || !config.privateKey || !config.subject) {
      throw Object.assign(new Error("push_not_configured"), { status: 503 });
    }
    const webPush = await import("web-push");
    webPush.default.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    return webPush.default.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 24 * 60 * 60,
      urgency: "high",
    });
  };
}
