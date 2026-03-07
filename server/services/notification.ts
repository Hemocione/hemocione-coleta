interface SendWhatsAppNotificationParams {
  userId: string;
  templateName: string;
  params: Record<string, string>;
}

export async function sendWhatsAppNotification({
  userId,
  templateName,
  params,
}: SendWhatsAppNotificationParams): Promise<boolean> {
  const config = useRuntimeConfig();
  const baseUrl =
    config.hemocioneIdNotificationApiUrl ||
    config.public.hemocioneIdApiUrl;

  if (!baseUrl) {
    console.warn(
      "[notification] No notification API URL configured, skipping WhatsApp notification"
    );
    return false;
  }

  try {
    await $fetch(`${baseUrl}/notifications/whatsapp`, {
      method: "POST",
      headers: {
        "x-secret": config.hemocioneIdIntegrationSecret,
        "Content-Type": "application/json",
      },
      body: {
        userId,
        templateName,
        params,
      },
    });

    console.log(
      `[notification] WhatsApp notification sent: template=${templateName}, userId=${userId}`
    );
    return true;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(
      `[notification] Failed to send WhatsApp notification: template=${templateName}, userId=${userId}, error=${message}`
    );
    return false;
  }
}
