interface SendWhatsAppNotificationParams {
  userId: string;
  templateName: string;
  params: Record<string, string>;
}

interface SendWhatsAppNotificationToPhoneParams {
  phone: string;
  templateName: string;
  params: Record<string, string>;
}

function getNotificationConfig() {
  const config = useRuntimeConfig();
  const baseUrl =
    config.hemocioneIdNotificationApiUrl ||
    config.public.hemocioneIdApiUrl;

  return { baseUrl, secret: config.hemocioneIdIntegrationSecret };
}

export async function sendWhatsAppNotification({
  userId,
  templateName,
  params,
}: SendWhatsAppNotificationParams): Promise<boolean> {
  const { baseUrl, secret } = getNotificationConfig();

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
        "x-secret": secret,
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

export async function sendWhatsAppNotificationToPhone({
  phone,
  templateName,
  params,
}: SendWhatsAppNotificationToPhoneParams): Promise<boolean> {
  const { baseUrl, secret } = getNotificationConfig();

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
        "x-secret": secret,
        "Content-Type": "application/json",
      },
      body: {
        phone,
        templateName,
        params,
      },
    });

    console.log(
      `[notification] WhatsApp notification sent: template=${templateName}, phone=${phone.slice(0, 4)}***`
    );
    return true;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(
      `[notification] Failed to send WhatsApp notification: template=${templateName}, phone=${phone.slice(0, 4)}***, error=${message}`
    );
    return false;
  }
}
