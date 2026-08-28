export interface BloodBankInterestDiscordNotification {
  bloodBanksLocationId: string;
  bankName: string;
  name: string;
  phone: string;
  userId?: string;
  origin: "ondedoar";
}

export async function sendBloodBankInterestToDiscord(
  notification: BloodBankInterestDiscordNotification,
): Promise<{ status: "sent" | "disabled" }> {
  const webhookUrl = useRuntimeConfig().discordBloodBankInterestWebhookUrl?.trim();
  if (!webhookUrl) return { status: "disabled" };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    throw new Error("Discord webhook URL is invalid");
  }
  const allowedHosts = new Set([
    "discord.com",
    "discordapp.com",
    "canary.discord.com",
    "canary.discordapp.com",
    "ptb.discord.com",
    "ptb.discordapp.com",
  ]);
  if (parsedUrl.protocol !== "https:") {
    throw new Error("Discord webhook must use HTTPS");
  }
  if (
    !allowedHosts.has(parsedUrl.hostname) ||
    !parsedUrl.pathname.startsWith("/api/webhooks/")
  ) {
    throw new Error("Discord webhook URL is not allowed");
  }

  const userLine = notification.userId ? `Usuário: ${notification.userId}` : "Usuário: anônimo";
  const response = await $fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: {
      content: [
        "Novo interesse em banco de sangue",
        `Banco: ${notification.bankName}`,
        `bloodBanksLocationId: ${notification.bloodBanksLocationId}`,
        `Nome: ${notification.name}`,
        `Telefone: ${notification.phone}`,
        userLine,
        `Origem: ${notification.origin}`,
      ].join("\n"),
      allowed_mentions: { parse: [] },
    },
  });
  if (
    response &&
    typeof response === "object" &&
    "ok" in response &&
    (response as { ok?: unknown }).ok === false
  ) {
    throw new Error("Discord rejected the webhook delivery");
  }

  return { status: "sent" };
}
