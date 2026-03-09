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

/**
 * Converts a flat params object into WhatsApp Business API templateComponents format.
 * Values are mapped as positional body parameters in insertion order.
 */
function paramsToTemplateComponents(params: Record<string, string>) {
  const parameters = Object.values(params).map((value) => ({
    type: "text" as const,
    text: value,
  }));
  return [{ type: "body", parameters }];
}

function getNotificationConfig() {
  const config = useRuntimeConfig();
  const baseUrl =
    config.hemocioneIdNotificationApiUrl ||
    config.public.hemocioneIdApiUrl;

  return { baseUrl, secret: config.hemocioneIdIntegrationSecret };
}

/**
 * Send WhatsApp notification to a user by their hemocione-id userId.
 * Uses hemocione-id's POST /send-wpp-msg endpoint.
 */
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
    await $fetch(`${baseUrl}/send-wpp-msg`, {
      method: "POST",
      headers: {
        "x-secret": secret,
        "Content-Type": "application/json",
      },
      body: {
        hemocioneId: userId,
        templateName,
        templateComponents: paramsToTemplateComponents(params),
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

/**
 * Send WhatsApp notification directly to a phone number.
 * Uses hemocione-id's POST /send-wpp-msg endpoint with the phone parameter.
 */
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
    await $fetch(`${baseUrl}/send-wpp-msg`, {
      method: "POST",
      headers: {
        "x-secret": secret,
        "Content-Type": "application/json",
      },
      body: {
        phone,
        templateName,
        templateComponents: paramsToTemplateComponents(params),
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
